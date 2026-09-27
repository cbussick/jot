import { openDB } from 'idb';
import { z } from 'zod';
import { imageSchema, noteSchema, type Note, type NoteColor, type NoteImage } from '../shared/contracts';
import { api, ApiError, conflictResponseSchema } from './api';

export type LocalImage = NoteImage & { blobId?: string };
export type LocalNote = Omit<Note, 'images' | 'version'> & { images: LocalImage[]; version: number };
type OutboxEntry = { noteId: string; type: 'save' | 'delete'; expectedVersion: number; mutationId: string };
const localImageSchema = imageSchema.extend({ url: z.string(), blobId: z.string().optional() });
const localNoteSchema = noteSchema.omit({ images: true, version: true }).extend({ images: z.array(localImageSchema).max(6), version: z.number().int().nonnegative() });
const outboxSchema = z.object({ noteId: z.uuid(), type: z.enum(['save', 'delete']), expectedVersion: z.number().int().nonnegative(), mutationId: z.uuid() });
const parseNote = (value: unknown) => localNoteSchema.parse(value) as LocalNote;
const parseOperation = (value: unknown) => outboxSchema.parse(value) as OutboxEntry;
const parseOptionalNote = (value: unknown) => value === undefined ? undefined : parseNote(value);
const parseOptionalOperation = (value: unknown) => value === undefined ? undefined : parseOperation(value);
const parseBlob = (value: unknown) => z.instanceof(Blob).parse(value);

const databasePromise = openDB('jot', 1, {
  upgrade(database) {
    database.createObjectStore('notes', { keyPath: 'id' });
    database.createObjectStore('outbox', { keyPath: 'noteId' });
    database.createObjectStore('blobs');
    database.createObjectStore('meta');
  },
});

export async function localNotes(): Promise<LocalNote[]> {
  const database = await databasePromise;
  const notes = z.array(localNoteSchema).parse(await database.getAll('notes')) as LocalNote[];
  return notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function hasLocalData(): Promise<boolean> {
  return z.boolean().catch(false).parse(await (await databasePromise).get('meta', 'initialized'));
}

export async function clearLocalData(): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['notes', 'outbox', 'blobs', 'meta'], 'readwrite');
  await Promise.all(['notes', 'outbox', 'blobs', 'meta'].map(name => transaction.objectStore(name).clear()));
  await transaction.done;
}

export async function saveLocalNote(value: {
  id?: string; title: string; body: string; color: NoteColor; pinned: boolean;
  retainedImages: LocalImage[]; newImages: File[]; version?: number; createdAt?: string;
}): Promise<LocalNote> {
  const database = await databasePromise;
  const now = new Date().toISOString();
  const id = value.id ?? crypto.randomUUID();
  const current = parseOptionalNote(await database.get('notes', id));
  const images = [...value.retainedImages];
  for (const file of value.newImages) {
    const dimensions = await imageDimensions(file);
    if (dimensions.width * dimensions.height > 40_000_000) throw new Error('Images may contain up to 40 megapixels.');
    const imageId = crypto.randomUUID();
    const blobId = `blob:${imageId}`;
    await database.put('blobs', file, blobId);
    images.push({ id: imageId, blobId, url: '', alt: file.name, mimeType: file.type as LocalImage['mimeType'], size: file.size, ...dimensions });
  }
  const note: LocalNote = {
    id, title: value.title, body: value.body, color: value.color, pinned: value.pinned,
    createdAt: value.createdAt ?? current?.createdAt ?? now,
    updatedAt: now,
    version: value.version ?? current?.version ?? 0,
    images,
  };
  const existingOperation = parseOptionalOperation(await database.get('outbox', id));
  const transaction = database.transaction(['notes', 'outbox', 'meta'], 'readwrite');
  await transaction.objectStore('notes').put(note);
  await transaction.objectStore('outbox').put({ noteId: id, type: 'save', expectedVersion: existingOperation?.expectedVersion ?? note.version, mutationId: crypto.randomUUID() });
  await transaction.objectStore('meta').put(true, 'initialized');
  await transaction.done;
  return note;
}

export async function deleteLocalNote(note: LocalNote): Promise<void> {
  const database = await databasePromise;
  const transaction = database.transaction(['notes', 'outbox'], 'readwrite');
  await transaction.objectStore('notes').delete(note.id);
  if (note.version === 0) await transaction.objectStore('outbox').delete(note.id);
  else await transaction.objectStore('outbox').put({ noteId: note.id, type: 'delete', expectedVersion: note.version, mutationId: crypto.randomUUID() });
  await transaction.done;
  await removeBlobs(note);
}

