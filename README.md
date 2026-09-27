# jot.

A small, private, self-hosted notes app for text and images. It is designed for one owner and works across desktop, tablet, and phone.

## Stack

- React, TypeScript, Vite, StyleX, and TanStack Query
- Express and TypeScript
- SQLite for notes, sessions, and image metadata
- Filesystem storage for image bytes
- Zod parsing at environment, HTTP, browser-storage, and API boundaries
- IndexedDB and a service worker for local-first editing and offline startup
- Docker Compose for deployment

## What it supports

- Create, edit, search, pin, color, and permanently delete notes
- Up to six JPG, PNG, WebP, or GIF images per note
- Local-first saving with an honest sync status
- Offline startup after the first successful visit
- Offline note creation and editing; queued changes sync while jot. is open and connected
- Conflict protection that preserves the local edit as a conflict copy
- Installable PWA on supported browsers and operating systems
- One owner password with revocable, server-side sessions

The app deliberately has no labels, checklists, archive, reminders, trash, sharing, or multi-user administration.

## Run locally

Requirements: Node.js 24+ and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:4273`. The first visit asks you to create the owner password. Development data is written to `./data`.

Useful checks:

```bash
npm run typecheck
npm test
npm run build
npm run audit
```

## Deploy with Docker Compose and Tailscale Serve

Build and start the application:

```bash
docker compose up -d --build
```

Compose publishes jot. only on the VPS loopback interface at `127.0.0.1:3000`. It is not exposed on the VPS's public interfaces.

Expose it privately to your Tailnet with HTTPS:

```bash
tailscale serve --bg localhost:3000
```

Use the `https://…ts.net` URL reported by Tailscale. HTTPS is required for installation and service-worker functionality. Do not use Tailscale Funnel unless you intentionally want public internet access.

The first visit creates the only owner account. There are no default credentials.

## Persistent data and backups

The `jot-data` Docker volume contains:

```text
/data/jot.sqlite
/data/jot.sqlite-wal
/data/jot.sqlite-shm
/data/images/
```

Back up the database and image directory together. The safest simple procedure is:

```bash
docker compose stop jot
docker run --rm -v jot-data:/data -v "$PWD/backups:/backup" \
  alpine tar czf "/backup/jot-$(date +%F-%H%M%S).tar.gz" -C /data .
docker compose start jot
```

Test restoring backups periodically. Browser storage is a convenience for offline work, not a backup.

## Updates

```bash
git pull
docker compose up -d --build
```

The PWA downloads frontend updates in the background. It does not force a reload while a note is being edited.

## Sync behavior

Edits are committed to IndexedDB first and sent to the server immediately when possible. The header distinguishes **Saved on device**, **Syncing…**, **Synced**, and failure/offline states.

Mobile operating systems can suspend web apps after they are backgrounded. An edit made offline may therefore remain only on its original device until jot. is opened again with connectivity.

## Security notes

- Keep the app restricted to the Tailnet.
- Authentication remains enabled as defense in depth.
- Passwords use Argon2id; raw session tokens are never stored in SQLite.
- Cookies are HTTP-only and SameSite Strict; production cookies are Secure behind HTTPS.
- Uploads are limited by count, bytes, decoded dimensions, and detected file contents.
- API mutations reject cross-site browser requests.
- SQLite queries are parameterized and API inputs are parsed with Zod.
