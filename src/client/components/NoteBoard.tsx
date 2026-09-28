import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LocalImage, LocalNote } from '../local-store';
import { imageSource } from '../local-store';
import { styles } from '../app.stylex';
import { Icon } from './Icon';

export function NoteBoard({ notes, heading, label, onOpen, onPin }: {
  notes: LocalNote[]; heading?: string; label: string;
  onOpen: (note: LocalNote) => void; onPin: (note: LocalNote) => void;
}) {
  const board = useRef<HTMLUListElement>(null);
  useMasonry(board, notes);
  return <section {...stylex.props(styles.section)}>
    {heading && <h2 {...stylex.props(styles.sectionHeading)}>{heading}</h2>}
    <ul ref={board} aria-label={label} {...stylex.props(styles.board)}>
      {notes.map(note => <NoteCard key={note.id} note={note} onOpen={onOpen} onPin={onPin}/>) }
    </ul>
  </section>;
}

function NoteCard({ note, onOpen, onPin }: { note: LocalNote; onOpen: (note: LocalNote) => void; onPin: (note: LocalNote) => void }) {
  const image = note.images[0];
  return <li {...stylex.props(styles.noteItem)}>
    <button type="button" data-note-id={note.id} aria-label={`Open note: ${note.title || note.body || image?.alt || 'Image note'}`} onClick={() => onOpen(note)} {...stylex.props(styles.noteCard, styles[note.color])}>
      {image && <LocalPhoto image={image}/>} 
      {note.images.length > 1 && <span {...stylex.props(styles.imageNumber)}><Icon name="image" width={14}/>{note.images.length}</span>}
      <span {...stylex.props(styles.noteContent, image && styles.imageContent)}>
        {note.title && <span {...stylex.props(styles.noteTitle)}>{note.title}</span>}
        {note.body && <span {...stylex.props(styles.noteBody)}>{note.body}</span>}
        <time dateTime={note.updatedAt} {...stylex.props(styles.noteDate)}>{formatDate(note.updatedAt)}</time>
      </span>
    </button>
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