export async function syncNotes(): Promise<{ notes: LocalNote[]; pending: number; conflict: boolean }> {
  const database = await databasePromise;
  const entries = z.array(outboxSchema).parse(await database.getAll('outbox')) as OutboxEntry[];
  let conflict = false;
  for (const entry of entries) {
    const note = parseOptionalNote(await database.get('notes', entry.noteId));
    try {
      if (entry.type === 'delete') {
        await api.deleteNote(entry.noteId, entry.expectedVersion);
      } else if (note) {
        const localImages = note.images.filter(image => image.blobId);
        const files = await Promise.all(localImages.map(async image => {
          const blob = parseBlob(await database.get('blobs', image.blobId!));
          return new File([blob], image.alt || 'image', { type: image.mimeType });
        }));
        const retainedImageIds = note.images.filter(image => !image.blobId).map(image => image.id);
        const result = await api.saveNote({
          id: note.id, title: note.title, body: note.body, color: note.color, pinned: note.pinned,
          expectedVersion: entry.expectedVersion,
          retainedImageIds,
        }, files);
        const latestOperation = parseOptionalOperation(await database.get('outbox', entry.noteId));
        if (latestOperation?.mutationId !== entry.mutationId) {
          if (latestOperation?.type === 'save') {
            const latest = parseNote(await database.get('notes', entry.noteId));
            const uploadedByBlob = new Map(localImages.map((image, index) => [image.blobId!, result.note.images[retainedImageIds.length + index]]));
            latest.images = latest.images.map(image => image.blobId && uploadedByBlob.get(image.blobId) ? uploadedByBlob.get(image.blobId)! : image);
            latest.version = result.note.version;
            await database.put('notes', latest);
          }
          if (latestOperation) await database.put('outbox', { ...latestOperation, expectedVersion: result.note.version });
          await removeBlobs(note);
          continue;
        }
        await removeBlobs(note);
        await database.put('notes', result.note);
      }
      const latestOperation = parseOptionalOperation(await database.get('outbox', entry.noteId));
      if (latestOperation?.mutationId === entry.mutationId) await database.delete('outbox', entry.noteId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409 && note && entry.type === 'save') {
        conflict = true;
        const parsed = conflictResponseSchema.safeParse(error.body);
        const serverNote = parsed.success ? parsed.data.note : undefined;
        const conflictCopy = await cloneAsConflict(note);
        await database.delete('outbox', entry.noteId);
        if (serverNote) await database.put('notes', serverNote);
        await database.put('notes', conflictCopy.note);
        await database.put('outbox', conflictCopy.operation);
        continue;
      }
      if (error instanceof ApiError && error.status === 409 && entry.type === 'delete') {
        conflict = true;
        await database.delete('outbox', entry.noteId);
        continue;
      }
      if (error instanceof ApiError && (error.status === 0 || error.status === 401)) break;
      throw error;
    }
  }

  try {
    const remote = await api.notes();
    const pending = new Set((z.array(outboxSchema).parse(await database.getAll('outbox')) as OutboxEntry[]).map(item => item.noteId));
    const remoteIds = new Set(remote.notes.map(note => note.id));
    const transaction = database.transaction(['notes', 'meta'], 'readwrite');
    for (const note of remote.notes) if (!pending.has(note.id)) await transaction.objectStore('notes').put(note);
    for (const local of z.array(localNoteSchema).parse(await transaction.objectStore('notes').getAll()) as LocalNote[]) {
      if (local.version > 0 && !pending.has(local.id) && !remoteIds.has(local.id)) await transaction.objectStore('notes').delete(local.id);
    }
    await transaction.objectStore('meta').put(true, 'initialized');
    await transaction.done;
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 0 || error.status === 401))) throw error;
  }
  return { notes: await localNotes(), pending: (await database.count('outbox')), conflict };
}

export async function imageSource(image: LocalImage): Promise<string> {
  if (!image.blobId) return image.url;
  const blob = parseBlob(await (await databasePromise).get('blobs', image.blobId));
  return URL.createObjectURL(blob);
}

async function cloneAsConflict(note: LocalNote) {
  const database = await databasePromise;
  const id = crypto.randomUUID();
  const images: LocalImage[] = [];
  for (const image of note.images) {
    let blob: Blob;
    if (image.blobId) blob = parseBlob(await database.get('blobs', image.blobId));
    else blob = await fetch(image.url).then(response => response.blob());
    const imageId = crypto.randomUUID();
    const blobId = `blob:${imageId}`;
    await database.put('blobs', blob, blobId);
    images.push({ ...image, id: imageId, url: '', blobId });
  }
  const now = new Date().toISOString();
  const copy: LocalNote = { ...note, id, title: `${note.title || 'Untitled'} (conflict copy)`, images, version: 0, createdAt: now, updatedAt: now };
  return { note: copy, operation: { noteId: id, type: 'save' as const, expectedVersion: 0, mutationId: crypto.randomUUID() } };
}

async function removeBlobs(note: LocalNote) {
  const database = await databasePromise;
  await Promise.all(note.images.flatMap(image => image.blobId ? [database.delete('blobs', image.blobId)] : []));
}

async function imageDimensions(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}
