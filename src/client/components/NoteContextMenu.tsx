import * as stylex from '@stylexjs/stylex';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { LocalNote } from '../local-store';
import { styles } from '../app.stylex';

export type MenuTarget = { note: LocalNote; x: number; y: number; origin: HTMLElement };

export function NoteContextMenu({ target, onClose, onOpen, onPin, onDelete }: {
  target: MenuTarget;
  onClose: () => void;
  onOpen: (note: LocalNote) => void;
  onPin: (note: LocalNote) => void;
  onDelete: (note: LocalNote) => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(target.x, innerWidth - rect.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(target.y, innerHeight - rect.height - 8))}px`;
    element.querySelector('button')?.focus();
  }, [target]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); target.origin.focus({ preventScroll: true }); }
    };
    const resize = () => onClose();
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', resize);
    };
  }, [onClose, target]);
  const choose = (action: (note: LocalNote) => void) => { onClose(); action(target.note); };
  return <div ref={menu} role="menu" aria-label="Note actions" {...stylex.props(styles.contextMenu)} style={{ left: target.x, top: target.y }} onKeyDown={event => {
    const buttons = Array.from(menu.current?.querySelectorAll('button') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
  }}>
    <button type="button" role="menuitem" onClick={() => choose(onDelete)} {...stylex.props(styles.contextMenuDanger)}>Delete</button>
    <button type="button" role="menuitem" onClick={() => choose(onPin)} {...stylex.props(styles.contextMenuItem)}>{target.note.pinned ? 'Unpin' : 'Pin'}</button>
    <button type="button" role="menuitem" onClick={() => choose(onOpen)} {...stylex.props(styles.contextMenuItem)}>Open</button>
  </div>;
}
