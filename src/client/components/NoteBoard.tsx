import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LocalImage, LocalNote } from '../local-store';
import { imageSource } from '../local-store';
import { styles } from '../app.stylex';
import { Icon } from './Icon';

export function NoteBoard({ notes, heading, label, onOpen, onPin, onReorder }: {
  notes: LocalNote[]; heading?: string; label: string;
  onOpen: (note: LocalNote) => void; onPin: (note: LocalNote) => void;
  onReorder: (source: string, target: string) => void;
}) {
  const board = useRef<HTMLUListElement>(null);
  const drag = useRef<{ source: string; target?: string; startX: number; startY: number } | null>(null);
  const [target, setTarget] = useState<string>();
  useMasonry(board, notes);
  const start = (event: React.PointerEvent, id: string) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { source: id, startX: event.clientX, startY: event.clientY };
  };
  const noteAt = (event: React.PointerEvent) => {
    const item = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-item-id]');
    return item && board.current?.contains(item) ? item.dataset.itemId : undefined;
  };
  const move = (event: React.PointerEvent) => {
    const active = drag.current;
    if (!active) return;
    if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 6 && !active.target) return;
    const id = noteAt(event);
    active.target = id !== active.source ? id : undefined;
    setTarget(active.target);
  };
  const end = (event: React.PointerEvent) => {
    const active = drag.current;
    drag.current = null; setTarget(undefined);
    const id = noteAt(event);
    if (active && id && id !== active.source) onReorder(active.source, id);
  };
  return <section {...stylex.props(styles.section)}>
    {heading && <h2 {...stylex.props(styles.sectionHeading)}>{heading}</h2>}
    <ul ref={board} aria-label={label} {...stylex.props(styles.board)}>
      {notes.map((note, index) => <NoteCard key={note.id} note={note} onOpen={onOpen} onPin={onPin} dropTarget={target === note.id}
        onPointerDown={event => start(event, note.id)} onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setTarget(undefined); }}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowUp' && event.key !== 'ArrowRight' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          const next = notes[index + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1)];
          if (next) onReorder(note.id, next.id);
        }}/>) }
    </ul>
  </section>;
}

function NoteCard({ note, onOpen, onPin, dropTarget, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown }: {
  note: LocalNote; onOpen: (note: LocalNote) => void; onPin: (note: LocalNote) => void; dropTarget: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void; onPointerCancel: () => void; onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const image = note.images[0];
  return <li data-item-id={note.id} {...stylex.props(styles.noteItem, dropTarget && styles.dropTarget)}>
    <button type="button" data-note-id={note.id} aria-label={`Open note: ${note.title || note.body || image?.alt || 'Image note'}`} onClick={() => onOpen(note)} {...stylex.props(styles.noteCard, styles[note.color])}>
      {image && <LocalPhoto image={image}/>} 
      {note.images.length > 1 && <span {...stylex.props(styles.imageNumber)}><Icon name="image" width={14}/>{note.images.length}</span>}
      <span {...stylex.props(styles.noteContent, image && styles.imageContent)}>
        {note.title && <span {...stylex.props(styles.noteTitle)}>{note.title}</span>}
        {note.body && <span {...stylex.props(styles.noteBody)}>{note.body}</span>}
        <time dateTime={note.updatedAt} {...stylex.props(styles.noteDate)}>{formatDate(note.updatedAt)}</time>
      </span>
    </button>
    <button type="button" aria-label={`Move note: ${note.title || note.body || 'Image note'}. Drag or use arrow keys`} title="Drag to reorder · arrow keys to move" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onKeyDown={onKeyDown} {...stylex.props(styles.dragHandle)}>⠿</button>
    <button type="button" data-pin-id={note.id} aria-label={`${note.pinned ? 'Unpin' : 'Pin'} note: ${note.title || note.body || 'Image note'}`} aria-pressed={note.pinned} title={note.pinned ? 'Unpin note' : 'Pin note'} onClick={() => onPin(note)} {...stylex.props(styles.pin, note.pinned ? styles.pinned : styles.pinHiddenDesktop)}><Icon name="pin" width={18}/></button>
  </li>;
}

export function LocalPhoto({ image, className }: { image: LocalImage; className?: string }) {
  const [source, setSource] = useState(image.url);
  useEffect(() => {
    let objectUrl = '';
    let active = true;
    void imageSource(image).then(url => {
      if (image.blobId) objectUrl = url;
      if (active) setSource(url);
      else if (objectUrl) URL.revokeObjectURL(objectUrl);
    });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image]);
  return <img src={source} alt={image.alt} width={image.width} height={image.height} className={className} {...(!className ? stylex.props(styles.photo) : {})}/>;
}

function useMasonry(ref: React.RefObject<HTMLUListElement | null>, notes: LocalNote[]) {
  useLayoutEffect(() => {
    const board = ref.current;
    if (!board) return;
    const layout = () => {
      const columns = Number(getComputedStyle(board).getPropertyValue('--columns')) || 4;
      const heights = Array(columns).fill(0) as number[];
      const gap = innerWidth <= 700 ? 12 : innerWidth <= 1100 ? 16 : 20;
      for (const item of board.children) {
        const element = item as HTMLElement;
        const column = heights.indexOf(Math.min(...heights));
        const height = Math.ceil(element.firstElementChild!.getBoundingClientRect().height);
        element.style.gridColumn = String(column + 1);
        element.style.gridRow = `${heights[column] + 1} / span ${height + gap}`;
        heights[column] += height + gap;
      }
    };
    const observer = new ResizeObserver(layout);
    observer.observe(board);
    board.querySelectorAll('img').forEach(image => image.addEventListener('load', layout));
    requestAnimationFrame(layout);
    return () => observer.disconnect();
  }, [ref, notes]);
}

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? `Today, ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)}`
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
