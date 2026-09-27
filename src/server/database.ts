import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment, Note } from '../shared/contracts.js';

export type AppDatabase = Database.Database;

export function openDatabase(environment: Environment): AppDatabase {
  mkdirSync(environment.DATA_DIR, { recursive: true, mode: 0o700 });
  const database = new Database(join(environment.DATA_DIR, 'jot.sqlite'));
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  database.exec(`
    CREATE TABLE IF NOT EXISTS owner (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      color TEXT NOT NULL CHECK (color IN ('paper','butter','mint','lilac','peach')),
      pinned INTEGER NOT NULL CHECK (pinned IN (0,1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      version INTEGER NOT NULL CHECK (version > 0)
    );
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      filename TEXT NOT NULL UNIQUE,
      alt TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      size INTEGER NOT NULL,
      position INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS images_note ON images(note_id, position);
  `);
  database.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date().toISOString());
  return database;
}

type NoteRow = {
  id: string; title: string; body: string; color: Note['color']; pinned: number;
  created_at: string; updated_at: string; version: number;
};
type ImageRow = {
  id: string; note_id: string; filename: string; alt: string; mime_type: Note['images'][number]['mimeType'];
  width: number; height: number; size: number; position: number;
};

export function readNote(database: AppDatabase, id: string): Note | undefined {
  const row = database.prepare('SELECT * FROM notes WHERE id = ?').get(id) as NoteRow | undefined;
  if (!row) return undefined;
  const images = database.prepare('SELECT * FROM images WHERE note_id = ? ORDER BY position').all(id) as ImageRow[];
  return mapNote(row, images);
}

export function readNotes(database: AppDatabase): Note[] {
  const notes = database.prepare('SELECT * FROM notes ORDER BY updated_at DESC, id ASC').all() as NoteRow[];
  const images = database.prepare('SELECT * FROM images ORDER BY note_id, position').all() as ImageRow[];
  const byNote = new Map<string, ImageRow[]>();
  for (const image of images) byNote.set(image.note_id, [...(byNote.get(image.note_id) ?? []), image]);
  return notes.map(note => mapNote(note, byNote.get(note.id) ?? []));
}

function mapNote(row: NoteRow, images: ImageRow[]): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    color: row.color,
    pinned: Boolean(row.pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    images: images.map(image => ({
      id: image.id,
      url: `/api/images/${image.id}`,
      alt: image.alt,
      mimeType: image.mime_type,
      width: image.width,
      height: image.height,
      size: image.size,
    })),
  };
}
