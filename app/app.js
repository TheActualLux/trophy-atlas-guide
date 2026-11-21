// Trophy Atlas — GTA VI trophy route planner and dossier (plain ES module, no dependencies).

const LS_TICKS = 'trophy-atlas.ticks.v1';
const LS_SPOILERS = 'trophy-atlas.spoilers.v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const TAG_FILTERS = ['story-critical', 'collectible', 'activity', 'online', 'endgame', 'grind'];

const state = {
  data: null,
  byId: new Map(),
  ticks: {},
  spoilers: false,
  view: 'route', // 'route' | 'trophies' | 'dossier'
  dossierId: null,
  query: '',
  filters: new Set(),
  sort: 'id',
  selected: 0, // index into the currently filtered trophy list
  focusSearchOnce: false, // set by the / shortcut before navigating; consumed by route()
};

// ---------- small helpers ----------

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function escRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Escape text, then wrap query matches in <mark>. Safe because both inputs are escaped first.
function highlight(text, query) {
  const safe = esc(text);
  if (!query) return safe;
  const re = new RegExp('(' + escRegExp(esc(query)) + ')', 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

function hoursLabel(h) {
  if (h === 0) return '—';
  if (h < 1) return '≈ ' + Math.round(h * 60) + ' min';
  return '≈ ' + (Number.isInteger(h) ? h : h.toFixed(1)) + ' h';
}

function status(msg) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(status._t);
  status._t = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- persistence ----------

function loadTicks() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_TICKS) || '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const k of Object.keys(raw)) {
        if (state.byId.has(Number(k))) state.ticks[Number(k)] = true;
      }
    }
  } catch { /* corrupt storage starts clean */ }
}

function saveTicks() {
  localStorage.setItem(LS_TICKS, JSON.stringify(state.ticks));
}

function loadSpoilers() {
  state.spoilers = localStorage.getItem(LS_SPOILERS) === '1';
}

function saveSpoilers() {
  localStorage.setItem(LS_SPOILERS, state.spoilers ? '1' : '0');
}

// ---------- derived values ----------

function earnedCount() {
  return state.data.trophies.filter((t) => state.ticks[t.id]).length;
}

function gradeCounts() {
  const counts = {};
  for (const g of GRADES) counts[g] = { earned: 0, total: 0 };
  for (const t of state.data.trophies) {
    counts[t.grade].total++;
    if (state.ticks[t.id]) counts[t.grade].earned++;
  }
  return counts;
}

function hoursRemaining() {
  return state.data.trophies.reduce((sum, t) => (state.ticks[t.id] ? sum : sum + t.hours), 0);
}

function phaseHours(phase) {
  return phase.trophies.reduce((sum, id) => sum + state.byId.get(id).hours, 0);
}

