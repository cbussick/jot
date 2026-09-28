import * as stylex from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { styles } from './app.stylex';
import { Auth, Brand } from './components/Auth';
import { Editor, type EditorValue } from './components/Editor';
import { Icon } from './components/Icon';
import { NoteBoard } from './components/NoteBoard';
import { clearShares, discardShare, getShare } from './incoming-share';
import { clearLocalData, deleteLocalNote, hasLocalData, localNotes, reorderLocalNotes, saveLocalNote, syncNotes, type LocalNote } from './local-store';

type SyncState = 'connecting' | 'syncing' | 'synced' | 'local' | 'offline' | 'error';

export function App() {
  const queryClient = useQueryClient();
  const auth = useQuery({ queryKey: ['auth'], queryFn: api.authStatus, retry: false });
  const [offlineAccess, setOfflineAccess] = useState(false);
  useEffect(() => {
    if (auth.error instanceof ApiError && auth.error.status === 0) void hasLocalData().then(setOfflineAccess);
  }, [auth.error]);
  if (auth.isPending) return <Loading/>;
  if (auth.data?.authenticated || offlineAccess) return <NotesApp offlineEntry={!auth.data?.authenticated} onLogout={() => { setOfflineAccess(false); void queryClient.invalidateQueries({ queryKey: ['auth'] }); }}/>
  if (auth.error && !offlineAccess) return <Auth setupRequired={false} onAuthenticated={() => void queryClient.invalidateQueries({ queryKey: ['auth'] })}/>;
  return <Auth setupRequired={auth.data?.setupRequired ?? false} onAuthenticated={() => void queryClient.invalidateQueries({ queryKey: ['auth'] })}/>;
}

