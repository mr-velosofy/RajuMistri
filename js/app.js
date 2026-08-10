(function () {
  'use strict';

  var PLAYLIST_ID = 'PLUoQz2ARfFa0';
  var INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.f5.si',
    'https://invidious.tiekoetter.com',
    'https://yt.chocolatemoo53.com'
  ];

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    hero: $('hero'),
    clock: $('clock'),
    themeBtn: $('themeBtn'),
    onlineNum: $('onlineNum'),
    vinyl: $('vinyl'),
    cover: $('cover'),
    title: $('title'),
    artist: $('artist'),
    bar: $('bar'),
    knob: $('knob'),
    fill: $('fill'),
    cur: $('cur'),
    dur: $('dur'),
    prev: $('prev'),
    play: $('play'),
    next: $('next'),
    shuffle: $('shuffle'),
    listBtn: $('listBtn'),
    list: $('list'),
    listItems: $('listItems'),
    err: $('err')
  };

  var state = {
    tracks: [],
    order: [],
    pos: 0,
    shuffle: true,
    ready: false,
    playing: false,
    started: false,
    scrubbing: false
  };

  var yt = null;
  var ticks = [];

  /* ---- helpers ---- */

  function measureTicks() {
    ticks.forEach(function (tick) {
      var p = tick.firstElementChild;
      if (!p) return;
      var over = p.scrollWidth - tick.clientWidth;
      if (over > 2) {
        tick.classList.add('scrolling');
        p.style.setProperty('--shift', over + 'px');
        p.style.setProperty('--dur', Math.max(7, Math.min(22, Math.round(over / 10))) + 's');
      } else {
        tick.classList.remove('scrolling');
      }
    });
  }

  function registerTick(tick) {
    if (tick && ticks.indexOf(tick) === -1) ticks.push(tick);
  }

  function setupTicker() {
    registerTick(el.title.parentElement);
    registerTick(el.artist.parentElement);
    measureTicks();
  }

  function fmt(s) {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function shuffleArr(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function buildOrder() {
    var seq = [];
    for (var i = 0; i < state.tracks.length; i++) seq.push(i);
    return state.shuffle ? shuffleArr(seq) : seq;
  }

  function currentTrack() {
    return state.tracks[state.order[state.pos]];
  }

  /* ---- rendering ---- */

  function renderTrack() {
    var t = currentTrack();
    if (!t) return;
    el.title.textContent = t.title;
    el.artist.textContent = t.artist || 'unknown artist';
    el.cover.src = t.cover || '';
    el.cover.alt = t.title + ' artwork';
    el.cover.classList.toggle('is-ytthumb', (t.cover || '').indexOf('ytimg.com') !== -1);
    if (state.started) document.title = t.title + ' â€” Raju Mistri';

    var kids = el.listItems.children;
    for (var i = 0; i < kids.length; i++) {
      kids[i].classList.toggle('is-current', i === state.pos);
    }
    var active = kids[state.pos];
    if (active && el.list.classList.contains('is-open')) {
      active.scrollIntoView({ block: 'nearest' });
    }
    measureTicks();
  }

  function renderList() {
    el.listItems.innerHTML = '';
    state.order.forEach(function (trackIdx, i) {
      var t = state.tracks[trackIdx];
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';

      var title = document.createElement('span');
      title.className = 't-title';
      title.textContent = t.title;

      var artist = document.createElement('span');
      artist.className = 't-artist';
      artist.textContent = t.artist || '';

      var tickTitle = document.createElement('div');
      tickTitle.className = 'tick tick-title';
      tickTitle.append(title);
      var tickArtist = document.createElement('div');
      tickArtist.className = 'tick tick-artist';
      tickArtist.append(artist);

      btn.append(tickTitle, tickArtist);
      btn.addEventListener('click', function () {
        go(i);
        el.list.classList.remove('is-open');
        el.listBtn.classList.remove('is-on');
        el.listBtn.setAttribute('aria-expanded', 'false');
      });
      li.append(btn);
      el.listItems.append(li);
    });
    ticks = ticks.filter(function (t) { return document.contains(t); });
    el.listItems.querySelectorAll('.tick').forEach(registerTick);
    measureTicks();
  }

  /* ---- playback ---- */

  function go(newPos) {
    var n = state.order.length;
    if (!n) return;
    state.pos = ((newPos % n) + n) % n;
    renderTrack();
    if (!yt) return;
    state.started = true;
    yt.loadVideoById(currentTrack().id);
  }

  function toggle() {
    if (!yt || !state.ready) return;
    if (state.playing) {
      yt.pauseVideo();
    } else {
      state.started = true;
      yt.playVideo();
    }
  }

  function renderPlaying(on) {
    state.playing = on;
    el.play.classList.toggle('playing', on);
    el.play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    el.play.setAttribute('aria-pressed', String(on));
    el.vinyl.classList.toggle('playing', on);
  }

  /* ---- progress (rAF extrapolation like the reference) ---- */

  var poll = { at: 0, time: 0, duration: 0 };
  var lastSecond = -1;
  var lastDuration = -1;

  function samplePlayer() {
    if (!yt || typeof yt.getCurrentTime !== 'function') return;
    poll.time = yt.getCurrentTime() || 0;
    poll.duration = yt.getDuration() || 0;
    poll.at = performance.now();
  }

  function paintProgress() {
    requestAnimationFrame(paintProgress);
    if (!yt || state.scrubbing || !poll.duration) return;

    var drift = state.playing ? (performance.now() - poll.at) / 1000 : 0;
    var cur = Math.min(poll.duration, poll.time + drift);
    var frac = Math.min(1, Math.max(0, cur / poll.duration));

    el.fill.style.width = (frac * 100) + '%';
    el.knob.style.left = (frac * 100) + '%';

    var second = Math.floor(cur);
    if (second !== lastSecond) {
      lastSecond = second;
      el.cur.textContent = fmt(cur);
    }
    if (poll.duration !== lastDuration) {
      lastDuration = poll.duration;
      el.dur.textContent = fmt(poll.duration);
    }
  }

  /* ---- seeking ---- */

  function fractionFromEvent(e) {
    var r = el.bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  }

  function previewSeek(frac) {
    el.fill.style.width = (frac * 100) + '%';
    el.knob.style.left = (frac * 100) + '%';
    if (yt && typeof yt.getDuration === 'function') {
      el.cur.textContent = fmt((yt.getDuration() || 0) * frac);
    }
  }

  el.bar.addEventListener('pointerdown', function (e) {
    if (!yt) return;
    state.scrubbing = true;
    el.bar.setPointerCapture(e.pointerId);
    previewSeek(fractionFromEvent(e));
  });
  el.bar.addEventListener('pointermove', function (e) {
    if (state.scrubbing) previewSeek(fractionFromEvent(e));
  });
  el.bar.addEventListener('pointerup', function (e) {
    if (!state.scrubbing) return;
    state.scrubbing = false;
    el.bar.releasePointerCapture(e.pointerId);
    var dur = yt && yt.getDuration ? yt.getDuration() || 0 : 0;
    if (dur) yt.seekTo(dur * fractionFromEvent(e), true);
    samplePlayer();
  });
  el.bar.addEventListener('keydown', function (e) {
    if (!yt) return;
    var step = e.key === 'ArrowRight' ? 5 : e.key === 'ArrowLeft' ? -5 : 0;
    if (!step) return;
    e.preventDefault();
    yt.seekTo(Math.max(0, (yt.getCurrentTime() || 0) + step), true);
  });

  /* ---- controls ---- */

  el.play.addEventListener('click', toggle);
  el.prev.addEventListener('click', function () {
    if (yt && (yt.getCurrentTime() || 0) > 3) yt.seekTo(0, true);
    else go(state.pos - 1);
  });
  el.next.addEventListener('click', function () { go(state.pos + 1); });

  el.shuffle.addEventListener('click', function () {
    var keep = currentTrack();
    state.shuffle = !state.shuffle;
    el.shuffle.classList.toggle('is-on', state.shuffle);
    el.shuffle.setAttribute('aria-pressed', String(state.shuffle));

    state.order = buildOrder();
    state.pos = Math.max(0, state.order.indexOf(state.tracks.indexOf(keep)));
    renderList();
    renderTrack();
  });

  el.listBtn.addEventListener('click', function () {
    var open = !el.list.classList.contains('is-open');
    el.list.classList.toggle('is-open', open);
    el.listBtn.classList.toggle('is-on', open);
    el.listBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      var active = el.listItems.children[state.pos];
      if (active) active.scrollIntoView({ block: 'center' });
    }
  });

  document.addEventListener('click', function (e) {
    var open = el.list.classList.contains('is-open');
    if (!open) return;
    var t = e.target;
    if (t && t.closest && (t.closest('.list') || t.closest('#listBtn'))) return;
    el.list.classList.remove('is-open');
    el.listBtn.classList.remove('is-on');
    el.listBtn.setAttribute('aria-expanded', 'false');
  });

  var night = false;
  var bgFade = document.getElementById('bgFade');
  var finishPending = false;
  var fadeTimer = 0;

  function finishFade() {
    if (!finishPending) return;
    finishPending = false;
    window.clearTimeout(fadeTimer);
    document.documentElement.classList.toggle('night', night);
    el.hero.classList.toggle('night', night);
    bgFade.classList.remove('on');
    bgFade.style.backgroundImage = '';
  }

  el.themeBtn.addEventListener('click', function () {
    night = !night;
    var next = night ? 'css/BG_Night.avif' : 'css/BG_Day.avif';
    var wasPending = finishPending;
    finishPending = true;
    bgFade.style.backgroundImage = 'url("' + next + '"), url("bg.jpg")';
    bgFade.classList.remove('on');
    if (!wasPending) bgFade.addEventListener('transitionend', finishFade);
    void bgFade.offsetHeight;
    bgFade.classList.add('on');
    fadeTimer = window.setTimeout(finishFade, 1600);
  });

  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea, [contenteditable]')) return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
    else if (e.key === 'n' || e.key === 'ArrowRight') { if (e.target !== el.bar) go(state.pos + 1); }
    else if (e.key === 'p' || e.key === 'ArrowLeft') { if (e.target !== el.bar) go(state.pos - 1); }
  });

  /* ---- ambient chrome ---- */

  function startClock() {
    var fmtT = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true
    });
    function tick() {
      var parts = fmtT.formatToParts(new Date());
      var get = function (t) {
        var p = parts.find(function (x) { return x.type === t; });
        return p ? p.value : '';
      };
      el.clock.innerHTML =
        get('hour') + '<span class="colon">:</span>' + get('minute') +
        '<span class="period">' + get('dayPeriod') + '</span>';
    }
    tick();
    window.setInterval(tick, 1000);
  }

  function startOnlineCounter() {
    var n = 30;
    function update() {
      var dir = Math.random() < (n < 36 ? 0.58 : 0.42) ? 1 : -1;
      n = Math.max(14, Math.min(58, n + dir * (1 + Math.floor(3 * Math.random()))));
      el.onlineNum.textContent = n;
      window.setTimeout(update, 15000 + 15000 * Math.random());
    }
    window.setTimeout(update, 15000 + 15000 * Math.random());
  }

  /* ---- youtube boot ---- */

  function preferAudio() {
    try { yt && yt.setPlaybackQuality && yt.setPlaybackQuality('tiny'); } catch (e) {}
  }

  window.onYouTubeIframeAPIReady = function () {
    yt = new YT.Player('yt-frame', {
      height: '1',
      width: '1',
      videoId: currentTrack() ? currentTrack().id : '',
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: function () {
          state.ready = true;
          el.play.disabled = false;
          preferAudio();
        },
        onStateChange: function (e) {
          var S = YT.PlayerState;
          if (e.data === S.PLAYING) {
            renderPlaying(true);
            preferAudio();
          } else if (e.data === S.PAUSED || e.data === S.BUFFERING) {
            renderPlaying(false);
          } else if (e.data === S.ENDED) {
            renderPlaying(false);
            go(state.pos + 1);
          }
        },
        onError: function () {
          if (state.started) go(state.pos + 1);
        }
      }
    });

    window.setInterval(samplePlayer, 250);
    requestAnimationFrame(paintProgress);
  };

  /* ---- track source: tracks.json, then live fetch ---- */

  function fetchFromInvidious() {
    var fields = 'videoId,title,author,lengthSeconds,type,liveNow';

    function one(base) {
      var seen = {};
      var acc = [];
      var page = 1;
      function nextPage() {
        return fetch(base + '/api/v1/playlists/' + PLAYLIST_ID + '?page=' + page + '&fields=' + fields)
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          })
          .then(function (data) {
            var before = acc.length;
            (data.videos || []).forEach(function (v) {
              if (v.type === 'video' && !v.liveNow && !seen[v.videoId]) {
                seen[v.videoId] = true;
                acc.push(v);
              }
            });
            if (acc.length > before && acc.length % 100 === 0 && page < 5) { page++; return nextPage(); }
            return acc;
          });
      }
      return nextPage();
    }

    var attempts = INSTANCES.map(function (base) {
      return one(base).then(
        function (tracks) { return { base: base, tracks: tracks }; },
        function () { return { base: base, tracks: null }; }
      );
    });

    return Promise.all(attempts).then(function (results) {
      var best = null;
      results.forEach(function (res) {
        if (!res.tracks || !res.tracks.length) return;
        var withAuthors = res.tracks.filter(function (t) { return t.author; }).length;
        if (!best ||
            res.tracks.length > best.tracks.length ||
            (res.tracks.length === best.tracks.length && withAuthors > best.withAuthors)) {
          best = { base: res.base, tracks: res.tracks, withAuthors: withAuthors };
        }
      });
      return best || null;
    });
  }

  function normalize(t) {
    return {
      id: t.videoId || t.id,
      title: t.title,
      artist: t.author || t.artist || '',
      lengthSeconds: t.lengthSeconds || 0,
      cover: (t.cover || '').indexOf('ytimg.com') !== -1
        ? t.cover
        : 'https://i.ytimg.com/vi/' + (t.videoId || t.id) + '/hqdefault.jpg'
    };
  }

  var freshBusy = false;

  function applyFreshTracks() {
    if (freshBusy) return;
    freshBusy = true;
    return fetchFromInvidious()
      .then(function (res) {
        if (!res || !res.tracks || !res.tracks.length) throw new Error('no tracks');
        var anchor = currentTrack();
        var anchorId = anchor ? anchor.id : null;
        state.tracks = res.tracks.map(normalize);
        state.order = buildOrder();
        if (anchorId) {
          for (var i = 0; i < state.order.length; i++) {
            if (state.tracks[state.order[i]].id !== anchorId) continue;
            var shift = i - state.pos;
            if (shift > 0) {
              state.order = state.order.slice(shift).concat(state.order.slice(0, shift));
            } else if (shift < 0) {
              state.order = state.order
                .slice(state.order.length + shift)
                .concat(state.order.slice(0, state.order.length + shift));
            }
            break;
          }
        }
        if (state.pos >= state.order.length) state.pos = state.order.length - 1;
        if (!state.tracks.length && el.err) el.err.classList.add('hidden');
        renderList();
        renderTrack();
        measureTicks();
        console.log('live playlist applied: ' + state.tracks.length + ' (current song kept)');
      })
      .catch(function (e) {
        console.warn('live playlist unavailable, staying on tracks.json:', e);
      })
      .then(function () {
        freshBusy = false;
      });
  }

  function boot() {
    el.play.disabled = true;
    el.prev.disabled = true;
    el.next.disabled = true;
    startClock();
    startOnlineCounter();
    setupTicker();
    window.addEventListener('resize', measureTicks);

    fetch('tracks.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (tracks) {
        if (!tracks || !tracks.length) throw new Error('empty');
        state.tracks = tracks.map(normalize);
        return null;
      })
      .catch(function () {
        return fetchFromInvidious().then(function (res) {
          if (res) state.tracks = res.tracks.map(normalize);
        });
      })
      .then(function () {
        applyFreshTracks();
        window.setInterval(applyFreshTracks, 10 * 60 * 1000);

        if (!state.tracks.length) {
          el.title.textContent = 'Could not load the playlist';
          el.artist.textContent = 'Check network and reload';
          el.err.textContent = 'Playlist fetch failed. Run node scripts/build-tracks.mjs and reload.';
          el.err.classList.remove('hidden');
          return;
        }

        state.order = buildOrder();
        renderList();
        renderTrack();
        el.prev.disabled = false;
        el.next.disabled = false;

        var s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        document.head.append(s);
      });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
