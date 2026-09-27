import { icon, hydrateIcons } from './icons.js';
import { sampleNotes } from './notes.js';

hydrateIcons();
const $ = selector => document.querySelector(selector);
const board = $('#note-board');
const pinnedBoard = $('#pinned-board');
const boards = [pinnedBoard, board];
const editor = $('#editor');
const form = $('#note-form');
const imageInput = $('#image-input');
let notes = structuredClone(sampleNotes);
let draft = null;
let initialDraft = '';
let toastTimer;
let layoutFrame;
const temporaryImages = new Set();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderNotes() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const filtered = notes.filter(note => [note.title, note.body, ...(note.images || []).map(image => image.alt)].join(' ').toLocaleLowerCase().includes(query));
  const pinned = filtered.filter(note => note.pinned);
  const others = filtered.filter(note => !note.pinned);
  $('#pinned-section').hidden = pinned.length === 0;
  $('#other-section').hidden = others.length === 0;
  $('#other-heading').hidden = pinned.length === 0;
  board.setAttribute('aria-label', pinned.length ? 'Other notes' : 'Notes');
  pinnedBoard.replaceChildren(...pinned.map(createNoteItem));
  board.replaceChildren(...others.map(createNoteItem));
  $('#note-count').textContent = filtered.length;
  $('#empty-state').hidden = filtered.length > 0;
  $('#clear-search').hidden = !query;
  scheduleLayout();
}

function createNoteItem(note) {
    const item = element('li', 'note-item');
    const card = element('button', `note-card ${note.color}`);
    card.type = 'button';
    card.dataset.id = note.id;
    card.setAttribute('aria-label', `Open note: ${note.title || note.body || note.images?.[0]?.alt || 'Image note'}`);
    const image = note.images?.[0];
    if (image) {
      const photo = element('img', `note-photo photo-${image.style || 'uploaded'}`);
      photo.src = image.src;
      photo.alt = image.alt;
      photo.width = 600;
      photo.height = 450;
      photo.addEventListener('load', scheduleLayout);
      photo.addEventListener('error', () => { photo.alt = 'Image unavailable'; scheduleLayout(); });
      card.append(photo);
      if (note.images.length > 1) {
        const count = element('span', 'image-number', String(note.images.length));
        count.prepend(icon('image'));
        card.append(count);
      }
    }
    const content = element('span', 'note-content');
    if (note.title) content.append(element('span', 'note-title', note.title));
    if (note.body) content.append(element('span', 'note-body', note.body));
    if (note.doodle) {
      const doodle = element('span', 'note-doodle');
      doodle.append(icon(note.doodle));
      content.append(doodle);
    }
    const date = element('span', 'note-date', note.date);
    content.append(date);
    card.append(content);
    const pin = element('button', 'note-pin pin-toggle');
    pin.type = 'button';
    pin.dataset.id = note.id;
    pin.setAttribute('aria-label', `Pin note: ${note.title || note.body || note.images?.[0]?.alt || 'Image note'}`);
    pin.append(icon('pin'));
    updatePinButton(pin, note.pinned);
    // Siblings, not nested buttons: opening and pinning are separate actions.
    item.append(card, pin);
    return item;
}

function updatePinButton(button, pinned) {
  button.setAttribute('aria-pressed', Boolean(pinned));
  button.title = pinned ? 'Unpin note' : 'Pin note';
}

// Keep source order in top-to-bottom visual order, placing each note in the
// shortest column. Explicit grid placement avoids experimental CSS masonry.
function layoutNotes() {
  for (const board of boards) {
    if (!board.children.length || board.parentElement.hidden) continue;
    layoutBoard(board);
  }
}
function layoutBoard(board) {
  const columns = Number(getComputedStyle(board).getPropertyValue('--columns'));
  const heights = Array(columns).fill(0);
  const gap = innerWidth <= 700 ? 12 : innerWidth <= 1100 ? 16 : 20;
  for (const item of board.children) {
    const column = heights.indexOf(Math.min(...heights));
    item.style.gridColumn = column + 1;
    const height = Math.ceil(item.firstElementChild.getBoundingClientRect().height);
    item.style.gridRow = `${heights[column] + 1} / span ${height + gap}`;
    heights[column] += height + gap;
  }
}
function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(layoutNotes);
}
let lastWidth = 0;
new ResizeObserver(entries => {
  if (entries[0].contentRect.width !== lastWidth) {
    lastWidth = entries[0].contentRect.width;
    scheduleLayout();
  }
}).observe($('#main'));
document.fonts.ready.then(scheduleLayout);
$('#main').addEventListener('click', event => {
  const pin = event.target.closest('.note-pin');
  if (pin) {
    const note = notes.find(note => note.id === pin.dataset.id);
    note.pinned = !note.pinned;
    renderNotes();
    layoutNotes();
    const next = [...document.querySelectorAll('.note-pin')].find(button => button.dataset.id === note.id);
    next.focus({ preventScroll: true });
    if (event.detail === 0) next.scrollIntoView({ block: 'nearest' });
    showToast(note.pinned ? 'Note pinned' : 'Note unpinned');
    return;
  }
  const card = event.target.closest('.note-card');
  if (card) openEditor(notes.find(note => note.id === card.dataset.id));
});
$('#search').addEventListener('input', renderNotes);
$('#clear-search').addEventListener('click', () => { $('#search').value = ''; renderNotes(); $('#search').focus(); });

