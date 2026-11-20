// Trophy Atlas — a single-page GTA VI platinum guide.
// Static ES module, no dependencies, no network beyond the local trophies.json fetch.
// All DOM text is set through textContent / attributes; nothing from data or storage
// is ever interpolated as HTML.

const STORAGE_KEY = 'gta6-trophy-atlas-v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const TAGS = ['missable', 'collectible', 'story-critical'];
const SORTERS = {
  id: (a, b) => a.id - b.id,
  grade: (a, b) => GRADES.indexOf(a.grade) - GRADES.indexOf(b.grade) || a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.id - b.id,
};

const state = {
  earned: new Set(),
  spoilers: true, // true = hints hidden behind per-trophy reveal
  search: '',
  grade: 'all',
  tags: new Set(),
  sort: 'id',
  open: new Set(),
};

const $ = (id) => document.getElementById(id);
const els = {
  count: $('progress-count'),
  total: $('progress-total'),
  percent: $('progress-percent'),
  bar: $('progress-bar'),
  status: $('progress-status'),
  search: $('search'),
  grade: $('grade'),
  sort: $('sort'),
  spoilers: $('spoilers'),
  export: $('export'),
  import: $('import'),
  reset: $('reset'),
  statusMsg: $('status'),
  phases: $('phases'),
  rows: $('rows'),
  empty: $('empty'),
};

let trophies = [];
let phases = [];
let dataReady = false;

// ---------------------------------------------------------------- persistence

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return; // storage unavailable (private mode etc.): run without persistence
  }
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
      if (Array.isArray(data.earned)) {
        state.earned = new Set(data.earned.filter((n) => Number.isInteger(n)));
      }
      if (typeof data.spoilers === 'boolean') state.spoilers = data.spoilers;
      if (typeof data.search === 'string') state.search = data.search;
      if (typeof data.grade === 'string' && (data.grade === 'all' || GRADES.includes(data.grade))) state.grade = data.grade;
      if (Array.isArray(data.tags)) state.tags = new Set(data.tags.filter((t) => TAGS.includes(t)));
      if (typeof data.sort === 'string' && SORTERS[data.sort]) state.sort = data.sort;
      if (Array.isArray(data.open)) state.open = new Set(data.open.filter((n) => Number.isInteger(n)));
    }
  } catch {
    // Corrupt save: ignore it and start clean rather than crash.
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      earned: [...state.earned].sort((a, b) => a - b),
      spoilers: state.spoilers,
      search: state.search,
      grade: state.grade,
      tags: [...state.tags],
      sort: state.sort,
      open: [...state.open].sort((a, b) => a - b),
    }));
  } catch {
    // Quota or availability errors must never break the page itself.
  }
}

function setStatus(message) {
  els.statusMsg.textContent = message;
}

// ---------------------------------------------------------------- rendering

