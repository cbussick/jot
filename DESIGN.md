# jot. — screen design

A small, self-hosted place for text and images. This milestone is a design prototype, not a deployed notes service.

## Visual direction

- Canvas `#F7F8FA`; ink `#263630`; primary evergreen `#285B48`; butter paper `#F8EBAD`; mint paper `#DBEBE1`; lilac paper `#EAE4F3`.
- Manrope throughout, without per-note font variants. Desktop/iPad notes use 17px titles, 14px bodies, and 12px dates. Phones use 15px titles, 14px bodies, and 12px dates (14/13/12px at widths ≤360px). Sizes are centralized as rem-based CSS tokens, shared by text and image notes.
- Left-aligned content; four masonry-style columns on desktop, three on iPad, two on phones. Images retain their proportions.
- The notes supply the personality. No decorative sidebar, dashboard metrics, labels, checklists, archive, reminders, or trash.
- Color is a lightweight visual note preference, not a label system.
- The board heading stands alone, without a caption or decorative icon. Dates are plain text, without note-type icons.
- Pinned notes form a separate section above other notes, with the same column widths and colors. The section disappears when empty. Two sample notes start pinned.

## Layouts

Desktop, 1440 × 1000:
```
jot.             [ Search your notes                 ]   Not connected
Your notes
[ Write something…                                      + image ]
All notes  12                                         Newest first
Pinned
[ note ] [ note ]
Other notes
[ note ] [ image ] [ note ] [ image ]
[ image] [ note  ] [ image] [ note  ]
```

iPad portrait, 834 × 1194: same hierarchy, three columns, generous touch targets, shorter search. Editor opens as a centered sheet. Landscape adapts naturally.

Phone, 390 × 844: compact header; search beneath it; two columns; fixed bottom capture dock for new note and image upload. Editor becomes a full-screen page. No duplicated desktop capture bar.

## Brief review

A navigation rail and filter chips were considered and removed: there are no destinations or labels to justify them. A oversized welcome section was rejected in favor of a compact note-board heading. The only pronounced styling is on the notes themselves, echoing the mixed text and screenshots in the supplied Keep reference.

## Prototype scope

Working search, create/edit, image selection, note colors, pin/unpin, and confirmed permanent deletion. Card pin controls act immediately without opening the editor; on desktop they appear on hover/focus, with pinned controls always visible. Tablet/phone controls remain visible with 44px targets. The editor also has a Pin toggle that commits on Save note and participates in unsaved-change confirmation. Pinning does not change a note’s edit date or newest-first order within its group. Search includes both groups. Changes exist only in memory and reset on reload. The sync status reads “Not connected” until real sync exists. Prototype disclaimers and the decorative bottom footer are removed from the interface. Desktop/iPad creation uses only the capture bar, without a duplicate New note button or boxed N hint; the N shortcut still works. Demo photos and fonts are served locally. No accounts, database, upload endpoint, real device sync, or production deployment is implemented.

Before production: authenticated private access, server-side note and image storage, upload validation, conflict-aware sync, offline state, backups, and HTTPS.