function filteredTrophies() {
  const q = state.query.trim().toLowerCase();
  const gradeSel = new Set();
  const tagSel = new Set();
  for (const f of state.filters) {
    if (f.startsWith('grade:')) gradeSel.add(f.slice(6));
    else tagSel.add(f);
  }
  let list = state.data.trophies.filter((t) => {
    if (gradeSel.size && !gradeSel.has(t.grade)) return false;
    if (tagSel.size && ![...tagSel].some((tag) => t.tags.includes(tag))) return false;
    if (q) {
      const hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + t.steps.join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const byGrade = { platinum: 0, gold: 1, silver: 2, bronze: 3 };
  if (state.sort === 'grade') list = [...list].sort((a, b) => byGrade[a.grade] - byGrade[b.grade] || a.id - b.id);
  else if (state.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else if (state.sort === 'difficulty') list = [...list].sort((a, b) => b.difficulty - a.difficulty || a.id - b.id);
  else list = [...list].sort((a, b) => a.id - b.id);
  return list;
}

// ---------- routing ----------

function parseHash() {
  const h = location.hash;
  const m = h.match(/^#t(\d+)$/);
  if (m) return { view: 'dossier', id: Number(m[1]) };
  if (h === '#trophies') return { view: 'trophies' };
  return { view: 'route' };
}

function navigate(hash) {
  if (location.hash === hash) route();
  else location.hash = hash; // hashchange drives route()
}

function route() {
  const r = parseHash();
  if (r.view === 'dossier' && !state.byId.has(r.id)) {
    navigate('#route');
    return;
  }
  state.view = r.view;
  state.dossierId = r.view === 'dossier' ? r.id : null;
  if (r.view !== 'dossier') lastList = r.view;
  if (r.view === 'route' && !location.hash) history.replaceState(null, '', '#route');
  render();
  if (state.focusSearchOnce) {
    state.focusSearchOnce = false;
    const s = document.getElementById('search');
    if (s) s.focus();
  }
  window.scrollTo(0, 0);
}

// ---------- rendering ----------

function render() {
  renderTop();
  const app = document.getElementById('app');
  if (state.view === 'dossier') app.innerHTML = renderDossier(state.dossierId);
  else if (state.view === 'trophies') app.innerHTML = renderTrophies();
  else app.innerHTML = renderRoute();
  wire(app);
}

function renderTop() {
  const counts = gradeCounts();
  const earned = earnedCount();
  document.getElementById('earned').textContent = earned + '/55 earned';
  document.getElementById('hours-left').textContent = '≈ ' + Math.round(hoursRemaining()) + ' h remaining';
  document.getElementById('segments').innerHTML = GRADES.map((g) => {
    const c = counts[g];
    const pct = c.total ? Math.round((c.earned / c.total) * 100) : 0;
    return '<span class="segment ' + g + '">' + esc(g[0].toUpperCase() + g.slice(1)) +
      ' <span class="bar"><i style="width:' + pct + '%"></i></span> ' + c.earned + '/' + c.total + '</span>';
  }).join('');
  document.getElementById('spoilers').checked = state.spoilers;
  document.getElementById('tab-route').classList.toggle('active', state.view === 'route');
  document.getElementById('tab-trophies').classList.toggle('active', state.view === 'trophies');
}

function chipHtml(id) {
  const t = state.byId.get(id);
  const earned = state.ticks[id] ? ' earned' : '';
  const miss = t.missable !== 'Not missable.' ? ' missable' : '';
  return '<span class="chip' + earned + miss + '" data-id="' + id + '">' +
    '<span class="tick" role="checkbox" aria-checked="' + !!state.ticks[id] + '" tabindex="0" ' +
    'data-tick="' + id + '" aria-label="Tick ' + esc(t.name) + '">✓</span>' +
    '<a class="label" href="#t' + id + '">' + esc(t.name) + '</a></span>';
}

function renderRoute() {
  const parts = [];
  const next = nextUp();
  if (next) {
    parts.push('<div class="continue">Continue here: <a href="#t' + next.id + '">' +
      esc(next.name) + '</a> — ' + esc(next.phaseName) + '</div>');
  }
  state.data.phases.forEach((p, i) => {
    const earned = p.trophies.filter((id) => state.ticks[id]).length;
    const total = p.trophies.length;
    const pct = total ? Math.round((earned / total) * 100) : 0;
    parts.push(
      '<section class="phase' + (pct === 100 ? ' done' : '') + '" id="phase-' + esc(p.id) + '">' +
      '<div class="phase-head"><span class="phase-num">Phase ' + (i + 1) + ' · ' + esc(p.id) + '</span>' +
      '<h2>' + esc(p.name) + '</h2><span class="phase-goal">' + esc(p.goal) + '</span>' +
      '<span class="phase-meta"><span>' + earned + '/' + total + ' trophies</span>' +
      '<span>' + hoursLabel(phaseHours(p)) + '</span></span></div>' +
      '<div class="phase-progress" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<p class="phase-about">' + esc(p.about) + '</p>' +
      '<div class="chips">' + p.trophies.map(chipHtml).join('') + '</div>' +
      '</section>'
    );
  });
  return parts.join('');
}

function renderTrophies() {
  const list = filteredTrophies();
  const q = state.query.trim();
  // Summary strip: what the current search + filters actually select, and what is left in it.
  const earnedInView = list.filter((t) => state.ticks[t.id]).length;
  const hoursInView = list.reduce((sum, t) => (state.ticks[t.id] ? sum : sum + t.hours), 0);
  const summary = '<div class="summary">' + list.length + ' of 55 trophies in view · ' +
    earnedInView + ' earned here · ≈ ' + Math.round(hoursInView) + ' h unticked in view</div>';
  const rows = list.map((t, i) => {
    const earned = state.ticks[t.id];
    const flags = t.tags.map((tag) => '<span class="fchip on" style="cursor:default">' + esc(tag) + '</span>').join('');
    return '<div class="trow' + (earned ? ' earned' : '') + (i === state.selected ? ' selected' : '') +
      '" data-id="' + t.id + '" data-index="' + i + '" tabindex="0" role="button" aria-label="Open dossier for ' + esc(t.name) + '">' +
      '<span class="tick" role="checkbox" aria-checked="' + !!earned + '" tabindex="0" data-tick="' + t.id + '" aria-label="Tick ' + esc(t.name) + '">✓</span>' +
      '<span class="tid">t' + t.id + '</span>' +
      '<span class="tmain"><span class="tname">' + highlight(t.name, q) + '</span>' +
      '<span class="tdesc">' + highlight(t.description, q) + '</span></span>' +
      '<span class="tflags"><span class="grade-badge grade-' + t.grade + '">' + t.grade + '</span>' + flags + '</span>' +
      '</div>';
  }).join('');
  const tagChips = TAG_FILTERS.map((tag) =>
    '<button type="button" class="fchip' + (state.filters.has(tag) ? ' on' : '') + '" data-filter="' + tag + '">' + tag + '</button>'
  ).join('');
  return (
    '<div class="toolbar">' +
    '<input type="search" id="search" placeholder="Search names, descriptions and guide text ( / )"' +
    ' value="' + esc(state.query) + '" aria-label="Search trophies">' +
    '<select id="sort" aria-label="Sort trophies">' +
    ['id', 'grade', 'name', 'difficulty'].map((s) =>
      '<option value="' + s + '"' + (state.sort === s ? ' selected' : '') + '>Sort: ' + s + '</option>').join('') +
    '</select>' +
    '<span class="filter-group"><span class="fg-label">Grades:</span>' +
    GRADES.map((g) =>
      '<button type="button" class="fchip' + (state.filters.has('grade:' + g) ? ' on' : '') + '" data-filter="grade:' + g + '">' + g + '</button>').join('') +
    '</span>' +
    '<span class="filter-group"><span class="fg-label">Tags:</span>' + tagChips + '</span>' +
    '</div>' +
    summary +
    (rows ? rows : '<p class="empty">No trophies match the current search and filters.</p>')
  );
}

function difficultyDots(n) {
  let out = '<span class="dots" aria-label="Difficulty ' + n + ' of 5">';
  for (let i = 1; i <= 5; i++) out += '<i' + (i <= n ? ' class="on"' : '') + '></i>';
  return out + '</span>';
}

function renderDossier(id) {
  const t = state.byId.get(id);
  const idx = state.data.trophies.findIndex((x) => x.id === id);
  const prev = state.data.trophies[(idx - 1 + 55) % 55];
  const next = state.data.trophies[(idx + 1) % 55];
  const phase = state.data.phases.find((p) => p.id === t.phase);
  const tagBadges = t.tags.map((tag) => '<span class="fchip on" style="cursor:default">' + esc(tag) + '</span>').join('');
  const reqIds = prerequisiteIds(t);
  const reqs = (t.requires === 'None.'
    ? '<span class="did">No explicit prerequisites on this route.</span>'
    : '<span class="did">' + esc(t.requires) + '</span>') + reqIds.map((r) => chipHtml(r)).join('');
  const missableRisk = t.missable !== 'Not missable.';
  const hintBlock = state.spoilers
    ? '<div class="hint"><span class="hint-label">Spoiler-free hint</span>' + esc(t.hint) + '</div>'
    : '<p class="hint-gated">Hint hidden — turn on the Spoilers switch (or press s) to reveal a spoiler-free hint.</p>';
  return (
    '<article class="dossier">' +
    '<a class="back" href="#' + (lastList || 'route') + '">← Back to ' + (lastList || 'route') + '</a>' +
    '<h1>' + esc(t.name) + '</h1>' +
    '<div class="dhead"><span class="did">Trophy t' + t.id + '</span>' +
    '<span class="grade-badge grade-' + t.grade + '">' + t.grade + '</span>' + tagBadges + '</div>' +
    '<p class="guide"><em>' + esc(t.description) + '</em></p>' +
    '<div class="dstats">' +
    '<span class="stat"><b>Difficulty</b>' + difficultyDots(t.difficulty) + '</span>' +
    '<span class="stat"><b>Estimated time</b>' + esc(hoursLabel(t.hours)) + '</span>' +
    '<span class="stat"><b>Route phase</b><a href="#route" data-phase="' + esc(t.phase) + '">' + esc(phase ? phase.name : t.phase) + '</a></span>' +
    '</div>' +
    (missableRisk
      ? '<div class="warn"><b>Missable warning.</b> ' + esc(t.missable) + '</div>'
      : '<div class="warn" style="border-color:var(--line);background:transparent"><b>Missable status.</b> ' + esc(t.missable) + '</div>') +
    '<h3>Route steps</h3><ol class="steps">' + t.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
    '<h3>Guide</h3><p class="guide">' + esc(t.guide) + '</p>' +
    hintBlock +
    '<h3>Prerequisites</h3><div class="reqs">' + reqs + '</div>' +
    '<h3>Verification</h3><p class="verification">' + esc(t.verification) + '</p>' +
    '<h3 class="sources-label">Sources</h3><p class="verification"><span class="did">Sources</span> ' + esc(t.sources.join(', ')) + '</p>' +
    '<div class="dnav">' +
    '<button type="button" data-nav="prev">← ' + esc(prev.name) + ' (t' + prev.id + ')</button>' +
    '<span class="spacer"></span>' +
    '<button type="button" data-nav="next">' + esc(next.name) + ' (t' + next.id + ') →</button>' +
    '</div></article>'
  );
}

// Where the back link on a dossier should return to; the last list view the user saw.
let lastList = 'route';

// ---------- interaction wiring ----------

function toggleTick(id) {
  if (state.ticks[id]) delete state.ticks[id];
  else state.ticks[id] = true;
  saveTicks();
  render();
}

function wire(root) {
  root.querySelectorAll('[data-tick]').forEach((el) => {
    el.addEventListener('click', (e) => { e.stopPropagation(); toggleTick(Number(el.dataset.tick)); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleTick(Number(el.dataset.tick)); }
    });
  });

  root.querySelectorAll('.trow').forEach((row) => {
    row.addEventListener('click', () => navigate('#t' + row.dataset.id));
  });

  const search = document.getElementById('search');
  if (search) {
    search.addEventListener('input', () => {
      state.query = search.value;
      state.selected = 0;
      render();
      const again = document.getElementById('search');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
  }
  const sort = document.getElementById('sort');
  if (sort) sort.addEventListener('change', () => { state.sort = sort.value; state.selected = 0; render(); });

  root.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      if (state.filters.has(f)) state.filters.delete(f);
      else state.filters.add(f);
      state.selected = 0;
      render();
    });
  });

  const phaseLink = root.querySelector('[data-phase]');
  if (phaseLink) {
    phaseLink.addEventListener('click', () => {
      lastList = 'route';
      navigate('#route');
      requestAnimationFrame(() => {
        const card = document.getElementById('phase-' + phaseLink.dataset.phase);
        if (card) card.scrollIntoView({ block: 'start' });
      });
    });
  }

  const prevBtn = root.querySelector('[data-nav="prev"]');
  const nextBtn = root.querySelector('[data-nav="next"]');
  if (prevBtn && state.view === 'dossier') {
    const idx = state.data.trophies.findIndex((x) => x.id === state.dossierId);
    prevBtn.addEventListener('click', () => navigate('#t' + state.data.trophies[(idx + 54) % 55].id));
  }
  if (nextBtn && state.view === 'dossier') {
    const idx = state.data.trophies.findIndex((x) => x.id === state.dossierId);
    nextBtn.addEventListener('click', () => navigate('#t' + state.data.trophies[(idx + 1) % 55].id));
  }
}

// The `requires` field is a sentence; prerequisite trophies are referenced inside it as t<id>.
function prerequisiteIds(t) {
  return (t.requires.match(/t(\d+)/g) || []).map((s) => Number(s.slice(1)));
}

// First unticked trophy the route can still reach, in phase order.
function nextUp() {
  for (const phase of state.data.phases) {
    for (const id of phase.trophies) {
      if (state.ticks[id]) continue;
      const t = state.byId.get(id);
      const blocked = prerequisiteIds(t).some((r) => !state.ticks[r]);
      if (!blocked) {
        return { id: t.id, name: t.name, phaseName: phase.name };
      }
    }
  }
  return null;
}

// ---------- import / export / reset ----------

function exportProgress() {
  const payload = {
    format: 'trophy-atlas-progress',
    game: state.data.game,
    exportedAt: new Date().toISOString(),
    ticks: state.ticks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trophy-atlas-progress.json';
  a.click();
  URL.revokeObjectURL(url);
  status('Progress exported as JSON.');
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object' || typeof parsed.ticks !== 'object' || Array.isArray(parsed.ticks)) {
        throw new Error('unexpected shape');
      }
      state.ticks = {};
      for (const k of Object.keys(parsed.ticks)) {
        if (state.byId.has(Number(k))) state.ticks[Number(k)] = true;
      }
      saveTicks();
      render();
      status('Progress imported: ' + earnedCount() + ' trophies ticked.');
    } catch {
      status('Import failed: not a valid Trophy Atlas progress file.');
    }
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!window.confirm('Clear every tick? Export first if you want to keep progress.')) return;
  state.ticks = {};
  saveTicks();
  render();
  status('All ticks cleared.');
}