function visibleTrophies() {
  const q = state.search.trim().toLowerCase();
  return trophies.filter((t) => {
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    for (const tag of state.tags) if (!t.tags.includes(tag)) return false;
    if (q) {
      const haystack = `${t.id} ${t.name} ${t.description} ${t.guide}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  }).sort(SORTERS[state.sort]);
}

function gradeTrophies(grade) {
  return trophies.filter((t) => t.grade === grade);
}

function renderProgress() {
  const total = trophies.length;
  els.count.textContent = String(state.earned.size);
  els.total.textContent = String(total);
  const pct = total ? Math.round((state.earned.size / total) * 100) : 0;
  els.percent.textContent = `${pct}%`;
  for (const seg of els.bar.querySelectorAll('.seg')) {
    const grade = seg.dataset.grade;
    const group = gradeTrophies(grade);
    const done = group.filter((t) => state.earned.has(t.id)).length;
    const fill = seg.querySelector('.fill');
    fill.style.width = group.length ? `${Math.round((done / group.length) * 100)}%` : '0%';
    seg.setAttribute('aria-label', `${grade}: ${done} of ${group.length} earned`);
  }
  els.status.textContent = `${state.earned.size} of ${total} trophies earned, ${pct}% to platinum`;
}

function chip(t) {
  const a = document.createElement('a');
  a.className = 'chip';
  if (state.earned.has(t.id)) a.classList.add('done');
  a.href = `#t${t.id}`;
  const id = document.createElement('span');
  id.className = 'chip-id';
  id.textContent = String(t.id);
  a.append(id, document.createTextNode(t.name));
  return a;
}

function renderRoadmap() {
  els.phases.replaceChildren();
  phases.forEach((phase, index) => {
    const li = document.createElement('li');
    li.className = 'phase';
    const h = document.createElement('h3');
    const n = document.createElement('span');
    n.className = 'phase-n';
    n.textContent = `Phase ${index + 1}`;
    const title = document.createElement('span');
    title.textContent = phase.name;
    const time = document.createElement('span');
    time.className = 'phase-time';
    time.textContent = phase.time;
    h.append(n, title, time);
    const p = document.createElement('p');
    p.textContent = phase.about;
    const chips = document.createElement('div');
    chips.className = 'chips';
    for (const id of phase.trophies) {
      const t = trophies.find((x) => x.id === id);
      if (t) chips.append(chip(t));
    }
    li.append(h, p, chips);
    els.phases.append(li);
  });
}

function gradeBadge(t) {
  const span = document.createElement('span');
  span.className = `grade grade-${t.grade}`;
  span.textContent = t.grade;
  return span;
}

function tagBadge(tag) {
  const span = document.createElement('span');
  span.className = `tag tag-${tag}`;
  span.textContent = tag;
  return span;
}

function difficultyStars(n) {
  const span = document.createElement('span');
  span.className = 'difficulty';
  const label = document.createElement('span');
  label.setAttribute('aria-hidden', 'true');
  label.textContent = '★'.repeat(n) + '☆'.repeat(5 - n);
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = `Difficulty ${n} of 5`;
  span.append(label, sr);
  return span;
}

function detailPanel(t) {
  const div = document.createElement('div');
  div.className = 'trophy-detail';
  div.id = `detail-${t.id}`;

  const p = document.createElement('p');
  p.className = 'guide';
  p.textContent = t.guide;
  div.append(p);

  const meta = document.createElement('p');
  meta.className = 'meta';
  const est = document.createElement('span');
  est.append(document.createTextNode('Estimate: '), Object.assign(document.createElement('strong'), { textContent: t.time }));
  const diff = document.createElement('span');
  diff.append(document.createTextNode('Difficulty: '), Object.assign(document.createElement('strong'), { textContent: `${t.difficulty} / 5` }));
  meta.append(diff, est);
  div.append(meta);

  const note = document.createElement('p');
  note.className = 'missable-note';
  note.textContent = `Missable: ${t.missable}`;
  div.append(note);

  const gate = document.createElement('div');
  gate.className = 'spoiler-gate';
  if (state.spoilers) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spoiler-btn';
    btn.textContent = 'Reveal spoiler-free hint';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', `hint-${t.id}`);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      hint.hidden = open;
      if (!open) btn.textContent = 'Hide hint';
      else btn.textContent = 'Reveal spoiler-free hint';
    });
    const hint = document.createElement('p');
    hint.className = 'hint-text';
    hint.id = `hint-${t.id}`;
    hint.hidden = true;
    hint.textContent = t.hint;
    gate.append(btn, hint);
  } else {
    const hint = document.createElement('p');
    hint.className = 'hint-text';
    hint.id = `hint-${t.id}`;
    hint.textContent = t.hint;
    gate.append(hint);
  }
  div.append(gate);
  return div;
}

function trophyItem(t) {
  const li = document.createElement('li');
  li.className = 'trophy';
  if (state.earned.has(t.id)) li.classList.add('earned');
  li.id = `t${t.id}`;

  const row = document.createElement('div');
  row.className = 'trophy-row';

  const check = document.createElement('div');
  check.className = 'trophy-check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = state.earned.has(t.id);
  box.setAttribute('aria-label', `Mark ${t.name} as earned`);
  box.addEventListener('change', () => {
    if (box.checked) state.earned.add(t.id);
    else state.earned.delete(t.id);
    save();
    render();
  });
  check.append(box);

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'trophy-main';
  const expanded = state.open.has(t.id);
  main.setAttribute('aria-expanded', String(expanded));
  main.setAttribute('aria-controls', `detail-${t.id}`);

  const title = document.createElement('div');
  title.className = 'trophy-title';
  const tid = document.createElement('span');
  tid.className = 'tid';
  tid.textContent = `#${t.id}`;
  const name = document.createElement('span');
  name.className = 'tname';
  name.textContent = t.name;
  title.append(tid, name, gradeBadge(t));
  for (const tag of t.tags) title.append(tagBadge(tag));

  const desc = document.createElement('div');
  desc.className = 'muted';
  desc.textContent = t.description;
  desc.style.fontSize = '12.5px';
  desc.style.marginTop = '2px';

  main.append(title, desc);
  main.addEventListener('click', () => {
    if (state.open.has(t.id)) state.open.delete(t.id);
    else state.open.add(t.id);
    save();
    render();
  });

  row.append(check, main, difficultyStars(t.difficulty));
  li.append(row);
  if (expanded) {
    const caret = document.createElement('div');
    caret.className = 'caret';
    caret.textContent = '▾';
    caret.setAttribute('aria-hidden', 'true');
    row.append(caret);
    li.append(detailPanel(t));
  }
  return li;
}

