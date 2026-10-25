'use strict';
/* =====================================================================
   Nhạc của tôi - trình phát nhạc cá nhân (PWA)
   - Nhạc lưu trong máy (IndexedDB) nên nghe được khi không có mạng.
   - Kho nhạc trên Supabase là nơi máy tính upload, điện thoại đồng bộ về.
   ===================================================================== */

const CFG = window.APP_CONFIG || {};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const sortKey = (a, b) => a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() :
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const fmtTime = t => {
  if (!isFinite(t) || t < 0) t = 0;
  const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = Math.floor(t % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } };

/* ---------- Biểu tượng ---------- */
const st = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 5l9 7-9 7zM17 5h2v14h-2z" fill="currentColor"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M18 5l-9 7 9 7zM5 5h2v14H5z" fill="currentColor"/></svg>',
  shuffle: `<svg viewBox="0 0 24 24" ${st}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>`,
  sync: `<svg viewBox="0 0 24 24" ${st}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${st}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  user: `<svg viewBox="0 0 24 24" ${st}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>',
  back: `<svg viewBox="0 0 24 24" ${st}><polyline points="15 18 9 12 15 6"/></svg>`,
  check: `<svg viewBox="0 0 24 24" ${st} stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`,
  eq: '<span class="eq"><i></i><i></i><i></i></span>'
};