// ---------- keyboard ----------

document.addEventListener('keydown', (e) => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable === true;

  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); }
    if (state.view === 'dossier') { history.back(); return; }
    if (state.query) { state.query = ''; state.selected = 0; render(); }
    return;
  }
  if (typing) return;

  if (e.key === '/') {
    e.preventDefault();
    if (state.view !== 'trophies') {
      // Focus deterministically after the hashchange render lands, not from a timer.
      state.focusSearchOnce = true;
      navigate('#trophies');
    } else {
      const s = document.getElementById('search');
      if (s) s.focus();
    }
    return;
  }
  if (e.key === 's' || e.key === 'S') {
    state.spoilers = !state.spoilers;
    saveSpoilers();
    render();
    status('Spoilers ' + (state.spoilers ? 'on' : 'off') + '.');
    return;
  }
  if (state.view !== 'trophies') return;

  const list = filteredTrophies();
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    state.selected = Math.min(list.length - 1, Math.max(0, state.selected + (e.key === 'j' ? 1 : -1)));
    render();
    const row = document.querySelector('.trow[data-index="' + state.selected + '"]');
    if (row) row.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key === 'Enter') {
    const t = list[state.selected];
    if (t) navigate('#t' + t.id);
  }
});

// ---------- top bar wiring (static elements) ----------

