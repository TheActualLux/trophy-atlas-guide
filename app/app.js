const PROGRESS_KEY = 'leonida-atlas-progress-v1';
const SPOILERS_KEY = 'leonida-atlas-spoilers-v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const TAGS = ['story-critical', 'collectible', 'activity', 'online', 'endgame', 'grind'];
const state = {
  data: null, trophies: [], byId: new Map(), ticks: new Set(), spoilers: false,
  view: 'route', openId: null, returnView: 'route', query: '', grades: new Set(),
  tags: new Set(), order: 'id', cursor: 0, inline: new Set(),
};
const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
let noticeTimer;

function escapeHtml(input) {
  return String(input).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function highlight(input, query) {
  const text = String(input);
  const needle = query.trim();
  if (!needle) return escapeHtml(text);
  const lower = text.toLocaleLowerCase();
  const search = needle.toLocaleLowerCase();
  let at = 0;
  let html = '';
  while (at < text.length) {
    const found = lower.indexOf(search, at);
    if (found < 0) break;
    html += escapeHtml(text.slice(at, found));
    html += `<mark>${escapeHtml(text.slice(found, found + needle.length))}</mark>`;
    at = found + needle.length;
  }
  return html + escapeHtml(text.slice(at));
}

function notify(message) {
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.remove('visible'), 2200);
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '[]');
    if (Array.isArray(saved)) state.ticks = new Set(saved.filter((id) => Number.isInteger(id) && state.byId.has(id)));
  } catch { state.ticks = new Set(); }
  state.spoilers = localStorage.getItem(SPOILERS_KEY) === 'true';
}

function saveTicks() {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...state.ticks].sort((a, b) => a - b)));
}

function formatHours(value) {
  if (value === 0) return 'No extra time';
  if (value < 1) return `About ${Math.round(value * 60)} min`;
  return `About ${Number.isInteger(value) ? value : value.toFixed(1)} hr`;
}

function outstanding(items = state.trophies) {
  return items.reduce((sum, trophy) => sum + (state.ticks.has(trophy.id) ? 0 : trophy.hours), 0);
}

function syncChrome() {
  const count = state.ticks.size;
  document.querySelector('#earned-count').textContent = `${count} / ${state.trophies.length}`;
  document.querySelector('#overall-fill').style.width = `${100 * count / state.trophies.length}%`;
  document.querySelector('#remaining-time').textContent = `${Math.ceil(outstanding())} hours left`;
  document.querySelector('#spoilers').checked = state.spoilers;
  document.querySelector('#route-tab').classList.toggle('active', state.view === 'route');
  document.querySelector('#trophies-tab').classList.toggle('active', state.view === 'trophies');
}

function gradeBadge(grade) {
  return `<span class="grade grade-${escapeHtml(grade)}">${escapeHtml(grade)}</span>`;
}

function tagMarkup(tags, active = false) {
  return tags.map((tag) => `<span class="tag${active ? ' active' : ''}">${escapeHtml(tag)}</span>`).join('');
}

function chipMarkup(id) {
  const trophy = state.byId.get(id);
  const done = state.ticks.has(id);
  const miss = trophy.missable !== 'Not missable.';
  return `<span class="chip${done ? ' done' : ''}"><button class="tick" type="button" data-tick="${id}" aria-label="${done ? 'Unmark' : 'Mark'} ${escapeHtml(trophy.name)}" aria-pressed="${done}">✓</button><a class="chip-name" href="#t${id}">${escapeHtml(trophy.name)}</a>${miss ? '<span class="miss-mark" title="Review missable note">!</span>' : ''}</span>`;
}

