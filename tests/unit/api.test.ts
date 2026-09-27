import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request, { type Agent } from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/server/app';
import { openDatabase, type AppDatabase } from '../../src/server/database';
import type { Environment } from '../../src/shared/contracts';

let directory: string;
let database: AppDatabase;
let app: Express;
let agent: Agent;
const password = 'correct horse battery staple';

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jot-test-'));
  const environment: Environment = { NODE_ENV: 'test', PORT: 3000, DATA_DIR: directory, SESSION_DAYS: 30 };
  database = openDatabase(environment);
  app = createApp(database, environment);
  agent = request.agent(app);
});
afterEach(async () => { database.close(); await rm(directory, { recursive: true, force: true }); });

async function setup() {
  const response = await agent.post('/api/auth/setup').send({ password });
  expect(response.status).toBe(201);
}

describe('authentication gates', () => {
  it('sets up exactly one owner and stores an opaque server-side session', async () => {
    expect((await agent.get('/api/auth/status')).body).toEqual({ authenticated: false, setupRequired: true });
    expect((await agent.post('/api/auth/setup').send({ password: 'short' })).status).toBe(400);
    const setupResponse = await agent.post('/api/auth/setup').send({ password });
    expect(setupResponse.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(setupResponse.headers['set-cookie'][0]).toContain('SameSite=Strict');
    expect(database.prepare('SELECT password_hash FROM owner').get()).not.toMatchObject({ password_hash: password });
    expect(database.prepare('SELECT count(*) AS count FROM sessions').get()).toEqual({ count: 1 });
    expect((await agent.post('/api/auth/setup').send({ password })).status).toBe(409);
    expect((await agent.get('/api/auth/status')).body.authenticated).toBe(true);
  });

  it('rejects unauthenticated, incorrect, and cross-site requests', async () => {
    expect((await request(app).get('/api/notes')).status).toBe(401);
    await setup();
    expect((await request(app).post('/api/auth/login').send({ password: `${password}!` })).status).toBe(401);
    expect((await agent.post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  });
});

describe('notes API', () => {
  it('validates, creates, updates, detects conflicts, and deletes a note', async () => {
    await setup();
    const id = crypto.randomUUID();
    const payload = { id, title: 'A note', body: 'Hello', color: 'mint', pinned: true, expectedVersion: 0, retainedImageIds: [] };
    expect((await agent.put(`/api/notes/${id}`).field('payload', JSON.stringify({ ...payload, color: 'blue' }))).status).toBe(400);
    const created = await agent.put(`/api/notes/${id}`).field('payload', JSON.stringify(payload));
    expect(created.status).toBe(201);
    expect(created.body.note).toMatchObject({ id, title: 'A note', version: 1, pinned: true });
    const updated = await agent.put(`/api/notes/${id}`).field('payload', JSON.stringify({ ...payload, title: 'Updated', expectedVersion: 1 }));
    expect(updated.body.note).toMatchObject({ title: 'Updated', version: 2 });
    const conflict = await agent.put(`/api/notes/${id}`).field('payload', JSON.stringify({ ...payload, expectedVersion: 1 }));
    expect(conflict.status).toBe(409);
    expect(conflict.body.note.version).toBe(2);
    expect((await agent.delete(`/api/notes/${id}`).send({ expectedVersion: 1 })).status).toBe(409);
    expect((await agent.delete(`/api/notes/${id}`).send({ expectedVersion: 2 })).status).toBe(204);
    expect((await agent.get('/api/notes')).body.notes).toEqual([]);
  });

  it('rejects files whose bytes do not match an accepted image format', async () => {
    await setup();
    const id = crypto.randomUUID();
    const payload = { id, title: '', body: '', color: 'paper', pinned: false, expectedVersion: 0, retainedImageIds: [] };
    const response = await agent.put(`/api/notes/${id}`).field('payload', JSON.stringify(payload)).attach('images', Buffer.from('<svg/>'), { filename: 'fake.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('JPG');
  });
});