document.getElementById('spoilers').addEventListener('change', (e) => {
  state.spoilers = e.target.checked;
  saveSpoilers();
  render();
});
document.getElementById('export-btn').addEventListener('click', exportProgress);
document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', (e) => {
  if (e.target.files[0]) importProgress(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('reset-btn').addEventListener('click', resetProgress);

// ---------- boot ----------

async function boot() {
  const response = await fetch('./data/trophies.json');
  if (!response.ok) throw new Error('trophy data ' + response.status);
  state.data = await response.json();
  if (!Array.isArray(state.data.trophies) || !Array.isArray(state.data.phases)) {
    throw new Error('unexpected trophy data shape');
  }
  for (const t of state.data.trophies) state.byId.set(t.id, t);
  loadSpoilers();
  loadTicks();

  // Dossier may also be requested as ?expand=<id>; normalize it onto the hash router.
  const params = new URLSearchParams(location.search);
  const expand = params.get('expand');
  if (expand && state.byId.has(Number(expand))) {
    history.replaceState(null, '', location.pathname + '#t' + Number(expand));
  }
  if (!location.hash) history.replaceState(null, '', location.pathname + '#route');

  window.addEventListener('hashchange', route);
  route();
}

boot().catch((err) => {
  document.getElementById('app').innerHTML =
    '<p class="noscript">Trophy Atlas failed to load its data: ' + esc(err.message) + '</p>';
});