function renderRoute() {
  const phases = state.data.phases;
  const nextTrophy = phases.flatMap((phase) => phase.trophies).map((id) => state.byId.get(id)).find((trophy) => !state.ticks.has(trophy.id));
  let html = '<header class="intro"><p class="kicker">The platinum itinerary</p><h1>Eight chapters of a Leonida run.</h1><p>Complete the story before the broad clean-up, then use the in-game trackers to finish each sweep. Hours are editorial estimates; your checklist follows progress in this browser.</p></header>';
  if (nextTrophy) html += `<aside class="pickup"><strong>Next on the route:</strong> <a href="#t${nextTrophy.id}">${escapeHtml(nextTrophy.name)}</a> · ${escapeHtml(nextTrophy.description)}</aside>`;
  html += phases.map((phase, index) => {
    const items = phase.trophies.map((id) => state.byId.get(id));
    const earned = items.filter((trophy) => state.ticks.has(trophy.id)).length;
    const percent = Math.round(100 * earned / items.length);
    const hours = items.reduce((total, trophy) => total + trophy.hours, 0);
    return `<section class="phase${percent === 100 ? ' complete' : ''}" id="phase-${escapeHtml(phase.id)}">
      <div class="phase-heading"><span class="phase-number">Phase ${index + 1}</span><h2>${escapeHtml(phase.name)}</h2><span class="phase-hours">${formatHours(hours)} · ${earned}/${items.length}</span></div>
      <p class="objective">${escapeHtml(phase.goal)}</p><p class="order-note">${escapeHtml(phase.about)}</p>
      <div class="phase-track" role="progressbar" aria-label="${escapeHtml(phase.name)} progress" aria-valuemin="0" aria-valuemax="${items.length}" aria-valuenow="${earned}" aria-valuetext="${earned} of ${items.length} trophies, ${percent} percent"><i style="width:${percent}%"></i></div>
      <p class="phase-status">${percent}% complete</p><div class="chip-list">${phase.trophies.map(chipMarkup).join('')}</div>
    </section>`;
  }).join('');
  return html;
}

