import { execFileSync } from 'node:child_process';

export default function globalSetup() {
  // Build once; each E2E test starts its own server against this immutable bundle.
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
}