function NotesApp({ offlineEntry, onLogout }: { offlineEntry: boolean; onLogout: () => void }) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ note?: LocalNote; files?: File[]; shareId?: string }>();
  const [syncState, setSyncState] = useState<SyncState>(offlineEntry ? 'offline' : 'connecting');
  const [pending, setPending] = useState(0);
  const [toast, setToast] = useState('');
  const syncing = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const syncDialog = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);
  const synchronize = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    setSyncState(navigator.onLine ? 'syncing' : 'offline');
    try {
      const result = await syncNotes();
      setNotes(result.notes); setPending(result.pending);
      setSyncState(result.pending ? 'local' : navigator.onLine ? 'synced' : 'offline');
      if (result.conflict) notify('Both versions were kept after a conflicting edit.');
    } catch (error) {
      setSyncState(error instanceof ApiError && error.status === 0 ? 'offline' : 'error');
    } finally { syncing.current = false; }
  }, [notify]);

  useEffect(() => {
    void localNotes().then(setNotes).then(synchronize);
    const online = () => void synchronize();
    const visible = () => { if (document.visibilityState === 'visible') void synchronize(); };
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void synchronize(); }, 15_000);
    addEventListener('online', online); document.addEventListener('visibilitychange', visible);
    void navigator.storage?.persist?.();
    return () => { clearInterval(interval); removeEventListener('online', online); document.removeEventListener('visibilitychange', visible); };
  }, [synchronize]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('share');
    const shareError = params.get('shareError');
    if (shareError) {
      notify(shareError === 'invalid' ? 'Choose up to 6 JPG, PNG, WebP or GIF images under 10 MB.' : 'Could not receive the shared image. Try again.');
      history.replaceState(null, '', '/');
    }
    if (!id) return;
    let active = true;
    void getShare(id).then(files => {
      if (!active) return;
      if (files?.length) setEditor({ files, shareId: id });
      else notify('The shared image is no longer available. Please share it again.');
      if (!files?.length) history.replaceState(null, '', '/');
    }).catch(() => {
      if (active) notify('Could not open the shared image. Please share it again.');
    });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,[contenteditable]')) return;
      if (document.querySelector('dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === '/') { event.preventDefault(); document.querySelector<HTMLInputElement>('#search')?.focus(); }
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); setEditor({}); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return notes.filter(note => [note.title, note.body, ...note.images.map(image => image.alt)].join(' ').toLocaleLowerCase().includes(normalized));
  }, [notes, query]);
  const pinned = filtered.filter(note => note.pinned);
  const others = filtered.filter(note => !note.pinned);

  const save = async (value: EditorValue) => {
    await saveLocalNote(value);
    setNotes(await localNotes()); setPending(count => count + 1);
    notify(value.id ? 'Note updated' : 'Note added');
    void synchronize();
  };
  const remove = async (note: LocalNote) => {
    await deleteLocalNote(note); setEditor(undefined); setNotes(await localNotes()); setPending(count => count + 1);
    notify('Note permanently deleted'); void synchronize();
  };
  const pin = async (note: LocalNote) => {
    await saveLocalNote({ ...note, pinned: !note.pinned, retainedImages: note.images, newImages: [] });
    setNotes(await localNotes()); notify(note.pinned ? 'Note unpinned' : 'Note pinned'); void synchronize();
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-pin-id="${note.id}"]`)?.focus({ preventScroll: true }));
  };
  const reorder = async (source: string, target: string) => {
    const moving = notes.find(note => note.id === source);
    if (!moving || moving.pinned !== notes.find(note => note.id === target)?.pinned) return;
    const group = notes.filter(note => note.pinned === moving.pinned);
    const from = group.findIndex(note => note.id === source);
    const to = group.findIndex(note => note.id === target);
    if (from < 0 || to < 0 || from === to) return;
    group.splice(to, 0, ...group.splice(from, 1));
    let index = 0;
    const ordered = notes.map(note => note.pinned === moving.pinned ? group[index++] : note);
    setNotes(ordered);
    try {
      await reorderLocalNotes(ordered.map(note => note.id));
      setPending(count => count + 1);
      void synchronize();
    } catch { setNotes(await localNotes()); notify('Could not reorder notes. Try again.'); }
  };
  const chooseImages = (files: FileList | null) => {
    if (!files?.length) return;
    setEditor({ files: [...files] });
  };
  const closeEditor = async () => {
    if (editor?.shareId) {
      try { await discardShare(editor.shareId); }
      catch { notify('Could not remove the temporary shared image from this device.'); }
      history.replaceState(null, '', '/');
    }
    setEditor(undefined);
  };
  const logout = async () => {
    if (pending) return notify('Wait for your notes to finish syncing before signing out.');
    await api.logout(); await clearLocalData(); await clearShares(); onLogout();
  };

  const status = syncStatus(syncState, pending);
  return <>
    <a href="#main" {...stylex.props(styles.skipLink)}>Skip to notes</a>
    <header {...stylex.props(styles.header)}><a href="/" aria-label="jot home" {...stylex.props(styles.brand)}><Brand/></a>
      <search {...stylex.props(styles.search)}><Icon name="search"/><input id="search" type="search" aria-label="Search notes" placeholder="Find a little something…" value={query} onChange={event => setQuery(event.target.value)} {...stylex.props(styles.searchInput)}/><kbd {...stylex.props(styles.searchKey)}>/</kbd></search>
      <button type="button" aria-label={status.label} onClick={() => syncDialog.current?.showModal()} {...stylex.props(styles.syncButton)}><Icon name={status.icon}/><span>{status.label}</span></button>
    </header>
    <main id="main" {...stylex.props(styles.workspace)}><section {...stylex.props(styles.pageHeading)}><h1 {...stylex.props(styles.h1)}>Your notes</h1></section>
      <div {...stylex.props(styles.capture)}><button type="button" onClick={() => setEditor({})} {...stylex.props(styles.captureText)}><Icon name="pen" {...stylex.props(styles.capturePencil)}/><span>A thought worth keeping…</span></button><span {...stylex.props(styles.divider)}/><button type="button" onClick={() => imageInput.current?.click()} {...stylex.props(styles.imageCapture)}><Icon name="image"/><span>Add an image</span></button></div>
      <div {...stylex.props(styles.toolbar)}><div {...stylex.props(styles.boardLabel)}>All notes <span {...stylex.props(styles.count)}>{filtered.length}</span></div><span {...stylex.props(styles.sort)}><Icon name="sort" width={15}/>Drag to reorder</span></div>
      {pinned.length > 0 && <NoteBoard notes={pinned} heading="Pinned" label="Pinned notes" onOpen={note => setEditor({ note })} onPin={pin} onReorder={reorder}/>}
      {others.length > 0 && <div {...stylex.props(pinned.length > 0 && styles.sectionAfter)}><NoteBoard notes={others} heading={pinned.length ? 'Other notes' : undefined} label={pinned.length ? 'Other notes' : 'Notes'} onOpen={note => setEditor({ note })} onPin={pin} onReorder={reorder}/></div>}
      {filtered.length === 0 && <section {...stylex.props(styles.empty)}><Icon name="search" width={40}/><h2>Nothing here just yet.</h2><p>{query ? 'Try another search, or make a little note.' : 'Make a little note whenever you’re ready.'}</p>{query && <button type="button" onClick={() => setQuery('')} {...stylex.props(styles.secondary)}>Clear search</button>}</section>}
    </main>
    <nav aria-label="Create a note" {...stylex.props(styles.mobileCapture)}><button type="button" aria-label="Add an image" onClick={() => imageInput.current?.click()} {...stylex.props(styles.mobileButton)}><Icon name="image"/></button><span {...stylex.props(styles.mobileDivider)}/><button type="button" onClick={() => setEditor({})} {...stylex.props(styles.mobileButton)}><Icon name="plus"/>New note</button></nav>
    <input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={event => { chooseImages(event.target.files); event.target.value = ''; }}/>
    {editor && <Editor note={editor.note} initialImages={editor.files} onSave={save} onDelete={remove} onClose={closeEditor}/>}
    <dialog ref={syncDialog} aria-labelledby="sync-title" {...stylex.props(styles.dialog, styles.smallDialog)}><Icon name={status.icon} width={32}/><h2 id="sync-title" {...stylex.props(styles.dialogTitle)}>{status.label}</h2><p {...stylex.props(styles.dialogCopy)}>{status.copy}</p><div {...stylex.props(styles.dialogActions)}><button type="button" onClick={logout} {...stylex.props(styles.secondary)}>Sign out</button><button type="button" onClick={() => { syncDialog.current?.close(); void synchronize(); }} {...stylex.props(styles.primary)}>Sync now</button></div></dialog>
    {toast && <div role="status" {...stylex.props(styles.toast)}>{toast}</div>}
  </>;
}

function syncStatus(state: SyncState, pending: number): { label: string; copy: string; icon: 'offline' | 'cloud-check' | 'refresh' } {
  if (state === 'syncing' || state === 'connecting') return { label: 'Syncing…', copy: 'Checking your server for changes.', icon: 'refresh' };
  if (state === 'offline') return { label: pending ? 'Saved on device' : 'Offline', copy: pending ? `${pending} change${pending === 1 ? '' : 's'} will sync when jot. is open and connected.` : 'Your downloaded notes remain available on this device.', icon: 'offline' };
  if (state === 'local' || pending) return { label: 'Saved on device', copy: `${pending} change${pending === 1 ? '' : 's'} still need${pending === 1 ? 's' : ''} to reach your server.`, icon: 'refresh' };
  if (state === 'error') return { label: 'Sync needs attention', copy: 'Your notes are safe on this device. Try syncing again.', icon: 'offline' };
  return { label: 'Synced', copy: 'This device and your server are up to date.', icon: 'cloud-check' };
}

function Loading() { return <main {...stylex.props(styles.loginPage)}><p>Opening jot…</p></main>; }
