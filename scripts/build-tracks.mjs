#!/usr/bin/env node
/* Regenerate tracks.json from the Raju Mistri YouTube playlist.
   Run after adding songs:   node scripts/build-tracks.mjs
   Output: tracks.json (used by the site — no live API calls in the browser). */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PLAYLIST_ID = process.argv[2] || 'PLUoQz2ARfFa0';
const INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.f5.si',
  'https://invidious.tiekoetter.com',
  'https://yt.chocolatemoo53.com',
];
const FIELDS = 'videoId,title,author,lengthSeconds,type,liveNow';

async function fetchInstance(base) {
  const seen = new Set();
  const tracks = [];
  for (let page = 1; page <= 5; page++) {
    const url = `${base}/api/v1/playlists/${PLAYLIST_ID}?page=${page}&fields=${FIELDS}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const before = tracks.length;
    for (const v of data.videos || []) {
      if (v.type === 'video' && !v.liveNow && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        tracks.push(v);
      }
    }
    if (tracks.length === before) break;
  }
  return tracks;
}

async function main() {
  let tracks = null;
  let used = '';
  for (const base of INSTANCES) {
    try {
      const t = await fetchInstance(base);
      if (t.length) {
        tracks = t;
        used = base;
        console.log(`OK  ${base} -> ${t.length} unique tracks`);
        break;
      }
    } catch (e) {
      console.warn(`fail ${base}: ${e.message}`);
    }
  }

  if (!tracks || !tracks.length) {
    console.error('Could not fetch the playlist from any instance.');
    process.exit(1);
  }

  const clean = tracks.map((t) => ({
    id: t.videoId,
    title: t.title,
    artist: t.author || '',
    lengthSeconds: t.lengthSeconds || 0,
    cover: `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
  }));

  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const out = join(root, 'tracks.json');
  await writeFile(out, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  console.log(`Saved ${clean.length} tracks -> ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