function draftSnapshot() {
  return JSON.stringify({ title: $('#note-title').value, body: $('#note-body').value, color: form.elements.color.value, images: draft.images, pinned: Boolean(draft.pinned) });
}
function openEditor(note) {
  draft = note ? structuredClone(note) : { color: 'paper', title: '', body: '', images: [] };
  draft.images ||= [];
  $('#note-title').value = draft.title || '';
  $('#note-body').value = draft.body || '';
  form.elements.color.value = draft.color;
  editor.className = `editor-dialog ${draft.color}`;
  $('#editor-heading').textContent = note ? 'A little note' : 'Something worth keeping';
  $('#delete-note').hidden = !note;
  updatePinButton($('#pin-note'), draft.pinned);
  $('#editor-error').textContent = '';
  renderEditorImages();
  initialDraft = draftSnapshot();
  editor.showModal();
  $('#note-body').focus();
}
function requestCloseEditor() {
  if (draftSnapshot() !== initialDraft) $('#discard-dialog').showModal();
  else editor.close();
}
editor.addEventListener('cancel', event => { event.preventDefault(); requestCloseEditor(); });
$('#close-editor').addEventListener('click', requestCloseEditor);
$('#pin-note').addEventListener('click', () => {
  draft.pinned = !draft.pinned;
  updatePinButton($('#pin-note'), draft.pinned);
});
$('#keep-editing').addEventListener('click', () => $('#discard-dialog').close());
$('#discard-changes').addEventListener('click', () => { $('#discard-dialog').close(); editor.close(); });
editor.addEventListener('close', () => {
  // Revoke only discarded local images; saved images stay usable until reload.
  for (const url of temporaryImages) {
    if (!notes.some(note => note.images?.some(image => image.src === url))) {
      URL.revokeObjectURL(url);
      temporaryImages.delete(url);
    }
  }
});
form.elements.color.forEach(radio => radio.addEventListener('change', () => { editor.className = `editor-dialog ${form.elements.color.value}`; }));
form.addEventListener('submit', event => {
  event.preventDefault();
  const title = $('#note-title').value.trim();
  const body = $('#note-body').value.trim();
  if (!title && !body && !draft.images.length) {
    $('#editor-error').textContent = 'Add some text or an image first.';
    $('#note-body').focus();
    return;
  }
  const isNew = !draft.id;
  const saved = { ...draft, id: draft.id || `preview-${Date.now()}`, title, body, color: form.elements.color.value, date: 'Just now' };
  notes = [saved, ...notes.filter(note => note.id !== saved.id)];
  $('#search').value = '';
  renderNotes();
  editor.close();
  showToast(isNew ? 'Note added' : 'Note updated');
});

function renderEditorImages() {
  $('#editor-images').replaceChildren(...draft.images.map((image, index) => {
    const wrapper = element('div', 'editor-image');
    const photo = element('img');
    photo.src = image.src;
    photo.alt = image.alt;
    const remove = element('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove image ${index + 1}`);
    remove.append(icon('x'));
    remove.addEventListener('click', () => { draft.images.splice(index, 1); renderEditorImages(); $('#attach-image').focus(); });
    wrapper.append(photo, remove);
    return wrapper;
  }));
}
function selectImages() { imageInput.value = ''; imageInput.click(); }
imageInput.addEventListener('change', async () => {
  if (!imageInput.files.length) return;
  if (!editor.open) openEditor();
  const activeDraft = draft;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  $('#editor-error').textContent = '';
  for (const file of imageInput.files) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      $('#editor-error').textContent = 'Choose a JPG, PNG, WebP or GIF under 10 MB.';
      continue;
    }
    if (activeDraft.images.length >= 6) { $('#editor-error').textContent = 'Up to 6 images per note.'; break; }
    const src = URL.createObjectURL(file);
    const test = new Image();
    test.src = src;
    try {
      await test.decode();
      if (test.naturalWidth * test.naturalHeight > 40_000_000) throw new Error('Too many pixels');
      if (!editor.open || draft !== activeDraft) { URL.revokeObjectURL(src); break; }
      temporaryImages.add(src);
      activeDraft.images.push({ src, alt: file.name });
    } catch {
      URL.revokeObjectURL(src);
      $('#editor-error').textContent = 'This image couldn’t be opened. Try another image (up to 40 megapixels).';
    }
  }
  submit.disabled = false;
  if (editor.open && draft === activeDraft) renderEditorImages();
});
$('#attach-image').addEventListener('click', selectImages);
document.querySelectorAll('[data-action="new"]').forEach(button => button.addEventListener('click', () => openEditor()));
document.querySelectorAll('[data-action="image"]').forEach(button => button.addEventListener('click', selectImages));
$('#delete-note').addEventListener('click', () => $('#confirm-dialog').showModal());
$('#cancel-delete').addEventListener('click', () => $('#confirm-dialog').close());
$('#confirm-delete').addEventListener('click', () => {
  notes = notes.filter(note => note.id !== draft.id);
  $('#confirm-dialog').close();
  editor.close();
  renderNotes();
  showToast('Note permanently deleted');
});
$('#sync-button').addEventListener('click', () => $('#sync-dialog').showModal());
$('#close-sync').addEventListener('click', () => $('#sync-dialog').close());
function showToast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  toastTimer = setTimeout(() => { $('#toast').textContent = ''; }, 3500);
}
document.addEventListener('keydown', event => {
  if (event.target.closest('input,textarea,[contenteditable]') || document.querySelector('dialog[open]') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === '/') { event.preventDefault(); $('#search').focus(); }
  if (event.key.toLowerCase() === 'n') { event.preventDefault(); openEditor(); }
});
renderNotes();
