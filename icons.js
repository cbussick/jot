const paths = {
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6Z"/><path d="M12 15v6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.3"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  pen: '<path d="m15 4 5 5M4 20l5-1L21 7a2.1 2.1 0 0 0-4-4L5 15l-1 5Z"/>',
  'cloud-check': '<path d="M7 18H6a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12.4-1.5A5.2 5.2 0 0 1 20 17"/><path d="m10 16 3 3 5-6"/>',
  cloud: '<path d="M6 18a4.5 4.5 0 0 1-.5-9 6.5 6.5 0 0 1 12.4-1.5A5.2 5.2 0 0 1 18 18Z"/>',
  sort: '<path d="M5 5v14m-3-3 3 3 3-3M12 6h9m-9 6h6m-6 6h3"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  spark: '<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM20 16l.6 2.4L23 19l-2.4.6L20 22l-.6-2.4L17 19l2.4-.6L20 16Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  refresh: '<path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5"/>',
  offline: '<path d="m3 3 18 18M7 18H6a4.5 4.5 0 0 1-1.6-8.7M9 4a6.5 6.5 0 0 1 9 3.5A5.2 5.2 0 0 1 21 15M9 18h5"/>',
  alert: '<path d="m10 4-8 14a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 4a2.3 2.3 0 0 0-4 0Z"/><path d="M12 9v5m0 3v.1"/>'
};
export function icon(name) {
  const wrapper = document.createElement('span');
  // Only static, authored SVG paths are inserted here; note content uses textContent.
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.image}</svg>`;
  return wrapper.firstElementChild;
}
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(element => element.replaceChildren(icon(element.dataset.icon)));
}
