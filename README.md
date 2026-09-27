# jot.

A responsive screen-design prototype for a minimal, self-hosted Google Keep alternative. Text and images, without the organizational overhead.

## Preview

```sh
npm run dev
```

Requires Python 3. Opens a static development server on port **4273**, listening on all interfaces. No build step or runtime npm dependencies.

- `http://localhost:4273/designs.html` — design review with desktop / iPad / phone viewport switcher
- `http://localhost:4273/` — responsive interactive prototype
- `screenshots/desktop.png` — 1440 × 1000 desktop design (2× export)
- `screenshots/ipad.png` — 834 × 1194 iPad design (2× export)
- `screenshots/phone.png` — 390 × 844 phone design (2× export)
- `screenshots/*-editor.png` — corresponding editor screens

## What works

Search, create/edit text, attach up to six local images, note colors, pin/unpin into a separate Pinned section, confirmed permanent deletion, unsaved-change confirmation, and keyboard shortcuts (`N` for new note, `/` for search). Native dialogs manage modal focus. The phone has a bottom capture dock and full-screen editor.

Pin directly from a card, or use the Pin toggle in the editor and save. On desktop, unpinned card controls appear on hover/focus; pinned controls and all tablet/phone controls remain visible. Pinning preserves the note’s date and its order within each group. Search covers both pinned and other notes.

**This is not the production app.** Changes (including pin state) live only in memory and reset on reload. Selected images stay in the browser; they are never uploaded. No database, account system, offline persistence, or device sync is implemented. The sync UI reads “Not connected”; prototype disclaimers have been removed from the interface. Do not use this prototype for important notes.

The static development server is for reviewing sample designs, not a hardened production deployment. It serves this project directory. Stop it when the review is done; a production server should serve a separate public build directory behind HTTPS and authentication.

## Verify / regenerate screenshots

```sh
npm ci
npx playwright install chromium
npm test
# With the preview server running:
npm run screenshots
```

Tests cover responsive layouts (320, 390, 768, 834, 1024, 1440), card overlap/overflow, search, create/edit/delete, image input, pin/unpin (including touch, keyboard, editor, search, and empty groups), fixed textareas, unsaved changes, preview switching, and automated WCAG A/AA checks on the board and editor. Browser automation is Chromium-based; actual iOS Safari device/keyboard testing remains for implementation.

## Files

- `index.html`, `styles.css`, `app.js` — responsive prototype
- `notes.js` — sample content
- `icons.js` — local SVG icons
- `designs.html`, `designs.css`, `designs.js` — review presentation
- `DESIGN.md` — design direction and scope
- `assets/` — self-hosted fonts, demo photos, and an authored sample screenshot

All prototype assets load locally, with no analytics or third-party runtime requests. Font licenses are included in `assets/`. Sample photography sources are recorded in `assets/SOURCES.md`.
