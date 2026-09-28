import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { fileTypeFromBuffer } from 'file-type';
import helmet from 'helmet';
import multer from 'multer';
import sharp from 'sharp';
import { ZodError } from 'zod';
import {
  authStatusSchema, credentialsSchema, deleteNoteSchema, noteIdParamsSchema, noteWriteSchema, reorderNotesSchema,
  type Environment,
} from '../shared/contracts.js';
import { createOwner, createSession, destroySession, hasOwner, isAuthenticated, requireAuthentication, verifyOwner } from './auth.js';
import { type AppDatabase, readNote, readNotes } from './database.js';

const acceptedTypes = new Map([
  ['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif'],
]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 6, fields: 2 },
});

export function createApp(database: AppDatabase, environment: Environment) {
  const app = express();
  const imageDirectory = join(environment.DATA_DIR, 'images');
  mkdirSync(imageDirectory, { recursive: true, mode: 0o700 });

  app.set('trust proxy', 'loopback');
  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'blob:', 'data:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    strictTransportSecurity: environment.NODE_ENV === 'production' ? { maxAge: 300 } : false,
  }));
  app.use((_request, response, next) => {
    response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', rejectCrossSiteRequests);

  const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
  app.get('/api/auth/status', (request, response) => {
    response.json(authStatusSchema.parse({ authenticated: isAuthenticated(database, request), setupRequired: !hasOwner(database) }));
  });
  app.post('/api/auth/setup', authLimiter, async (request, response) => {
    if (hasOwner(database)) return response.status(409).json({ error: 'Owner setup is already complete.' });
    const { password } = credentialsSchema.parse(request.body);
    try {
      await createOwner(database, password);
    } catch (error) {
      if (hasOwner(database)) return response.status(409).json({ error: 'Owner setup is already complete.' });
      throw error;
    }
    createSession(database, environment, response, environment.NODE_ENV === 'production' || request.secure);
    response.status(201).json({ ok: true });
  });
  app.post('/api/auth/login', authLimiter, async (request, response) => {
    const { password } = credentialsSchema.parse(request.body);
    if (!(await verifyOwner(database, password))) return response.status(401).json({ error: 'Incorrect password.' });
    createSession(database, environment, response, environment.NODE_ENV === 'production' || request.secure);
    response.json({ ok: true });
  });
  app.post('/api/auth/logout', (request, response) => {
    destroySession(database, request, response);
    response.setHeader('Clear-Site-Data', '"cookies"');
    response.json({ ok: true });
  });

  app.use('/api', requireAuthentication(database));
  app.get('/api/notes', (_request, response) => response.json({ notes: readNotes(database) }));
  app.put('/api/notes/order', (request, response) => {
    const { ids } = reorderNotesSchema.parse(request.body);
    const existing = readNotes(database).map(note => note.id);
    const known = new Set(existing);
    if (ids.some(id => !known.has(id))) return response.status(409).json({ error: 'The notes changed. Try reordering again.' });
    const ordered = [...ids, ...existing.filter(id => !ids.includes(id))];
    const update = database.prepare('UPDATE notes SET position = ? WHERE id = ?');
    database.transaction(() => ordered.forEach((id, index) => update.run(index, id)))();
    response.json({ ok: true });
  });
  app.get('/api/images/:id', (request, response) => {
    const { id } = noteIdParamsSchema.parse(request.params);
    const image = database.prepare('SELECT filename, mime_type FROM images WHERE id = ?').get(id) as { filename: string; mime_type: string } | undefined;
    if (!image) return response.status(404).json({ error: 'Image not found.' });
    response.type(image.mime_type).sendFile(image.filename, { root: imageDirectory, dotfiles: 'deny' });
  });

  app.put('/api/notes/:id', upload.array('images', 6), async (request, response) => {
    const { id } = noteIdParamsSchema.parse(request.params);
    const files = (request.files ?? []) as Express.Multer.File[];
    let rawPayload: unknown;
    try { rawPayload = JSON.parse(String(request.body.payload)); }
    catch { return response.status(400).json({ error: 'Invalid note payload.' }); }
    const input = noteWriteSchema.parse(rawPayload);
    if (input.id !== id) return response.status(400).json({ error: 'Note ID does not match the URL.' });
    if (input.retainedImageIds.length + files.length > 6) return response.status(400).json({ error: 'Up to 6 images per note.' });

    const current = readNote(database, id);
    if (!current && !input.title && !input.body && input.retainedImageIds.length + files.length === 0) {
      return response.status(400).json({ error: 'Add some text or an image first.' });
    }
    if ((current?.version ?? 0) !== input.expectedVersion) {
      return response.status(409).json({ error: 'This note changed on another device.', note: current });
    }
    const retained = new Set(input.retainedImageIds);
    if ([...retained].some(imageId => !current?.images.some(image => image.id === imageId))) {
      return response.status(400).json({ error: 'An attached image does not belong to this note.' });
    }

    const prepared: { id: string; filename: string; alt: string; mimeType: string; width: number; height: number; size: number }[] = [];
    const writtenPaths: string[] = [];
    try {
      for (const file of files) {
        const detected = await fileTypeFromBuffer(file.buffer);
        const extension = detected && acceptedTypes.get(detected.mime);
        if (!extension) throw new ClientError('Choose a JPG, PNG, WebP or GIF image.');
        const metadata = await sharp(file.buffer, { animated: true, limitInputPixels: 40_000_000 }).metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        if (!width || !height || width * height * (metadata.pages ?? 1) > 40_000_000) throw new ClientError('Images may contain up to 40 megapixels.');
        const imageId = randomUUID();
        const filename = `${imageId}.${extension}`;
        const path = join(imageDirectory, filename);
        await writeFile(path, file.buffer, { mode: 0o600, flag: 'wx' });
        writtenPaths.push(path);
        prepared.push({ id: imageId, filename, alt: file.originalname.slice(0, 500), mimeType: detected.mime, width, height, size: file.size });
      }

      const now = new Date().toISOString();
      const removedFiles = database.transaction(() => {
        if (current) {
          database.prepare('UPDATE notes SET title=?, body=?, color=?, pinned=?, updated_at=?, version=version+1 WHERE id=?')
            .run(input.title, input.body, input.color, Number(input.pinned), now, id);
        } else {
          const first = database.prepare('SELECT MIN(position) AS position FROM notes').get() as { position: number | null };
          database.prepare('INSERT INTO notes (id,title,body,color,pinned,created_at,updated_at,version,position) VALUES (?,?,?,?,?,?,?,1,?)')
            .run(id, input.title, input.body, input.color, Number(input.pinned), now, now, (first.position ?? 0) - 1);
        }
        const oldImages = database.prepare('SELECT id, filename FROM images WHERE note_id=?').all(id) as { id: string; filename: string }[];
        const removed = oldImages.filter(image => !retained.has(image.id));
        for (const image of removed) database.prepare('DELETE FROM images WHERE id=?').run(image.id);
        let position = 0;
        for (const imageId of input.retainedImageIds) database.prepare('UPDATE images SET position=? WHERE id=?').run(position++, imageId);
        for (const image of prepared) {
          database.prepare('INSERT INTO images (id,note_id,filename,alt,mime_type,width,height,size,position) VALUES (?,?,?,?,?,?,?,?,?)')
            .run(image.id, id, image.filename, image.alt, image.mimeType, image.width, image.height, image.size, position++);
        }
        return removed.map(image => join(imageDirectory, image.filename));
      })();
      await Promise.all(removedFiles.map(path => rm(path, { force: true }))).catch(error => console.error('Could not remove replaced image files.', error));
      response.status(current ? 200 : 201).json({ note: readNote(database, id) });
    } catch (error) {
      await Promise.all(writtenPaths.map(path => rm(path, { force: true })));
      throw error;
    }
  });

  app.delete('/api/notes/:id', (request, response) => {
    const { id } = noteIdParamsSchema.parse(request.params);
    const { expectedVersion } = deleteNoteSchema.parse(request.body);
    const current = readNote(database, id);
    if (!current) return response.status(204).end();
    if (current.version !== expectedVersion) return response.status(409).json({ error: 'This note changed on another device.', note: current });
    const filenames = database.prepare('SELECT filename FROM images WHERE note_id=?').all(id) as { filename: string }[];
    database.prepare('DELETE FROM notes WHERE id=?').run(id);
    void Promise.all(filenames.map(file => rm(join(imageDirectory, file.filename), { force: true })))
      .catch(error => console.error('Could not remove deleted image files.', error));
    response.status(204).end();
  });

  app.use('/api', (_request, response) => response.status(404).json({ error: 'Not found.' }));
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof ClientError) return response.status(400).json({ error: error.message });
    if (error instanceof ZodError) return response.status(400).json({ error: 'Invalid request.', issues: error.issues });
    if (error instanceof multer.MulterError) return response.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Images must be under 10 MB.' : error.message });
    console.error(error);
    response.status(500).json({ error: 'Something went wrong.' });
  });
  return app;
}

function rejectCrossSiteRequests(request: Request, response: Response, next: NextFunction) {
  response.vary('Sec-Fetch-Site');
  if (request.get('Sec-Fetch-Site') === 'cross-site') return response.status(403).json({ error: 'Cross-site requests are not allowed.' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('Origin');
    const host = request.get('host');
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (!host || !['http:', 'https:'].includes(originUrl.protocol) || originUrl.host.toLowerCase() !== host.toLowerCase()) {
          return response.status(403).json({ error: 'Request origin is not allowed.' });
        }
      } catch {
        return response.status(403).json({ error: 'Request origin is not allowed.' });
      }
    }
  }
  next();
}

class ClientError extends Error {}