/* ---------- Kho lưu trong máy (IndexedDB) ---------- */
let _db;
function openDB() {
  if (!_db) _db = new Promise((res, rej) => {
    const r = indexedDB.open('music-player', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('songs', { keyPath: 'id' });
      d.createObjectStore('blobs');
      d.createObjectStore('playlists', { keyPath: 'id' });
      d.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _db;
}
const idb = {
  async get(store, key) {
    const d = await openDB();
    return new Promise((res, rej) => { const q = d.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async all(store) {
    const d = await openDB();
    return new Promise((res, rej) => { const q = d.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async put(store, val, key) {
    const d = await openDB();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readwrite'); const os = t.objectStore(store);
      if (key === undefined) os.put(val); else os.put(val, key);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  async del(store, key) {
    const d = await openDB();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readwrite'); t.objectStore(store).delete(key);
      t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
};

/* ---------- Kết nối Supabase (gọi thẳng REST, không cần thư viện) ---------- */
const authErr = () => { const e = new Error('Cần đăng nhập'); e.code = 'auth'; e.status = 401; return e; };
const sb = {
  s: null,
  configured() { const v = (CFG.SUPABASE_URL || '') + (CFG.SUPABASE_KEY || ''); return !!v && !/XXXX/.test(v); },
  base() { return CFG.SUPABASE_URL.replace(/\/+$/, ''); },
  load() { try { this.s = JSON.parse(lsGet('sb_session') || 'null'); } catch { this.s = null; } },
  save(s) { this.s = s; lsSet('sb_session', s ? JSON.stringify(s) : null); },
  has() { return !!(this.s && this.s.refresh_token); },
  async authCall(grant, body) {
    const r = await fetch(`${this.base()}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST', headers: { apikey: CFG.SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error_description || j.msg || j.message || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return {
      access_token: j.access_token, refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      email: (j.user && j.user.email) || (this.s && this.s.email) || ''
    };
  },
  async login(email, password) { this.save(await this.authCall('password', { email, password })); },
  async refresh() {
    try { this.save(await this.authCall('refresh_token', { refresh_token: this.s.refresh_token })); }
    catch (e) { if (e.status >= 400 && e.status < 500) this.save(null); throw e; }
  },
  async token() {
    if (!this.has()) throw authErr();
    if (this.s.expires_at - Date.now() / 1000 < 60) await this.refresh();
    return this.s.access_token;
  },
  async fetch(path, opt = {}, retry = true) {
    const token = await this.token();
    const headers = Object.assign({ apikey: CFG.SUPABASE_KEY, Authorization: 'Bearer ' + token }, opt.headers || {});
    const r = await fetch(this.base() + path, Object.assign({}, opt, { headers }));
    if (r.status === 401 && retry) { await this.refresh(); return this.fetch(path, opt, false); }
    if (!r.ok) {
      let m = ''; try { const j = await r.clone().json(); m = j.message || j.error || j.msg || ''; } catch { }
      const e = new Error(m || ('HTTP ' + r.status)); e.status = r.status; throw e;
    }
    return r;
  },
  async rest(method, path, body, prefer) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    const r = await this.fetch('/rest/v1/' + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  },
  async upload(path, blob, type) {
    await this.fetch('/storage/v1/object/music/' + encodeURI(path), { method: 'POST', headers: { 'Content-Type': type || 'audio/mpeg', 'x-upsert': 'false' }, body: blob });
  },
  async download(path) { return (await this.fetch('/storage/v1/object/authenticated/music/' + encodeURI(path))).blob(); },
  async removeObject(path) { await this.fetch('/storage/v1/object/music/' + encodeURI(path), { method: 'DELETE' }); }
};

function errMsg(e) {
  if (e && (e.code === 'auth' || e.status === 401)) return 'Cần đăng nhập lại (bấm biểu tượng tài khoản)';
  if (e instanceof TypeError) return 'Không kết nối được mạng';
  if (e && e.status === 413) return 'File quá lớn (gói miễn phí tối đa 50 MB mỗi file)';
  if (e && e.name === 'QuotaExceededError') return 'Hết dung lượng lưu trong máy';
  return (e && e.message) || 'Có lỗi xảy ra';
}

/* ---------- Trạng thái ---------- */
const S = {
  songs: [], playlists: [],
  tab: 'all', openPl: null, filter: '',
  shuffle: false, ctx: null, order: [], pos: -1, curId: null,
  syncing: false
};
const byId = id => S.songs.find(s => s.id === id);
const byPl = id => S.playlists.find(p => p.id === id);
const plSongs = p => p.song_ids.map(byId).filter(Boolean);
const sortSongs = () => S.songs.sort((a, b) => sortKey(a.title, b.title));
const sortPls = () => S.playlists.sort((a, b) => sortKey(a.name, b.name));
const filterSongs = q => { const n = norm(q || ''); return n ? S.songs.filter(s => norm(s.title).includes(n)) : S.songs; };
const canSync = () => navigator.onLine && sb.configured() && sb.has();

/* ---------- Thông báo nhỏ ---------- */
let toastTimer;
function toast(msg, ms = 3200) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function setSyncUI(text, frac) {
  const bar = $('#syncbar');
  if (text == null) { bar.hidden = true; $('#btnSync').classList.remove('spin'); return; }
  bar.hidden = false; $('#btnSync').classList.add('spin');
  $('#synctext').textContent = text;
  $('#syncfill').style.width = Math.round((frac || 0) * 100) + '%';
}

/* ---------- Hiển thị danh sách ---------- */
function songRow(s) {
  return `<li class="row${s.id === S.curId ? ' cur' : ''}" data-id="${s.id}">
    <button class="play" data-a="play">${ICON.eq}<span class="t">${esc(s.title)}</span></button>
    <button class="more" data-a="more" aria-label="Tùy chọn">${ICON.dots}</button></li>`;
}
function renderView() {
  const v = $('#view');
  if (S.tab === 'all') {
    if (!$('#q')) v.innerHTML = `<div class="search"><input id="q" type="search" placeholder="Tìm bài…" autocomplete="off" value="${esc(S.filter)}"></div><div id="list"></div>`;
    renderSongList();
  } else if (S.openPl && byPl(S.openPl)) renderPlaylistDetail();
  else { S.openPl = null; renderPlaylists(); }
}
function renderSongList() {
  const list = filterSongs(S.filter);
  const box = $('#list');
  if (!S.songs.length) {
    box.innerHTML = `<div class="empty">Chưa có bài nào.<br>Bấm dấu + để thêm file nhạc,<br>hoặc bấm ↻ để đồng bộ từ kho nhạc.</div>`;
  } else if (!list.length) {
    box.innerHTML = `<div class="empty">Không tìm thấy bài nào.</div>`;
  } else {
    box.innerHTML = `<ul class="list">${list.map(songRow).join('')}</ul>`;
  }
}
function renderPlaylists() {
  const rows = S.playlists.map(p => `<li class="row" data-pl="${p.id}">
    <button class="play" data-a="openpl"><span class="t">${esc(p.name)}</span><span class="sub">${plSongs(p).length} bài</span></button></li>`).join('');
  $('#view').innerHTML = `<div class="newpl"><button class="btn primary" data-a="newpl">${ICON.plus} Tạo playlist</button></div>` +
    (S.playlists.length ? `<ul class="list">${rows}</ul>` : `<div class="empty">Chưa có playlist nào.</div>`);
}
function renderPlaylistDetail() {
  const p = byPl(S.openPl), list = plSongs(p);
  $('#view').innerHTML = `<div class="pl-head"><button class="icon" data-a="back" aria-label="Quay lại">${ICON.back}</button>
      <h2>${esc(p.name)}</h2><button class="icon" data-a="plmenu" aria-label="Tùy chọn playlist">${ICON.dots}</button></div>
    <div class="pl-actions"><button class="btn primary" data-a="plplay">${ICON.play} Phát</button>
      <button class="btn" data-a="pladd">${ICON.plus} Thêm bài</button></div>` +
    (list.length ? `<ul class="list">${list.map(songRow).join('')}</ul>` : `<div class="empty">Playlist trống. Bấm "Thêm bài" để chọn nhạc.</div>`);
}
function markCurrent() {
  $$('.row[data-id]').forEach(r => r.classList.toggle('cur', r.dataset.id === S.curId));
}

/* ---------- Trình phát ---------- */
const audio = $('#audio');
let curUrl = null, loadSeq = 0, seeking = false, unlocked = false, SILENT_URL = null;

function makeSilentUrl() {
  const n = 800, b = new ArrayBuffer(44 + n), v = new DataView(b);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true); v.setUint16(34, 8, true); w(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
/* iPhone chỉ cho phép phát nhạc sau khi người dùng chạm vào màn hình. Lần chạm đầu tiên
   "mở khóa" thẻ audio bằng một đoạn im lặng, sau đó app mới tự chuyển bài được. */
function unlockAudio() {
  if (unlocked) return; unlocked = true;
  ['click', 'touchend', 'keydown'].forEach(ev => document.removeEventListener(ev, unlockAudio, true));
  if (audio.src) return;
  try { SILENT_URL = makeSilentUrl(); audio.src = SILENT_URL; const p = audio.play(); if (p) p.catch(() => { }); } catch { }
}
['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlockAudio, true));

function buildOrder() {
  const ids = S.ctx ? S.ctx.ids : [], n = ids.length, ci = ids.indexOf(S.curId);
  const order = [...Array(n).keys()];
  if (S.shuffle) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    if (ci >= 0) { order.splice(order.indexOf(ci), 1); order.unshift(ci); }
    S.pos = ci >= 0 ? 0 : -1;
  } else S.pos = ci;
  S.order = order;
}
function refreshCtx() {
  if (!S.ctx) return;
  let ids;
  if (S.ctx.kind === 'pl') { const p = byPl(S.ctx.plId); ids = p ? plSongs(p).map(s => s.id) : []; }
  else ids = filterSongs(S.ctx.q).map(s => s.id);
  S.ctx.ids = ids; buildOrder();
}
function startPlayback(ids, id, ctx) {
  if (!ids.length) return;
  S.ctx = Object.assign({}, ctx, { ids }); S.curId = id; buildOrder(); loadAndPlay(id);
}
function step(dir, auto) {
  const n = S.order.length; if (!n) return;
  if (dir < 0 && !auto && audio.currentTime > 3) { audio.currentTime = 0; return; }
  S.pos = (((S.pos + dir) % n) + n) % n;
  const id = S.ctx.ids[S.order[S.pos]];
  S.curId = id; loadAndPlay(id);
}
/* Đọc sẵn bài kế tiếp từ bộ nhớ để khi hết bài, app chuyển bài ngay lập tức.
   Việc này giúp nhạc tự chuyển bài đáng tin cậy hơn khi iPhone đang tắt màn hình. */
let nextCache = null;
async function prefetchNext() {
  const n = S.order.length; if (n < 2 || !S.ctx) return;
  const nid = S.ctx.ids[S.order[(((S.pos + 1) % n) + n) % n]];
  if (!nid || (nextCache && nextCache.id === nid)) return;
  try { nextCache = { id: nid, blob: await idb.get('blobs', nid) }; } catch { nextCache = null; }
}
async function loadAndPlay(id) {
  const song = byId(id); if (!song) return;
  const seq = ++loadSeq;
  S.curId = id; setNow(song.title); markCurrent();
  let blob;
  if (nextCache && nextCache.id === id && nextCache.blob) blob = nextCache.blob;
  else {
    try { blob = await idb.get('blobs', id); } catch { blob = null; }
    if (seq !== loadSeq) return;
  }
  nextCache = null;
  if (!blob) { toast('Bài này chưa được tải về máy. Hãy bấm ↻ để đồng bộ.'); return; }
  const url = URL.createObjectURL(blob);
  audio.src = url;
  if (curUrl) URL.revokeObjectURL(curUrl);
  curUrl = url;
  setMediaMeta(song);
  const p = audio.play();
  prefetchNext();
  try { await p; } catch (e) { if (e.name !== 'AbortError') toast('Bấm nút ▶ để phát'); }
}
function stopPlayback() {
  loadSeq++; audio.pause(); audio.removeAttribute('src'); audio.load();
  if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = null; }
  S.curId = null; setNow(null); markCurrent(); updatePlayUI();
  if ('mediaSession' in navigator) { try { navigator.mediaSession.metadata = null; } catch { } }
}
function togglePlay() {
  if (!S.curId || !audio.src || audio.src === SILENT_URL) {
    const ids = filterSongs('').map(s => s.id); if (!ids.length) { toast('Chưa có bài nào để phát'); return; }
    const id = S.shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0];
    startPlayback(ids, id, { kind: 'all', q: '' }); return;
  }
  if (audio.paused) audio.play().catch(() => { }); else audio.pause();
}
function setShuffle(on) {
  S.shuffle = on; lsSet('shuffle', on ? '1' : '0');
  $('#btnShuffle').classList.toggle('on', on);
  if (S.ctx) buildOrder();
  toast(on ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên', 1500);
}
function setNow(title) {
  const n = $('#now'); n.textContent = title || 'Chưa chọn bài nào'; n.classList.toggle('empty', !title);
  document.title = title ? title + ' · Nhạc của tôi' : 'Nhạc của tôi';
}
function updatePlayUI() {
  const playing = !!audio.src && audio.src !== SILENT_URL && !audio.paused;
  $('#btnPlay').innerHTML = playing ? ICON.pause : ICON.play;
  document.body.classList.toggle('playing', playing);
}
function updateSeekUI() {
  const seek = $('#seek'), d = audio.duration, c = audio.currentTime;
  if (isFinite(d) && d > 0) { seek.max = d; $('#tDur').textContent = fmtTime(d); } else { seek.max = 0; $('#tDur').textContent = '0:00'; }
  if (!seeking) { seek.value = c || 0; $('#tCur').textContent = fmtTime(c); }
  const pct = isFinite(d) && d > 0 ? Math.min(100, (seeking ? seek.value : c) / d * 100) : 0;
  seek.style.setProperty('--p', pct + '%');
}

/* Màn hình khóa / thông báo của điện thoại */
function setMediaMeta(song) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title, artist: 'Nhạc của tôi',
      artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
  } catch { }
}
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const ms = navigator.mediaSession;
  const set = (a, f) => { try { ms.setActionHandler(a, f); } catch { } };
  set('play', () => audio.play().catch(() => { }));
  set('pause', () => audio.pause());
  set('previoustrack', () => step(-1, true));
  set('nexttrack', () => step(1, true));
  set('seekto', d => { audio.currentTime = d.seekTime; updatePosition(); });
  /* Không đặt seekbackward/seekforward: nếu đặt, iPhone sẽ thay nút Bài trước/Bài sau bằng nút tua 10 giây. */
}
let lastPos = 0;
function updatePosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
  const d = audio.duration; if (!isFinite(d) || d <= 0) return;
  try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, d) }); } catch { }
}
audio.addEventListener('play', () => { updatePlayUI(); if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing'; });
audio.addEventListener('pause', () => { updatePlayUI(); if ('mediaSession' in navigator && audio.src !== SILENT_URL) navigator.mediaSession.playbackState = 'paused'; });
audio.addEventListener('loadedmetadata', () => { updateSeekUI(); updatePosition(); });
audio.addEventListener('durationchange', updateSeekUI);
audio.addEventListener('timeupdate', () => { updateSeekUI(); const t = Date.now(); if (t - lastPos > 1000) { lastPos = t; updatePosition(); } });
audio.addEventListener('ended', () => { if (audio.src === SILENT_URL) return; step(1, true); });
audio.addEventListener('error', () => { if (audio.src && audio.src !== SILENT_URL && audio.getAttribute('src')) toast('Không phát được bài này'); });

const seekEl = $('#seek');
seekEl.addEventListener('input', () => { seeking = true; $('#tCur').textContent = fmtTime(+seekEl.value); updateSeekUI(); });
seekEl.addEventListener('change', () => { audio.currentTime = +seekEl.value; seeking = false; updateSeekUI(); updatePosition(); });

/* ---------- Playlist ---------- */
let pushTimer;
function schedulePush() { clearTimeout(pushTimer); pushTimer = setTimeout(() => { if (canSync() && !S.syncing) pushDirty().catch(() => { }); }, 800); }
async function pushDirty() {
  const pend = (await idb.get('meta', 'pendingPlDel')) || [];
  for (const id of pend) await sb.rest('DELETE', 'playlists?id=eq.' + id);
  if (pend.length) await idb.put('meta', [], 'pendingPlDel');
  for (const p of S.playlists) {
    if (!p.dirty) continue;
    await sb.rest('POST', 'playlists', { id: p.id, name: p.name, song_ids: p.song_ids, updated_at: p.updated_at }, 'resolution=merge-duplicates,return=minimal');
    p.dirty = false; await idb.put('playlists', p);
  }
}
async function savePlaylist(p) {
  p.updated_at = Date.now(); p.dirty = true;
  await idb.put('playlists', p);
  refreshCtx(); renderView(); schedulePush();
}
async function createPlaylist(name) {
  name = (name || '').trim(); if (!name) return null;
  const p = { id: uuid(), name, song_ids: [], updated_at: Date.now(), dirty: true };
  S.playlists.push(p); sortPls();
  await savePlaylist(p); return p;
}
async function deletePlaylist(id) {
  S.playlists = S.playlists.filter(p => p.id !== id);
  await idb.del('playlists', id);
  const pend = (await idb.get('meta', 'pendingPlDel')) || []; pend.push(id);
  await idb.put('meta', pend, 'pendingPlDel');
  if (S.ctx && S.ctx.kind === 'pl' && S.ctx.plId === id) S.ctx = null;
  S.openPl = null; renderView(); schedulePush();
}

/* ---------- Nhạc: thêm / xóa / đồng bộ ---------- */
async function removeLocalSong(id) {
  await idb.del('blobs', id); await idb.del('songs', id);
  S.songs = S.songs.filter(s => s.id !== id);
  if (S.curId === id) stopPlayback();
}
async function addLocalSong(row, blob) {
  await idb.put('blobs', blob, row.id);
  await idb.put('songs', row);
  if (!byId(row.id)) { S.songs.push(row); sortSongs(); }
}
async function uploadFiles(files) {
  files = [...files].filter(f => /\.(mp3|m4a|aac|wav)$/i.test(f.name) || /^audio\//.test(f.type));
  if (!files.length) { toast('Không có file nhạc hợp lệ'); return; }
  if (!sb.configured()) { openAccount('Chưa điền thông tin Supabase trong config.js.'); return; }
  if (!sb.has()) { openAccount('Hãy đăng nhập trước khi thêm nhạc.'); return; }
  if (!navigator.onLine) { toast('Cần có mạng để thêm nhạc'); return; }
  if (S.syncing) { toast('Đang đồng bộ, thử lại sau ít giây'); return; }
  S.syncing = true;
  const have = new Set(S.songs.map(s => s.title + '|' + s.size));
  let ok = 0, dup = 0, fail = 0, lastErr = '';
  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const title = f.name.replace(/\.[^.]+$/, '').trim() || f.name;
      setSyncUI(`Đang tải lên ${i + 1}/${files.length}: ${title}`, i / files.length);
      if (have.has(title + '|' + f.size)) { dup++; continue; }
      const id = uuid(), ext = ((f.name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'mp3').toLowerCase();
      const path = `${id}.${ext}`;
      try {
        await sb.upload(path, f, f.type || 'audio/mpeg');
        let row;
        try {
          const res = await sb.rest('POST', 'songs', { id, title, file_path: path, size: f.size }, 'return=representation');
          row = res && res[0];
        } catch (e) { sb.removeObject(path).catch(() => { }); throw e; }
        await addLocalSong({ id, title, file_path: path, size: f.size, created_at: (row && row.created_at) || new Date().toISOString() }, f);
        have.add(title + '|' + f.size); ok++;
        refreshCtx(); renderView();
      } catch (e) { fail++; lastErr = errMsg(e); if (e.code === 'auth') break; }
    }
  } finally { S.syncing = false; setSyncUI(null); }
  const parts = [];
  if (ok) parts.push(`Đã thêm ${ok} bài`);
  if (dup) parts.push(`${dup} bài đã có`);
  if (fail) parts.push(`${fail} bài lỗi (${lastErr})`);
  toast(parts.join(', ') || 'Xong', 5000);
}
async function deleteSong(id) {
  const s = byId(id); if (!s) return;
  if (!canSync()) { toast('Cần có mạng và đăng nhập để xóa nhạc khỏi kho'); return; }
  if (!confirm(`Xóa "${s.title}" khỏi kho nhạc?\nBài này sẽ bị xóa trên mọi thiết bị.`)) return;
  try {
    await sb.rest('DELETE', 'songs?id=eq.' + id);
    sb.removeObject(s.file_path).catch(() => { });
  } catch (e) { toast(errMsg(e)); return; }
  for (const p of S.playlists) if (p.song_ids.includes(id)) { p.song_ids = p.song_ids.filter(x => x !== id); p.updated_at = Date.now(); p.dirty = true; await idb.put('playlists', p); }
  await removeLocalSong(id); refreshCtx(); renderView(); schedulePush();
  toast('Đã xóa');
}

async function sync(auto) {
  if (S.syncing) return;
  if (!sb.configured()) { if (!auto) openAccount('Chưa điền thông tin Supabase trong config.js.'); return; }
  if (!sb.has()) { if (!auto) openAccount('Hãy đăng nhập để đồng bộ.'); return; }
  if (!navigator.onLine) { if (!auto) toast('Không có mạng, bạn vẫn nghe được nhạc đã tải về máy'); return; }
  S.syncing = true; setSyncUI('Đang đồng bộ…', 0);
  try {
    await pushDirty();
    const rs = await sb.rest('GET', 'songs?select=id,title,file_path,size,created_at&order=created_at.asc');
    const remote = new Set(rs.map(r => r.id));
    let removed = 0;
    for (const s of [...S.songs]) if (!remote.has(s.id)) { await removeLocalSong(s.id); removed++; }
    const missing = rs.filter(r => !byId(r.id));
    let done = 0, failed = 0, lastErr = '';
    for (const r of missing) {
      setSyncUI(`Đang tải về ${done + 1}/${missing.length}: ${r.title}`, done / missing.length);
      try {
        const blob = await sb.download(r.file_path);
        await addLocalSong({ id: r.id, title: r.title, file_path: r.file_path, size: r.size, created_at: r.created_at }, blob);
        done++; renderView();
      } catch (e) { failed++; lastErr = errMsg(e); if (e.code === 'auth' || e instanceof TypeError || e.name === 'QuotaExceededError') throw e; }
    }
    const rp = await sb.rest('GET', 'playlists?select=*');
    const rpIds = new Set(rp.map(p => p.id));
    for (const p of [...S.playlists]) if (!rpIds.has(p.id)) { await idb.del('playlists', p.id); }
    S.playlists = rp.map(p => ({ id: p.id, name: p.name, song_ids: p.song_ids || [], updated_at: p.updated_at || 0, dirty: false }));
    for (const p of S.playlists) await idb.put('playlists', p);
    sortPls(); sortSongs(); refreshCtx(); renderView();
    lsSet('lastSync', String(Date.now()));
    const msg = [];
    if (done) msg.push(`Đã tải về ${done} bài mới`);
    if (removed) msg.push(`đã xóa ${removed} bài`);
    if (failed) msg.push(`${failed} bài lỗi (${lastErr})`);
    if (msg.length) toast(msg.join(', ').replace(/^./, c => c.toUpperCase()), 4500);
    else if (!auto) toast('Đã cập nhật, không có gì mới');
  } catch (e) {
    toast('Đồng bộ chưa xong: ' + errMsg(e), 5000);
  } finally { S.syncing = false; setSyncUI(null); }
}

/* ---------- Bảng chọn (menu) ---------- */
function sheet(title, html) {
  const m = $('#modal');
  m.innerHTML = `<div class="backdrop" data-a="close"></div><div class="sheet" role="dialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2><div class="sbody">${html}</div></div>`;
  m.hidden = false; document.body.classList.add('noscroll');
}
function closeSheet() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; document.body.classList.remove('noscroll'); }

function openSongMenu(id) {
  const s = byId(id); if (!s) return;
  if (S.tab === 'pl' && S.openPl) {
    sheet(s.title, `<button class="item" data-a="m-up" data-id="${id}">Đưa lên trên</button>
      <button class="item" data-a="m-down" data-id="${id}">Đưa xuống dưới</button>
      <button class="item" data-a="m-addpl" data-id="${id}">Thêm vào playlist khác…</button>
      <button class="item danger" data-a="m-rmpl" data-id="${id}">Bỏ khỏi playlist này</button>`);
  } else {
    sheet(s.title, `<button class="item" data-a="m-addpl" data-id="${id}">Thêm vào playlist…</button>
      <button class="item danger" data-a="m-del" data-id="${id}">Xóa khỏi kho nhạc</button>`);
  }
}
function openPlaylistPicker(songId) {
  const rows = S.playlists.map(p => `<button class="pick${p.song_ids.includes(songId) ? ' on' : ''}" data-a="pk-pl" data-pl="${p.id}" data-id="${songId}"><span class="chk">${ICON.check}</span><span class="t">${esc(p.name)}</span></button>`).join('');
  sheet('Thêm vào playlist', rows + `<button class="item" data-a="pk-new" data-id="${songId}">+ Tạo playlist mới</button><button class="btn primary full" data-a="close">Xong</button>`);
}
function openSongPicker() {
  const p = byPl(S.openPl); if (!p) return;
  const rows = S.songs.map(s => `<button class="pick${p.song_ids.includes(s.id) ? ' on' : ''}" data-a="pk-song" data-id="${s.id}"><span class="chk">${ICON.check}</span><span class="t">${esc(s.title)}</span></button>`).join('');
  sheet('Chọn bài cho "' + p.name + '"', (rows || '<p>Chưa có bài nào trong kho nhạc.</p>') + `<button class="btn primary full" data-a="close">Xong</button>`);
}
function openAccount(note) {
  let body = '';
  if (note) body += `<p class="warn">${esc(note)}</p>`;
  if (!sb.configured()) {
    body += `<p>App chưa được nối với kho nhạc. Hãy điền địa chỉ và khóa Supabase vào file <b>config.js</b> (xem HUONG-DAN.md).</p>`;
  } else if (sb.has()) {
    const last = +lsGet('lastSync');
    body += `<p>Đã đăng nhập: <b>${esc(sb.s.email || '')}</b></p>` +
      `<p>Lần đồng bộ gần nhất: ${last ? new Date(last).toLocaleString('vi-VN') : 'chưa có'}</p>` +
      `<p id="storeinfo"></p>` +
      `<button class="btn primary full" data-a="acc-sync">Đồng bộ ngay</button>` +
      `<button class="btn full danger" data-a="acc-logout">Đăng xuất</button>`;
  } else {
    body += `<form id="loginform"><input id="em" type="email" placeholder="Email" autocomplete="username" autocapitalize="off" required>
      <input id="pw" type="password" placeholder="Mật khẩu" autocomplete="current-password" required>
      <button class="btn primary full" type="submit">Đăng nhập</button></form>`;
  }
  body += `<button class="btn full" data-a="close">Đóng</button>`;
  sheet('Tài khoản & đồng bộ', body);
  if (navigator.storage && navigator.storage.estimate) {
    navigator.storage.estimate().then(e => {
      const el = $('#storeinfo'); if (!el || !e.usage) return;
      const mb = n => (n / 1048576).toFixed(0);
      el.textContent = `Đã dùng ${mb(e.usage)} MB trong máy` + (e.quota ? ` (tối đa khoảng ${mb(e.quota)} MB)` : '');
    }).catch(() => { });
  }
}
async function doLogin() {
  const email = $('#em').value.trim(), pw = $('#pw').value;
  const btn = $('#loginform button'); btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
  try {
    await sb.login(email, pw);
    closeSheet(); toast('Đăng nhập thành công');
    sync(false);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Đăng nhập';
    toast(e.status === 400 || e.status === 401 ? 'Sai email hoặc mật khẩu' : errMsg(e), 4500);
  }
}

/* ---------- Xử lý bấm ---------- */
function onViewClick(e) {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, li = el.closest('[data-id]'), id = li && li.dataset.id;
  switch (a) {
    case 'play': {
      if (id === S.curId && audio.src && audio.src !== SILENT_URL) { togglePlay(); return; }
      if (S.tab === 'all') startPlayback(filterSongs(S.filter).map(s => s.id), id, { kind: 'all', q: S.filter });
      else { const p = byPl(S.openPl); startPlayback(plSongs(p).map(s => s.id), id, { kind: 'pl', plId: p.id }); }
      break;
    }
    case 'more': openSongMenu(id); break;
    case 'openpl': S.openPl = el.closest('[data-pl]').dataset.pl; renderView(); break;
    case 'back': S.openPl = null; renderView(); break;
    case 'newpl': { const n = prompt('Tên playlist mới:'); if (n && n.trim()) createPlaylist(n); break; }
    case 'plplay': {
      const ids = plSongs(byPl(S.openPl)).map(s => s.id); if (!ids.length) { toast('Playlist đang trống'); return; }
      startPlayback(ids, S.shuffle ? ids[Math.floor(Math.random() * ids.length)] : ids[0], { kind: 'pl', plId: S.openPl }); break;
    }
    case 'pladd': openSongPicker(); break;
    case 'plmenu': {
      const p = byPl(S.openPl);
      sheet(p.name, `<button class="item" data-a="pl-rename">Đổi tên playlist</button><button class="item danger" data-a="pl-delete">Xóa playlist</button>`); break;
    }
  }
}
async function onModalClick(e) {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  switch (a) {
    case 'close': closeSheet(); break;
    case 'm-addpl': openPlaylistPicker(id); break;
    case 'm-del': closeSheet(); deleteSong(id); break;
    case 'm-rmpl': {
      const p = byPl(S.openPl); closeSheet();
      p.song_ids = p.song_ids.filter(x => x !== id); savePlaylist(p); break;
    }
    case 'm-up': case 'm-down': {
      const p = byPl(S.openPl), ids = plSongs(p).map(s => s.id), i = ids.indexOf(id), j = a === 'm-up' ? i - 1 : i + 1;
      closeSheet(); if (i < 0 || j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]]; p.song_ids = ids; savePlaylist(p); break;
    }
    case 'pk-pl': {
      const p = byPl(el.dataset.pl); if (!p) return;
      p.song_ids = p.song_ids.includes(id) ? p.song_ids.filter(x => x !== id) : [...p.song_ids, id];
      el.classList.toggle('on', p.song_ids.includes(id)); savePlaylist(p); break;
    }
    case 'pk-new': {
      const n = prompt('Tên playlist mới:'); if (!n || !n.trim()) return;
      const p = await createPlaylist(n); p.song_ids.push(id); await savePlaylist(p); openPlaylistPicker(id); break;
    }
    case 'pk-song': {
      const p = byPl(S.openPl); if (!p) return;
      p.song_ids = p.song_ids.includes(id) ? p.song_ids.filter(x => x !== id) : [...p.song_ids, id];
      el.classList.toggle('on', p.song_ids.includes(id)); savePlaylist(p); break;
    }
    case 'pl-rename': {
      const p = byPl(S.openPl), n = prompt('Tên mới của playlist:', p.name); closeSheet();
      if (n && n.trim()) { p.name = n.trim(); sortPls(); savePlaylist(p); } break;
    }
    case 'pl-delete': {
      const p = byPl(S.openPl); closeSheet();
      if (confirm(`Xóa playlist "${p.name}"? (Các bài nhạc vẫn còn trong kho)`)) deletePlaylist(p.id); break;
    }
    case 'acc-sync': closeSheet(); sync(false); break;
    case 'acc-logout':
      if (confirm('Đăng xuất? Nhạc đã tải về máy vẫn nghe được, nhưng sẽ không đồng bộ nữa cho đến khi đăng nhập lại.')) { sb.save(null); closeSheet(); toast('Đã đăng xuất'); }
      break;
  }
}

/* ---------- Khởi động ---------- */
async function init() {
  $$('[data-icon]').forEach(el => { el.innerHTML = ICON[el.dataset.icon]; });
  sb.load();
  S.shuffle = lsGet('shuffle') === '1';
  $('#btnShuffle').classList.toggle('on', S.shuffle);
  try {
    S.songs = await idb.all('songs'); S.playlists = await idb.all('playlists');
  } catch { toast('Không mở được bộ nhớ của trình duyệt'); }
  sortSongs(); sortPls(); renderView(); updatePlayUI();

  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    S.tab = b.dataset.tab; S.openPl = null;
    $$('.tabs button').forEach(x => x.classList.toggle('on', x === b)); renderView();
  }));
  $('#view').addEventListener('click', onViewClick);
  $('#view').addEventListener('input', e => { if (e.target.id === 'q') { S.filter = e.target.value; renderSongList(); } });
  $('#modal').addEventListener('click', onModalClick);
  $('#modal').addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'loginform') doLogin(); });
  $('#btnPlay').addEventListener('click', togglePlay);
  $('#btnNext').addEventListener('click', () => step(1, true));
  $('#btnPrev').addEventListener('click', () => step(-1, false));
  $('#btnShuffle').addEventListener('click', () => setShuffle(!S.shuffle));
  $('#btnSync').addEventListener('click', () => sync(false));
  $('#btnAccount').addEventListener('click', () => openAccount());
  $('#btnUpload').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) uploadFiles(f); });

  // Kéo thả file nhạc vào cửa sổ (máy tính)
  let dragN = 0;
  window.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; document.body.classList.add('drag'); e.preventDefault(); } });
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) document.body.classList.remove('drag'); });
  window.addEventListener('drop', e => { e.preventDefault(); dragN = 0; document.body.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); });

  // Phím tắt trên máy tính
  document.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight') step(1, true);
    else if (e.code === 'ArrowLeft') step(-1, false);
  });

  setupMediaSession();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });

  window.addEventListener('online', () => { if (canSync()) sync(true); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && canSync() && Date.now() - (+lsGet('lastSync') || 0) > 5 * 60 * 1000) sync(true);
  });
  if (!sb.configured()) { if (!S.songs.length) openAccount(); }
  else if (!sb.has()) { if (!S.songs.length && navigator.onLine) openAccount('Hãy đăng nhập để tải nhạc về máy.'); }
  else if (canSync()) sync(true);
}
init();