// Improvement pass — keyboard focus retention across re-renders. renderList() rebuilds
// the list with replaceChildren(), which destroys the focused element (a row's checkbox,
// expand button or hint button) and drops keyboard users back to <body>. The helpers
// below capture where focus was and restore it onto the equivalent element in the new DOM,
// so ticking a trophy or expanding rows with the keyboard never loses the caret.
function focusKeyOf(el) {
  if (!(el instanceof Element)) return null;
  const item = el.closest('.trophy');
  const match = item ? /^t(\d+)$/.exec(item.id) : null;
  if (!item || !match) return null;
  if (el.closest('.trophy-check')) return { id: match[1], kind: 'check' };
  if (el.classList.contains('trophy-main')) return { id: match[1], kind: 'main' };
  if (el.classList.contains('spoiler-btn')) return { id: match[1], kind: 'spoiler' };
  return null;
}

function restoreFocus(key) {
  if (!key) return;
  const item = document.getElementById(`t${key.id}`);
  if (!item) return;
  const selector = key.kind === 'check' ? '.trophy-check input'
    : key.kind === 'main' ? '.trophy-main'
    : '.spoiler-btn';
  const el = item.querySelector(selector);
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
}

function renderList() {
  const focus = focusKeyOf(document.activeElement);
  const list = visibleTrophies();
  els.rows.replaceChildren(...list.map(trophyItem));
  els.empty.hidden = list.length > 0;
  restoreFocus(focus);
}

function render() {
  renderProgress();
  renderRoadmap();
  renderList();
}

// ---------------------------------------------------------------- data load & validation

async function loadData() {
  const response = await fetch('data/trophies.json');
  if (!response.ok) throw new Error(`trophies.json: HTTP ${response.status}`);
  const doc = await response.json();
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('trophies.json: not an object');
  if (!Array.isArray(doc.trophies)) throw new Error('trophies.json: missing trophies array');
  if (!Array.isArray(doc.phases)) throw new Error('trophies.json: missing phases array');
  const ids = new Set();
  for (const t of doc.trophies) {
    for (const key of ['id', 'name', 'description', 'grade', 'guide', 'hint', 'tags', 'difficulty', 'time', 'phase', 'missable']) {
      if (!(key in t)) throw new Error(`trophies.json: trophy missing ${key}`);
    }
    if (!Number.isInteger(t.id) || t.id < 1) throw new Error(`trophies.json: bad id ${String(t.id)}`);
    if (ids.has(t.id)) throw new Error(`trophies.json: duplicate id ${t.id}`);
    ids.add(t.id);
    if (!GRADES.includes(t.grade)) throw new Error(`trophies.json: bad grade on trophy ${t.id}`);
    if (typeof t.guide !== 'string' || t.guide.length < 40) throw new Error(`trophies.json: bad guide on trophy ${t.id}`);
    if (!Array.isArray(t.tags)) throw new Error(`trophies.json: bad tags on trophy ${t.id}`);
    if (!Number.isInteger(t.difficulty) || t.difficulty < 1 || t.difficulty > 5) throw new Error(`trophies.json: bad difficulty on trophy ${t.id}`);
  }
  const phaseIds = new Set(doc.phases.map((p) => p.id));
  for (const t of doc.trophies) {
    if (!phaseIds.has(t.phase)) throw new Error(`trophies.json: trophy ${t.id} references unknown phase ${String(t.phase)}`);
  }
  return doc;
}

// ---------------------------------------------------------------- export / import / reset