function filterTrophies() {
  const query = state.query.trim().toLocaleLowerCase();
  let list = state.trophies.filter((trophy) => {
    if (state.grades.size && !state.grades.has(trophy.grade)) return false;
    if (state.tags.size && ![...state.tags].some((tag) => trophy.tags.includes(tag))) return false;
    return !query || [trophy.name, trophy.description, trophy.guide, trophy.steps.join(' ')].join(' ').toLocaleLowerCase().includes(query);
  });
  const gradeRank = new Map(GRADES.map((grade, index) => [grade, index]));
  if (state.order === 'grade') list.sort((a, b) => gradeRank.get(a.grade) - gradeRank.get(b.grade) || a.id - b.id);
  else if (state.order === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (state.order === 'difficulty') list.sort((a, b) => b.difficulty - a.difficulty || a.id - b.id);
  else if (state.order === 'hours') list.sort((a, b) => a.hours - b.hours || a.id - b.id);
  else list.sort((a, b) => a.id - b.id);
  return list;
}

function toolbarMarkup() {
  const gradeOptions = GRADES.map((grade) => `<button type="button" class="filter-option${state.grades.has(grade) ? ' on' : ''}" data-grade="${grade}" aria-pressed="${state.grades.has(grade)}">${grade}</button>`).join('');
  const tagOptions = TAGS.map((tag) => `<button type="button" class="filter-option${state.tags.has(tag) ? ' on' : ''}" data-tag="${tag}" aria-pressed="${state.tags.has(tag)}">${tag}</button>`).join('');
  const sorts = [['id', 'List order'], ['grade', 'Grade'], ['name', 'Name'], ['difficulty', 'Difficulty'], ['hours', 'Estimated hours']]
    .map(([value, label]) => `<option value="${value}"${state.order === value ? ' selected' : ''}>${label}</option>`).join('');
  return `<div class="filters"><input id="search" type="search" aria-label="Search trophies" placeholder="Search names, descriptions, and guide text ( / )" value="${escapeHtml(state.query)}"><select id="sort" aria-label="Sort trophies">${sorts}</select><div class="filter-group" aria-label="Grade filter"><span class="filter-label">Grade</span>${gradeOptions}</div><div class="filter-group" aria-label="Tag filter"><span class="filter-label">Tag</span>${tagOptions}</div></div>`;
}

function renderDossier(trophy, inline = false) {
  const index = state.trophies.findIndex((item) => item.id === trophy.id);
  const prev = state.trophies[(index - 1 + state.trophies.length) % state.trophies.length];
  const next = state.trophies[(index + 1) % state.trophies.length];
  const phase = state.data.phases.find((item) => item.id === trophy.phase);
  const hint = state.spoilers
    ? `<div class="hint-card"><span class="hint-label">Spoiler-gated hint</span>${escapeHtml(trophy.hint)}</div>`
    : '<p class="hint-hidden">Hint hidden. Turn on Spoilers or press S to reveal it.</p>';
  const backHash = inline ? '#trophies' : `#${state.returnView}`;
  const backCopy = inline ? 'Close this dossier' : `← Back to ${state.returnView === 'trophies' ? 'trophies' : 'route'}`;
  return `<article class="dossier"><a class="dossier-back" href="${backHash}"${inline ? ` data-collapse="${trophy.id}"` : ''}>${backCopy}</a>
    <header><div class="dossier-top"><span class="dossier-id">Trophy ${trophy.id}</span>${gradeBadge(trophy.grade)}<span class="dossier-tags">${tagMarkup(trophy.tags, true)}</span></div><h1>${escapeHtml(trophy.name)}</h1><p class="official-description">${escapeHtml(trophy.description)}</p></header>
    <div class="facts"><div class="fact"><span class="fact-label">Difficulty</span><span class="difficulty-rating" aria-label="${trophy.difficulty} out of 5">${'●'.repeat(trophy.difficulty)}${'○'.repeat(5 - trophy.difficulty)} ${trophy.difficulty}/5</span></div><div class="fact"><span class="fact-label">Estimated time</span>${formatHours(trophy.hours)}</div><div class="fact"><span class="fact-label">Route phase</span><a href="#route">${escapeHtml(phase?.name || 'Route')}</a></div></div>
    <section class="dossier-block"><h2>Missable note</h2><p class="miss-note${trophy.missable === 'Not missable.' ? '' : ' risk'}">${trophy.missable === 'Not missable.' ? '' : '<strong>Missable check.</strong> '}${escapeHtml(trophy.missable)}</p></section>
    <section class="dossier-block"><h2>Steps</h2><ol class="steps">${trophy.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>
    <section class="dossier-block"><h2>Guide</h2><p>${escapeHtml(trophy.guide)}</p></section>
    <section class="dossier-block"><h2>Hint</h2>${hint}</section>
    <section class="dossier-block"><h2>Prerequisites</h2><p class="prerequisite">${escapeHtml(trophy.requires)}</p></section>
    <section class="dossier-block"><h2>Verification</h2><p class="verify">${escapeHtml(trophy.verification)}</p></section>
    <section class="dossier-block"><h2>Sources</h2><p class="source-text">${escapeHtml(trophy.sources.join(' · '))}</p></section>
    <nav class="neighbors" aria-label="Previous and next trophies"><a href="#t${prev.id}">← T${prev.id}: ${escapeHtml(prev.name)}</a><span class="grow"></span><a href="#t${next.id}">T${next.id}: ${escapeHtml(next.name)} →</a></nav>
  </article>`;
}

function renderInline(trophy) {
  return `<section id="inline-${trophy.id}" class="inline-dossier"${state.inline.has(trophy.id) ? '' : ' hidden'}>${renderDossier(trophy, true)}</section>`;
}

function renderTrophies() {
  const list = filterTrophies();
  state.cursor = Math.min(state.cursor, Math.max(0, list.length - 1));
  const done = list.filter((trophy) => state.ticks.has(trophy.id)).length;
  const query = state.query.trim();
  const guideMatches = list.filter((trophy) => query && trophy.guide.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length;
  const summary = `<p class="list-count">${list.length} of 55 trophies · ${done} earned · ${Math.ceil(outstanding(list))} unticked hours${guideMatches ? ` · ${guideMatches} guide matches` : ''}</p>`;
  const rows = list.map((trophy, index) => {
    const earned = state.ticks.has(trophy.id);
    const expanded = state.inline.has(trophy.id);
    const guideMatch = query && trophy.guide.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return `<article class="entry"><div class="entry-head${earned ? ' done' : ''}${index === state.cursor ? ' selected' : ''}" data-row="${trophy.id}" data-index="${index}" tabindex="0" aria-expanded="${expanded}">
      <button class="tick" type="button" data-tick="${trophy.id}" aria-label="${earned ? 'Unmark' : 'Mark'} ${escapeHtml(trophy.name)}" aria-pressed="${earned}">✓</button><span class="entry-id">T${trophy.id}</span>
      <span class="entry-copy"><span class="entry-name">${highlight(trophy.name, query)}</span><span class="entry-description">${highlight(trophy.description, query)}${guideMatch ? ` · Guide: ${highlight(trophy.guide, query)}` : ''}</span></span>
      <span class="entry-badges">${gradeBadge(trophy.grade)}${tagMarkup(trophy.tags)}</span><button class="expand-button" data-expand="${trophy.id}" type="button" aria-label="${expanded ? 'Collapse' : 'Expand'} ${escapeHtml(trophy.name)}">${expanded ? '−' : '+'}</button>
    </div>${renderInline(trophy)}</article>`;
  }).join('');
  return `<header class="intro"><p class="kicker">The complete checklist</p><h1>Fifty-five trophies, one place.</h1><p>Filter by grade or tag, sort the list, and search official descriptions together with the guide text. Open a dossier inline or follow its trophy route.</p></header>${toolbarMarkup()}${summary}${rows || '<p class="empty">No trophies match. Clear a filter or try another search.</p>'}`;
}

function paint() {
  syncChrome();
  if (state.view === 'dossier') {
    const trophy = state.byId.get(state.openId);
    app.innerHTML = trophy ? renderDossier(trophy) : renderRoute();
  } else if (state.view === 'trophies') app.innerHTML = renderTrophies();
  else app.innerHTML = renderRoute();
}

function parseAddress() {
  const hash = location.hash || '#route';
  if (hash === '#trophies') return { view: 'trophies', id: null };
  const match = /^#t(\d+)$/.exec(hash);
  if (match && state.byId.has(Number(match[1]))) return { view: 'dossier', id: Number(match[1]) };
  return { view: 'route', id: null };
}

function followAddress() {
  const parsed = parseAddress();
  if (state.view !== 'dossier') state.returnView = state.view;
  state.view = parsed.view;
  state.openId = parsed.id;
  paint();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function go(hash) {
  if (location.hash === hash) followAddress();
  else location.hash = hash;
}

function toggleTick(id) {
  if (!state.byId.has(id)) return;
  if (state.ticks.has(id)) state.ticks.delete(id); else state.ticks.add(id);
  saveTicks();
  paint();
}

function toggleInline(id) {
  if (state.inline.has(id)) state.inline.delete(id); else state.inline.add(id);
  paint();
  const card = document.querySelector(`#inline-${id}`);
  if (card && !card.hidden) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function exportProgress() {
  const data = { format: 'leonida-atlas-progress-v1', game: state.data.game, ticks: [...state.ticks].sort((a, b) => a - b) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leonida-atlas-progress.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  notify('Progress exported.');
}

async function importProgress(file) {
  try {
    const incoming = JSON.parse(await file.text());
    if (!incoming || !Array.isArray(incoming.ticks)) throw new Error('Unexpected data.');
    state.ticks = new Set(incoming.ticks.filter((id) => Number.isInteger(id) && state.byId.has(id)));
    saveTicks();
    paint();
    notify(`Imported ${state.ticks.size} trophy ticks.`);
  } catch { notify('Import failed: choose an Atlas progress JSON file.'); }
}

function clearProgress() {
  if (!confirm('Clear every trophy tick saved by this guide?')) return;
  state.ticks.clear();
  saveTicks();
  paint();
  notify('Progress cleared.');
}

function connect() {
  document.querySelector('#route-tab').addEventListener('click', (event) => { event.preventDefault(); go('#route'); });
  document.querySelector('#trophies-tab').addEventListener('click', (event) => { event.preventDefault(); go('#trophies'); });
  document.querySelector('#spoilers').addEventListener('change', (event) => {
    state.spoilers = event.currentTarget.checked;
    localStorage.setItem(SPOILERS_KEY, String(state.spoilers));
    paint();
  });
  document.querySelector('#export').addEventListener('click', exportProgress);
  document.querySelector('#import').addEventListener('click', () => document.querySelector('#import-file').click());
  document.querySelector('#import-file').addEventListener('change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) importProgress(file);
    event.currentTarget.value = '';
  });
  document.querySelector('#reset').addEventListener('click', clearProgress);
  window.addEventListener('hashchange', followAddress);
  app.addEventListener('click', (event) => {
    const control = event.target.closest('button, a, [data-row]');
    if (!control) return;
    if (control.matches('[data-tick]')) { event.preventDefault(); event.stopPropagation(); toggleTick(Number(control.dataset.tick)); }
    else if (control.matches('[data-expand]')) { event.preventDefault(); toggleInline(Number(control.dataset.expand)); }
    else if (control.matches('[data-collapse]')) { event.preventDefault(); state.inline.delete(Number(control.dataset.collapse)); paint(); }
    else if (control.matches('[data-grade]')) {
      const grade = control.dataset.grade;
      state.grades.has(grade) ? state.grades.delete(grade) : state.grades.add(grade);
      state.cursor = 0; paint();
    } else if (control.matches('[data-tag]')) {
      const tag = control.dataset.tag;
      state.tags.has(tag) ? state.tags.delete(tag) : state.tags.add(tag);
      state.cursor = 0; paint();
    } else if (control.matches('[data-row]') && !event.target.closest('button,a')) go(`#t${control.dataset.row}`);
  });
  app.addEventListener('keydown', (event) => {
    if (event.target.matches('[data-row]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); go(`#t${event.target.dataset.row}`);
    }
  });
  app.addEventListener('input', (event) => {
    if (event.target.id !== 'search') return;
    state.query = event.target.value; state.cursor = 0; paint();
    const search = document.querySelector('#search');
    search?.focus(); search?.setSelectionRange(search.value.length, search.value.length);
  });
  app.addEventListener('change', (event) => {
    if (event.target.id === 'sort') { state.order = event.target.value; state.cursor = 0; paint(); }
  });
}

function isTyping(element) {
  return element instanceof HTMLElement && (element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName));
}

document.addEventListener('keydown', (event) => {
  const typing = isTyping(event.target);
  if (event.key === 'Escape') {
    if (typing) {
      event.target.blur();
      if (event.target.id === 'search' && state.query) { state.query = ''; paint(); }
    } else if (state.view === 'dossier') go(`#${state.returnView}`);
    else if (state.view === 'trophies' && state.query) { state.query = ''; paint(); }
    return;
  }
  if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === '/') {
    event.preventDefault();
    if (state.view !== 'trophies') go('#trophies');
    requestAnimationFrame(() => document.querySelector('#search')?.focus());
  } else if (event.key.toLowerCase() === 's') {
    state.spoilers = !state.spoilers;
    localStorage.setItem(SPOILERS_KEY, String(state.spoilers));
    paint(); notify(`Spoilers ${state.spoilers ? 'on' : 'off'}.`);
  } else if (state.view === 'trophies' && ['j', 'k'].includes(event.key.toLowerCase())) {
    const list = filterTrophies();
    state.cursor = Math.max(0, Math.min(list.length - 1, state.cursor + (event.key.toLowerCase() === 'j' ? 1 : -1)));
    paint(); document.querySelector(`[data-row][data-index="${state.cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  } else if (state.view === 'trophies' && event.key === 'Enter') {
    const trophy = filterTrophies()[state.cursor];
    if (trophy) go(`#t${trophy.id}`);
  }
});

async function boot() {
  const response = await fetch('./data/trophies.json');
  if (!response.ok) throw new Error(`Trophy data unavailable (${response.status}).`);
  state.data = await response.json();
  state.trophies = state.data.trophies;
  state.byId = new Map(state.trophies.map((trophy) => [trophy.id, trophy]));
  restore();
  connect();
  const expand = new URLSearchParams(location.search).get('expand');
  if (expand && state.byId.has(Number(expand))) history.replaceState(null, '', `${location.pathname}#t${Number(expand)}`);
  else if (!location.hash) history.replaceState(null, '', `${location.pathname}#route`);
  followAddress();
}

boot().catch((error) => { app.innerHTML = `<p class="empty">Atlas could not load: ${escapeHtml(error.message)}</p>`; });
