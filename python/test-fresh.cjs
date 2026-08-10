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
  { id: 'songA', title: 'Song A (playing)', artist: 'Artist A', lengthSeconds: 180, cover: 'https://i.ytimg.com/vi/songA/hqdefault.jpg' },
  { id: 'songE', title: 'Fresh Song E', artist: 'Artist E', lengthSeconds: 220, cover: 'https://i.ytimg.com/vi/songE/hqdefault.jpg' },
  { id: 'songF', title: 'Fresh Song F', artist: 'Artist F', lengthSeconds: 230, cover: 'https://i.ytimg.com/vi/songF/hqdefault.jpg' },
  { id: 'songB', title: 'Song B', artist: 'Artist B', lengthSeconds: 190, cover: 'https://i.ytimg.com/vi/songB/hqdefault.jpg' },
  { id: 'songG', title: 'Fresh Song G', artist: 'Artist G', lengthSeconds: 240, cover: 'https://i.ytimg.com/vi/songG/hqdefault.jpg' },
  { id: 'songH', title: 'Fresh Song H', artist: 'Artist H', lengthSeconds: 250, cover: 'https://i.ytimg.com/vi/songH/hqdefault.jpg' },
];

const logs = [];
const realLog = console.log.bind(console);
const els = {};
const handlers = {};
const docHandlers = {};
let resolveFresh = null;

class FakeEl {
  constructor(id) {
    this.id = id;
    this.textContent = '';
    this.src = '';
    this.alt = '';
    this.hidden = false;
    this._innerHTML = '';
    Object.defineProperty(this, 'innerHTML', { get: () => this._innerHTML, set: (v) => { this._innerHTML = v; this.childNodes.children.length = 0; } });
    this.childNodes = { children: [] };
    Object.defineProperty(this, 'children', { get: () => this.childNodes.children });
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
    this.querySelectorAll = () => [];
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
  if (url === '/fresh-tracks') return new Promise((r) => (resolveFresh = r));
  if (url === '/api/stats') return Promise.resolve({ ok: true, json: () => Promise.resolve({ active: 1 }) });
  if (url === '/api/beat') return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
  return Promise.resolve({ ok: false });
};
console.log = (...a) => logs.push(a.join(' '));

vm.runInThisContext(APP, { filename: 'app.js' });
(docHandlers.DOMContentLoaded || []).forEach((fn) => fn());

setTimeout(() => {
  const before = els.title.textContent;
  const beforeCover = els.cover.src;
  const beforeList = els.listItems.childNodes.children.length;
  realLog('--- after boot (2-track file) ---');
  realLog('title        :', JSON.stringify(before));
  realLog('list items   :', beforeList);

  resolveFresh({ ok: true, json: () => Promise.resolve(FRESH) });
  setTimeout(() => {
    const after = els.title.textContent;
  const cover = els.cover.src;
    const afterList = els.listItems.childNodes.children.length;
    const kept = logs.some((l) => l.includes('current song kept'));
    realLog('--- after fresh applied ---');
    realLog('title        :', JSON.stringify(after));
    realLog('cover        :', JSON.stringify(cover));
    realLog('list items   :', afterList);
    realLog('applied log  :', JSON.stringify(logs));

    let pass = beforeList === 2 && afterList === FRESH.length && kept && after === before && cover === beforeCover;
    realLog('raw booleans:', JSON.stringify({ beforeList: beforeList === 2, afterList: afterList === FRESH.length, kept, sameTitle: after === before, sameCover: cover === beforeCover }));
    realLog('playing song unchanged (title):', after === before);
    realLog('same song id (cover)        :', JSON.stringify(cover));

    handlers.next.click();
    setTimeout(() => {
      const afterNext = els.title.textContent;
      realLog('--- after next click ---');
      realLog('title        :', JSON.stringify(afterNext));
      const isFresh = FRESH.some((t) => t.title === afterNext);
      realLog('next is fresh:', isFresh);
      pass = pass && afterNext !== after && isFresh;
      realLog('RESULT: ' + (pass ? 'PASS' : 'FAIL'));
      process.exit(pass ? 0 : 1);
    }, 30);
  }, 30);
}, 80);



