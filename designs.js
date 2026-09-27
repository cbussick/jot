const devices = {
  desktop: { width: 1440, height: 1000, title: 'Everything in view.', body: 'A spacious four-column board. Capture a thought, drop in an image, and get on with your day.', detail: 'Search with / · Create with N', icon: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5m-4 0h8"/>' },
  ipad: { width: 834, height: 1194, title: 'A little more hands-on.', body: 'Three comfortable columns, generous touch targets, and a centered editor. Made for the sofa, the kitchen, or wherever you land.', detail: 'Portrait or landscape · Touch-friendly', icon: '<rect x="4" y="2" width="16" height="20" rx="3"/><path d="M10 18h4"/>' },
  phone: { width: 390, height: 844, title: 'For the thought that can’t wait.', body: 'A pocket-sized board with text and photo capture right under your thumb. Open a note and the editor takes the whole screen.', detail: 'Two columns · One-hand capture', icon: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/>' }
};
const stage = document.querySelector('#preview-stage');
const frame = document.querySelector('#device-frame');
const preview = document.querySelector('#preview');
let current = 'desktop';
function resize() {
  const { width, height } = devices[current];
  const padding = parseFloat(getComputedStyle(stage).paddingLeft);
  const frameWidth = width + (current === 'desktop' ? 2 : current === 'ipad' ? 20 : 16);
  const frameHeight = height + (current === 'desktop' ? 38 : current === 'ipad' ? 20 : 16);
  const maxHeight = current === 'desktop' ? 1000 : current === 'ipad' ? 900 : 844;
  const scale = Math.min(1, (stage.clientWidth - padding * 2 - 2) / frameWidth, maxHeight / frameHeight);
  frame.style.width = `${frameWidth}px`;
  frame.style.height = `${frameHeight}px`;
  frame.style.transform = `scale(${scale})`;
  stage.style.height = `${frameHeight * scale + padding * 2 + 2}px`;
}
function select(device) {
  current = device;
  const { width, height, title, body, detail } = devices[device];
  preview.width = width;
  preview.height = height;
  preview.title = `Interactive ${device} screen design`;
  frame.dataset.device = device;
  document.querySelector('#viewport-size').textContent = `${width} × ${height}`;
  document.querySelector('#caption-title').textContent = title;
  document.querySelector('#caption-body').textContent = body;
  document.querySelector('#caption-detail').textContent = detail;
  document.querySelectorAll('[data-device]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', button.dataset.device === device);
  });
  history.replaceState(null, '', `#${device}`);
  resize();
}
document.querySelectorAll('button[data-device]').forEach(button => {
  const device = button.dataset.device;
  button.querySelector('[data-icon]').innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">${devices[device].icon}</svg>`;
  button.addEventListener('click', () => select(device));
});
new ResizeObserver(resize).observe(stage);
select(Object.hasOwn(devices, location.hash.slice(1)) ? location.hash.slice(1) : 'desktop');
