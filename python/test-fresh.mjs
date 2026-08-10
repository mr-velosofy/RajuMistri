const fs = require('fs');
const vm = require('vm');
const path = require('path');

const APP = fs.readFileSync(path.join(__dirname, 'static', 'js', 'app.js'), 'utf8');

const TWO = [
  { id: 'songA', title: 'Song A (playing)', artist: 'Artist A', lengthSeconds: 180, cover: 'https://i.ytimg.com/vi/songA/hqdefault.jpg' },
  { id: 'songB', title: 'Song B', artist: 'Artist B', lengthSeconds: 190, cover: 'https://i.ytimg.com/vi/songB/hqdefault.jpg' },
];
const FRESH = [
  { id: 'songC', title: 'Fresh Song C', artist: 'Artist C', lengthSeconds: 200, cover: 'https://i.ytimg.com/vi/songC/hqdefault.jpg' },
  { id: 'songD', title: 'Fresh Song D', artist: 'Artist D', lengthSeconds: 210, cover: 'https://i.ytimg.com/vi/songD/hqdefault.jpg' },
  { id: 'songA', title: 'Song A (fresh copy)', artist: 'Artist A', lengthSeconds: 180, cover: 'https://i.ytimg.com/vi/songA/hqdefault.jpg' },
  { id: 'songE', title: 'Fresh Song E', artist: 'Artist E', lengthSeconds: 220, cover: 'https://i.ytimg.com/vi/songE/hqdefault.jpg' },
  { id: 'songF', title: 'Fresh Song F', artist: 'Artist F', lengthSeconds: 230, cover: 'https://i.ytimg.com/vi/songF/hqdefault.jpg' },
  { id: 'songB', title: 'Song B (fresh copy)', artist: 'Artist B', lengthSeconds: 190, cover: 'https://i.ytimg.com/vi/songB/hqdefault.jpg' },
  { id: 'songG', title: 'Fresh Song G', artist: 'Artist G', lengthSeconds: 240, cover: 'https://i.ytimg.com/vi/songG/hqdefault.jpg' },
  { id: 'songH', title: 'Fresh Song H', artist: 'Artist H', lengthSeconds: 250, cover: 'https://i.ytimg.com/vi/songH/hqdefault.jpg' },
];

const logs = [];
const els = {};
const handlers = {};
const docHandlers = {};

class FakeEl {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.src = '';
    this.alt = '';
    this.hidden = false;
    this.innerHTML = '';
    this.childNodes = { children: [] };
    this.style = {};
    this.offsetWidth = this.id === 'bar' ? 500 : 200;
    this.scrollWidth = 200;
    this.offsetParent = this.id === 'bar' ? null : {};
    this.classList = {
      names: new Set(),
      add: (c) => this.classList.names.add(c),
      remove: (c) => this.classList.names.delete(c),
      toggle: (c, force) => {
        if (force === undefined) force = !this.classList.names.has(c);
        force ? this.classList.names.add(c) : this.classList.names.delete(c);
        return force;
      },
      contains: (c) => this.classList.names.has(c),
    };
    this.addEventListener = (ev, fn) => {
      (handlers[this.id] = handlers[this.id] || {})[ev] = fn;
    };
    this.append = (...kid) => this.childNodes.children.push(...kid);
    this.scrollIntoView = () => {};
    this.setAttribute = (k, v) => (this[k] = v);
  }
}
global.document = {
  getElementById: (id) => (els[id] ||= new FakeEl(id)),
  createElement: () => new FakeEl('_new'),
  head: { append: () => {} },
  addEventListener: (ev, fn) => {
    (docHandlers[ev] = docHandlers[ev] || []).push(fn);
  },
  title: 'Raju Mistri',
};
global.window = {
  addEventListener: () => {},
  crypto: { randomUUID: () => 'test-sid' },
  onYouTubeIframeAPIReady: null,
  setInterval,
  clearInterval,
  setTimeout,
  clearTimeout,
};
global.localStorage = { store: {}, getItem: (k) => this.store[k], setItem: (k, v) => (this.store[k] = v) };
global.YT = { Player: function () {} };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.fetch = (url) => {
  if (url === 'tracks.json') return Promise.resolve({ ok: true, json: () => Promise.resolve(TWO) });
  if (url === '/fresh-tracks') return Promise.resolve({ ok: true, json: () => Promise.resolve(FRESH) });
  if (url === '/api/stats') return Promise.resolve({ ok: true, json: () => Promise.resolve({ active: 1 }) });
  if (url === '/api/beat') return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  return Promise.resolve({ ok: false });
};
console.log = (...a) => logs.push(a.join(' '));

vm.runInThisContext(APP, { filename: 'app.js' });
docHandlers.DOMContentLoaded.forEach((fn) => fn());

setTimeout(() => {
  const titleAfterFresh = els.title.textContent;
  const listCount = els.listItems.childNodes.children.length;
  const kept = logs.some((l) => l.includes('current song kept'));
  console.log('--- after fresh applied ---');
  console.log('title still      :', JSON.stringify(titleAfterFresh));
  console.log('list items       :', listCount);
  console.log('console log      :', JSON.stringify(logs));

  let pass = titleAfterFresh === 'Song A (playing)' && listCount === FRESH.length && kept;
  if (pass) {
    handlers.next.click();
    const afterNext = els.title.textContent;
    console.log('--- after next click ---');
    console.log('title now        :', JSON.stringify(afterNext));
    pass = afterNext === 'Fresh Song C';
  }
  console.log(pass ? 'PASS' : 'FAIL');
  process.exit(pass ? 0 : 1);
}, 250);