function exportProgress() {
  const payload = {
    app: 'gta6-trophy-guide-01',
    version: 1,
    exportedAt: new Date().toISOString(),
    earned: [...state.earned].sort((a, b) => a - b),
    spoilers: state.spoilers,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'trophy-atlas-progress.json';
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('Progress exported.');
}

// Import validation (second pass, hardened): the file must be JSON shaped exactly
// like our export — an object with an integer-array "earned" of known trophy ids —
// or a plain array of the same. Anything else is rejected with a message and
// nothing is written to state or storage.
function validateImport(value) {
  if (value === null || typeof value !== 'object') return null;
  const earned = Array.isArray(value) ? value : value.earned;
  if (!Array.isArray(earned)) return null;
  const ids = new Set(trophies.map((t) => t.id));
  const clean = [];
  for (const n of earned) {
    if (!Number.isInteger(n) || !ids.has(n)) return null;
    if (!clean.includes(n)) clean.push(n);
  }
  return { earned: clean, spoilers: typeof value.spoilers === 'boolean' ? value.spoilers : null };
}

async function importProgress(file) {
  if (!file) return;
  let text;
  try {
    text = await file.text();
  } catch {
    setStatus('Import failed: the file could not be read.');
    return;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    setStatus('Import failed: the file is not valid JSON.');
    return;
  }
  const result = validateImport(value);
  if (!result) {
    setStatus(`Import failed: expected an "earned" array of trophy ids between 1 and ${trophies.length}.`);
    return;
  }
  state.earned = new Set(result.earned);
  if (result.spoilers !== null) {
    state.spoilers = result.spoilers;
    syncSpoilersButton();
  }
  save();
  render();
  setStatus(`Imported ${result.earned.length} earned trophies.`);
}

function resetProgress() {
  if (!window.confirm('Reset all earned ticks, filters and opened panels? This cannot be undone.')) return;
  state.earned = new Set();
  state.search = '';
  state.grade = 'all';
  state.tags = new Set();
  state.sort = 'id';
  state.open = new Set();
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  els.search.value = '';
  els.grade.value = 'all';
  els.sort.value = 'id';
  for (const btn of document.querySelectorAll('.tagbtn')) btn.setAttribute('aria-pressed', 'false');
  syncSpoilersButton();
  save();
  render();
  setStatus('Progress reset.');
}

// ---------------------------------------------------------------- interactions

function syncSpoilersButton() {
  els.spoilers.setAttribute('aria-pressed', String(state.spoilers));
  els.spoilers.textContent = '';
  const label = document.createElement('span');
  label.textContent = state.spoilers ? 'Spoilers hidden' : 'Spoilers shown';
  const kbd = document.createElement('kbd');
  kbd.textContent = 's';
  els.spoilers.append(label, ' ', kbd);
}

function toggleSpoilers() {
  state.spoilers = !state.spoilers;
  syncSpoilersButton();
  save();
  render();
}

function applyFiltersFromControls() {
  state.search = els.search.value;
  state.grade = els.grade.value;
  state.sort = els.sort.value;
  save();
  renderList();
  renderProgress();
}

function restoreControls() {
  els.search.value = state.search;
  els.grade.value = state.grade;
  els.sort.value = state.sort;
  for (const btn of document.querySelectorAll('.tagbtn')) {
    btn.setAttribute('aria-pressed', String(state.tags.has(btn.dataset.tag)));
  }
}

// Deep links: #t<id> opens and expands that trophy.
function openFromHash() {
  const match = /^#t(\d+)$/.exec(window.location.hash);
  if (!match) return;
  const id = Number.parseInt(match[1], 10);
  const t = trophies.find((x) => x.id === id);
  if (!t) return;
  // Make sure the trophy is actually visible under the current filters.
  const isVisible = visibleTrophies().some((x) => x.id === id);
  if (!isVisible) {
    state.search = '';
    state.grade = 'all';
    state.tags = new Set();
    restoreControls();
  }
  state.open.add(id);
  save();
  render();
  const el = document.getElementById(`t${id}`);
  if (el) {
    el.scrollIntoView({ block: 'start' });
    el.classList.add('flash');
    window.setTimeout(() => el.classList.remove('flash'), 1600);
  }
}

function onKeyDown(event) {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (event.key === '/' && !typing) {
    event.preventDefault();
    els.search.focus();
    return;
  }
  if (event.key === 'Escape') {
    if (target === els.search && els.search.value) {
      els.search.value = '';
      applyFiltersFromControls();
    } else if (target instanceof HTMLElement) {
      target.blur();
    }
    return;
  }
  if ((event.key === 's' || event.key === 'S') && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    toggleSpoilers();
  }
}

// ---------------------------------------------------------------- boot

async function boot() {
  load();
  try {
    const doc = await loadData();
    trophies = doc.trophies;
    phases = doc.phases;
  } catch (err) {
    setStatus(`Failed to load trophy data: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  dataReady = true;
  restoreControls();
  syncSpoilersButton();
  render();
  openFromHash();
  setStatus('');

  els.search.addEventListener('input', applyFiltersFromControls);
  els.grade.addEventListener('change', applyFiltersFromControls);
  els.sort.addEventListener('change', applyFiltersFromControls);
  for (const btn of document.querySelectorAll('.tagbtn')) {
    btn.addEventListener('click', () => {
      const tag = btn.dataset.tag;
      if (state.tags.has(tag)) state.tags.delete(tag);
      else state.tags.add(tag);
      btn.setAttribute('aria-pressed', String(state.tags.has(tag)));
      save();
      renderList();
    });
  }
  els.spoilers.addEventListener('click', toggleSpoilers);
  els.export.addEventListener('click', exportProgress);
  els.import.addEventListener('change', () => {
    const file = els.import.files && els.import.files[0];
    importProgress(file).finally(() => { els.import.value = ''; });
  });
  els.reset.addEventListener('click', resetProgress);
  window.addEventListener('hashchange', openFromHash);
  document.addEventListener('keydown', onKeyDown);
}

boot();
