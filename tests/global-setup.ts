import { request, type FullConfig } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL as string;
  const context = await request.newContext({ baseURL });
  const password = 'correct horse battery staple';
  const status = await context.get('/api/auth/status');
  const body = await status.json() as { setupRequired: boolean };
  const response = await context.post(body.setupRequired ? '/api/auth/setup' : '/api/auth/login', { data: { password } });
  if (!response.ok()) throw new Error(`Could not prepare authenticated test session: ${response.status()} ${await response.text()}`);
  await mkdir('.auth', { recursive: true });
  await context.storageState({ path: '.auth/user.json' });
  await context.dispose();
}
