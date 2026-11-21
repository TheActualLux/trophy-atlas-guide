const TICK_KEY = 'trophy-atlas.progress.v2';
const SPOILER_KEY = 'trophy-atlas.spoilers.v1';
const GRADES = ['platinum', 'gold', 'silver', 'bronze'];
const TAGS = ['story-critical', 'collectible', 'activity', 'online', 'endgame', 'grind'];

const model = {
  data: null,
  trophies: [],
  byId: new Map(),
  ticks: new Set(),
  spoilers: false,
  route: 'route',
  expanded: null,
  inlineOpen: new Set(),
  query: '',
  grades: new Set(),
  tags: new Set(),
  sort: 'id',
  cursor: 0,
  returnRoute: 'route',
};

const app = document.querySelector('#app');
const notice = document.querySelector('#notice');
let noticeTimer = 0;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

function markMatches(value, term) {
  const safe = escapeHtml(value);
  if (!term) return safe;
  const needle = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safe.replace(new RegExp(`(${needle})`, 'gi'), '<mark>$1</mark>');
}

function announce(message) {
  notice.textContent = message;
  notice.classList.add('visible');
  clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => notice.classList.remove('visible'), 2300);
}

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(TICK_KEY) || '[]');
    if (Array.isArray(saved)) {
      model.ticks = new Set(saved.filter((id) => Number.isInteger(id) && model.byId.has(id)));
    }
  } catch {
    model.ticks = new Set();
  }
  model.spoilers = localStorage.getItem(SPOILER_KEY) === 'true';
}

function persistProgress() {
  localStorage.setItem(TICK_KEY, JSON.stringify([...model.ticks].sort((a, b) => a - b)));
}

function completed() {
  return model.trophies.reduce((total, trophy) => total + Number(model.ticks.has(trophy.id)), 0);
}

function timeLabel(hours) {
  if (!hours) return 'No extra time';
  if (hours < 1) return `About ${Math.round(hours * 60)} min`;
  const shown = Number.isInteger(hours) ? hours : hours.toFixed(1);
  return `About ${shown} hr`;
}

function remainingHours(items = model.trophies) {
  return items.reduce((sum, trophy) => sum + (model.ticks.has(trophy.id) ? 0 : trophy.hours), 0);
}

function syncHeader() {
  const count = completed();
  document.querySelector('#earned-count').textContent = `${count} / ${model.trophies.length}`;
  document.querySelector('#overall-fill').style.width = `${count / model.trophies.length * 100}%`;
  document.querySelector('#remaining-time').textContent = `time left ${Math.ceil(remainingHours())} hr`;
  document.querySelector('#spoilers').checked = model.spoilers;
  document.querySelector('#route-tab').classList.toggle('active', model.route === 'route');
  document.querySelector('#trophies-tab').classList.toggle('active', model.route === 'trophies');
}

function routeChip(id) {
  const trophy = model.byId.get(id);
  const isDone = model.ticks.has(id);
  const missable = trophy.missable !== 'Not missable.';
  return `<span class="trophy-chip${isDone ? ' done' : ''}">
    <button class="chip-check" type="button" data-tick="${id}" aria-label="${isDone ? 'Unmark' : 'Mark'} ${escapeHtml(trophy.name)}" aria-pressed="${isDone}">✓</button>
    <a class="chip-link" href="#t${id}">${escapeHtml(trophy.name)}</a>${missable ? '<span class="miss-dot" title="Review missable note">!</span>' : ''}
  </span>`;
}

function renderRoute() {
  const firstOpen = model.data.phases.flatMap((phase) => phase.trophies)
    .map((id) => model.byId.get(id)).find((trophy) => !model.ticks.has(trophy.id));
  let intro = '<header class="page-intro"><p class="eyebrow">A deliberate platinum route</p><h1>Eight phases. One clean sweep.</h1><p>Take the story first, then work outward through activities and the completion ledger. Tick each card as you go; route estimates update with your progress.</p></header>';
  if (firstOpen) intro += `<aside class="route-tip"><b>Pick up here:</b> <a href="#t${firstOpen.id}">${escapeHtml(firstOpen.name)}</a> · ${escapeHtml(firstOpen.description)}</aside>`;
  const cards = model.data.phases.map((phase, index) => {
    const phaseTrophies = phase.trophies.map((id) => model.byId.get(id));
    const done = phaseTrophies.filter((trophy) => model.ticks.has(trophy.id)).length;
    const percent = phaseTrophies.length ? Math.round(done / phaseTrophies.length * 100) : 0;
    const hours = phaseTrophies.reduce((sum, trophy) => sum + trophy.hours, 0);
    return `<section class="phase-card${percent === 100 ? ' finished' : ''}" id="phase-${escapeHtml(phase.id)}">
      <div class="phase-title"><span class="phase-kicker">Phase ${index + 1}</span><h2>${escapeHtml(phase.name)}</h2><span class="phase-hours">${timeLabel(hours)} · ${done}/${phaseTrophies.length} earned</span></div>
      <p class="phase-objective">${escapeHtml(phase.goal)}</p>
      <p class="phase-reason">${escapeHtml(phase.about)}</p>
      <div class="phase-meter" role="progressbar" aria-label="${escapeHtml(phase.name)} progress" aria-valuemin="0" aria-valuemax="${phaseTrophies.length}" aria-valuenow="${done}"><span style="width:${percent}%"></span></div>
      <p class="phase-count">${percent}% complete</p>
      <div class="chips">${phase.trophies.map(routeChip).join('')}</div>
    </section>`;
  }).join('');
  return intro + cards;
}

function selectedTrophies() {
  const term = model.query.trim().toLocaleLowerCase();
  let list = model.trophies.filter((trophy) => {
    if (model.grades.size && !model.grades.has(trophy.grade)) return false;
    if (model.tags.size && ![...model.tags].some((tag) => trophy.tags.includes(tag))) return false;
    if (term) {
      const content = [trophy.name, trophy.description, trophy.guide, trophy.steps.join(' ')].join(' ').toLocaleLowerCase();
      if (!content.includes(term)) return false;
    }
    return true;
  });
  const gradeOrder = new Map(GRADES.map((grade, index) => [grade, index]));
  if (model.sort === 'grade') list = [...list].sort((a, b) => gradeOrder.get(a.grade) - gradeOrder.get(b.grade) || a.id - b.id);
  else if (model.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  else if (model.sort === 'difficulty') list = [...list].sort((a, b) => b.difficulty - a.difficulty || a.id - b.id);
  else if (model.sort === 'time') list = [...list].sort((a, b) => a.hours - b.hours || a.id - b.id);
  else list = [...list].sort((a, b) => a.id - b.id);
  return list;
}

function gradeBadge(grade) {
  return `<span class="grade grade-${escapeHtml(grade)}">${escapeHtml(grade)}</span>`;
}

function tagPills(tags, active = false) {
  return tags.map((tag) => `<span class="tag-pill${active ? ' selected' : ''}">${escapeHtml(tag)}</span>`).join('');
}

function renderToolbar() {
  const gradeButtons = GRADES.map((grade) => `<button class="filter-button${model.grades.has(grade) ? ' selected' : ''}" type="button" data-grade="${grade}" aria-pressed="${model.grades.has(grade)}">${grade}</button>`).join('');
  const tagButtons = TAGS.map((tag) => `<button class="filter-button${model.tags.has(tag) ? ' selected' : ''}" type="button" data-tag="${tag}" aria-pressed="${model.tags.has(tag)}">${tag}</button>`).join('');
  const sortOptions = [['id', 'List order'], ['grade', 'Grade'], ['name', 'Name'], ['difficulty', 'Difficulty'], ['time', 'Estimated time']]
    .map(([value, label]) => `<option value="${value}"${model.sort === value ? ' selected' : ''}>${label}</option>`).join('');
  return `<div class="toolbar">
    <input id="search" type="search" placeholder="Search names, descriptions, and guide text ( / )" aria-label="Search trophies" value="${escapeHtml(model.query)}">
    <select id="sort" aria-label="Sort trophies">${sortOptions}</select>
    <div class="filter-set" aria-label="Filter by grade"><span class="filter-label">Grade</span>${gradeButtons}</div>
    <div class="filter-set" aria-label="Filter by tag"><span class="filter-label">Tag</span>${tagButtons}</div>
  </div>`;
}

function inlineDossier(trophy) {
  const open = model.inlineOpen.has(trophy.id);
  return `<section class="inline-dossier" id="inline-${trophy.id}"${open ? '' : ' hidden'}>${renderDossier(trophy, true)}</section>`;
}

function renderTrophies() {
  const list = selectedTrophies();
  model.cursor = Math.min(model.cursor, Math.max(0, list.length - 1));
  const term = model.query.trim();
  const done = list.filter((trophy) => model.ticks.has(trophy.id)).length;
  const guideHits = list.filter((trophy) => term && trophy.guide.toLocaleLowerCase().includes(term)).length;
  const summary = `<p class="list-summary">${list.length} of ${model.trophies.length} trophies · ${done} earned · ${Math.ceil(remainingHours(list))} unticked hours${guideHits ? ` · ${guideHits} guide-text matches` : ''}</p>`;
  const rows = list.map((trophy, index) => {
    const isDone = model.ticks.has(trophy.id);
    const isOpen = model.inlineOpen.has(trophy.id);
    return `<article class="trophy-entry">
      <div class="trophy-row${isDone ? ' done' : ''}${index === model.cursor ? ' selected' : ''}" data-row="${trophy.id}" data-index="${index}" tabindex="0" aria-expanded="${isOpen}">
        <button class="row-check" type="button" data-tick="${trophy.id}" aria-label="${isDone ? 'Unmark' : 'Mark'} ${escapeHtml(trophy.name)}" aria-pressed="${isDone}">✓</button>
        <span class="trophy-id">T${trophy.id}</span>
        <span class="row-copy"><span class="row-name">${markMatches(trophy.name, term)}</span><span class="row-description">${markMatches(trophy.description, term)}${term && trophy.guide.toLocaleLowerCase().includes(term) ? ` · Guide: ${markMatches(trophy.guide, term)}` : ''}</span></span>
        <span class="row-tags">${gradeBadge(trophy.grade)}${tagPills(trophy.tags)}</span>
        <button class="expand-row" type="button" data-expand="${trophy.id}" aria-label="${isOpen ? 'Collapse' : 'Expand'} ${escapeHtml(trophy.name)}">${isOpen ? '−' : '+'}</button>
      </div>${inlineDossier(trophy)}</article>`;
  }).join('');
  return `<header class="page-intro"><p class="eyebrow">The full checklist</p><h1>All fifty-five trophies.</h1><p>Search across objectives and guide notes, filter by grade or tag, then open a dossier inline or on its own route.</p></header>
    ${renderToolbar()}${summary}${rows || '<p class="no-results">No trophies match these filters. Try a shorter search or clear a filter.</p>'}`;
}

function renderDossier(trophy, inline = false) {
  const index = model.trophies.findIndex((item) => item.id === trophy.id);
  const previous = model.trophies[(index + model.trophies.length - 1) % model.trophies.length];
  const next = model.trophies[(index + 1) % model.trophies.length];
  const missable = trophy.missable !== 'Not missable.';
  const hint = model.spoilers
    ? `<div class="hint-box"><span class="hint-title">Spoiler-gated hint</span>${escapeHtml(trophy.hint)}</div>`
    : '<p class="hint-locked">Hint is hidden. Turn on Spoilers or press S to reveal it.</p>';
  const backRoute = inline ? '#trophies' : `#${model.returnRoute}`;
  const backText = inline ? 'Close inline dossier' : `← Back to ${model.returnRoute === 'trophies' ? 'trophy list' : 'route'}`;
  return `<article class="dossier">
    <a class="back-link" href="${backRoute}"${inline ? ` data-collapse="${trophy.id}"` : ''}>${backText}</a>
    <header><div class="dossier-heading"><span class="dossier-id">Trophy ${trophy.id}</span>${gradeBadge(trophy.grade)}<span class="dossier-tags">${tagPills(trophy.tags, true)}</span></div><h1>${escapeHtml(trophy.name)}</h1><p class="official-copy">${escapeHtml(trophy.description)}</p></header>
    <div class="stats"><div class="stat"><span class="stat-label">Difficulty</span><span class="difficulty" aria-label="${trophy.difficulty} out of 5">${'●'.repeat(trophy.difficulty)}${'○'.repeat(5 - trophy.difficulty)} <small>${trophy.difficulty}/5</small></span></div>
      <div class="stat"><span class="stat-label">Estimated time</span>${timeLabel(trophy.hours)}</div>
      <div class="stat"><span class="stat-label">Route phase</span><a href="#route">${escapeHtml(model.data.phases.find((phase) => phase.id === trophy.phase)?.name || 'Route')}</a></div></div>
    <section class="dossier-section"><h2>Missable note</h2><p class="missable-note${missable ? ' at-risk' : ''}">${missable ? '<strong>Check before proceeding.</strong> ' : ''}${escapeHtml(trophy.missable)}</p></section>
    <section class="dossier-section"><h2>Steps</h2><ol class="steps">${trophy.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>
    <section class="dossier-section"><h2>Guide</h2><p>${escapeHtml(trophy.guide)}</p></section>
    <section class="dossier-section"><h2>Hint</h2>${hint}</section>
    <section class="dossier-section"><h2>Prerequisites</h2><p class="prereqs">${escapeHtml(trophy.requires)}</p></section>
    <section class="dossier-section"><h2>Verification</h2><p class="verify-box">${escapeHtml(trophy.verification)}</p></section>
    <section class="dossier-section"><h2>Sources</h2><p class="source-line">${escapeHtml(trophy.sources.join(' · '))}</p></section>
    <nav class="dossier-nav" aria-label="Adjacent trophies"><a href="#t${previous.id}">← T${previous.id}: ${escapeHtml(previous.name)}</a><span class="push"></span><a href="#t${next.id}">T${next.id}: ${escapeHtml(next.name)} →</a></nav>
  </article>`;
}

function paint() {
  syncHeader();
  if (model.route === 'dossier') {
    const trophy = model.byId.get(model.expanded);
    app.innerHTML = trophy ? renderDossier(trophy) : renderRoute();
  } else if (model.route === 'trophies') {
    app.innerHTML = renderTrophies();
  } else {
    app.innerHTML = renderRoute();
  }
}

function routeFromAddress() {
  const hash = location.hash || '#route';
  if (hash === '#trophies') return { route: 'trophies', id: null };
  const dossier = /^#t(\d+)$/.exec(hash);
  if (dossier && model.byId.has(Number(dossier[1]))) return { route: 'dossier', id: Number(dossier[1]) };
  return { route: 'route', id: null };
}

function syncRoute() {
  const parsed = routeFromAddress();
  if (model.route !== 'dossier') model.returnRoute = model.route;
  model.route = parsed.route;
  model.expanded = parsed.id;
  paint();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function navigate(hash) {
  if (location.hash === hash) syncRoute();
  else location.hash = hash;
}

function toggleTick(id) {
  if (!model.byId.has(id)) return;
  if (model.ticks.has(id)) model.ticks.delete(id);
  else model.ticks.add(id);
  persistProgress();
  paint();
}

function toggleInline(id) {
  if (model.inlineOpen.has(id)) model.inlineOpen.delete(id);
  else model.inlineOpen.add(id);
  paint();
  const card = document.querySelector(`#inline-${id}`);
  if (card && !card.hidden) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function exportFile() {
  const payload = { format: 'trophy-atlas-progress-v2', game: model.data.game, ticks: [...model.ticks].sort((a, b) => a - b) };
  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = 'trophy-atlas-progress.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  announce('Progress exported.');
}

async function importFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || !Array.isArray(payload.ticks)) throw new Error('Invalid progress file.');
    model.ticks = new Set(payload.ticks.filter((id) => Number.isInteger(id) && model.byId.has(id)));
    persistProgress();
    paint();
    announce(`Imported ${model.ticks.size} trophy ticks.`);
  } catch {
    announce('Import failed: choose a Trophy Atlas progress JSON file.');
  }
}

function resetProgress() {
  if (!window.confirm('Clear all Trophy Atlas ticks from this browser?')) return;
  model.ticks.clear();
  persistProgress();
  paint();
  announce('Progress cleared.');
}

function connect() {
  document.querySelector('#route-tab').addEventListener('click', (event) => {
    event.preventDefault();
    navigate('#route');
  });
  document.querySelector('#trophies-tab').addEventListener('click', (event) => {
    event.preventDefault();
    navigate('#trophies');
  });
  document.querySelector('#spoilers').addEventListener('change', (event) => {
    model.spoilers = event.currentTarget.checked;
    localStorage.setItem(SPOILER_KEY, String(model.spoilers));
    paint();
  });
  document.querySelector('#export').addEventListener('click', exportFile);
  document.querySelector('#import').addEventListener('click', () => document.querySelector('#import-file').click());
  document.querySelector('#import-file').addEventListener('change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) importFile(file);
    event.currentTarget.value = '';
  });
  document.querySelector('#reset').addEventListener('click', resetProgress);
  window.addEventListener('hashchange', syncRoute);

  app.addEventListener('click', (event) => {
    const target = event.target.closest('button, a, [data-row]');
    if (!target) return;
    if (target.matches('[data-tick]')) {
      event.preventDefault();
      event.stopPropagation();
      toggleTick(Number(target.dataset.tick));
    } else if (target.matches('[data-grade]')) {
      const grade = target.dataset.grade;
      model.grades.has(grade) ? model.grades.delete(grade) : model.grades.add(grade);
      model.cursor = 0;
      paint();
    } else if (target.matches('[data-tag]')) {
      const tag = target.dataset.tag;
      model.tags.has(tag) ? model.tags.delete(tag) : model.tags.add(tag);
      model.cursor = 0;
      paint();
    } else if (target.matches('[data-expand]')) {
      event.preventDefault();
      toggleInline(Number(target.dataset.expand));
    } else if (target.matches('[data-collapse]')) {
      event.preventDefault();
      model.inlineOpen.delete(Number(target.dataset.collapse));
      paint();
    } else if (target.matches('[data-row]')) {
      if (!event.target.closest('button, a')) navigate(`#t${target.dataset.row}`);
    }
  });

  app.addEventListener('keydown', (event) => {
    if (event.target.matches('[data-row]') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      navigate(`#t${event.target.dataset.row}`);
    }
  });
  app.addEventListener('input', (event) => {
    if (event.target.id !== 'search') return;
    model.query = event.target.value;
    model.cursor = 0;
    paint();
    const input = document.querySelector('#search');
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
  app.addEventListener('change', (event) => {
    if (event.target.id !== 'sort') return;
    model.sort = event.target.value;
    model.cursor = 0;
    paint();
  });
}

function typingInControl(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

document.addEventListener('keydown', (event) => {
  const typing = typingInControl(event.target);
  if (event.key === 'Escape') {
    if (typing) {
      event.target.blur();
      if (event.target.id === 'search' && model.query) {
        model.query = '';
        paint();
      }
      return;
    }
    if (model.route === 'dossier') navigate(`#${model.returnRoute}`);
    else if (model.route === 'trophies' && model.query) {
      model.query = '';
      paint();
    }
    return;
  }
  if (typing || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === '/') {
    event.preventDefault();
    if (model.route !== 'trophies') navigate('#trophies');
    requestAnimationFrame(() => document.querySelector('#search')?.focus());
  } else if (event.key.toLowerCase() === 's') {
    model.spoilers = !model.spoilers;
    localStorage.setItem(SPOILER_KEY, String(model.spoilers));
    paint();
    announce(`Spoilers ${model.spoilers ? 'on' : 'off'}.`);
  } else if (model.route === 'trophies' && ['j', 'k'].includes(event.key.toLowerCase())) {
    const items = selectedTrophies();
    model.cursor = Math.max(0, Math.min(items.length - 1, model.cursor + (event.key.toLowerCase() === 'j' ? 1 : -1)));
    paint();
    document.querySelector(`[data-row][data-index="${model.cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  } else if (model.route === 'trophies' && event.key === 'Enter') {
    const trophy = selectedTrophies()[model.cursor];
    if (trophy) navigate(`#t${trophy.id}`);
  }
});

async function start() {
  const response = await fetch('./data/trophies.json');
  if (!response.ok) throw new Error(`Could not load trophy data (${response.status}).`);
  model.data = await response.json();
  model.trophies = model.data.trophies;
  model.byId = new Map(model.trophies.map((trophy) => [trophy.id, trophy]));
  readProgress();
  connect();
  const expand = new URLSearchParams(location.search).get('expand');
  if (expand && model.byId.has(Number(expand))) {
    history.replaceState(null, '', `${location.pathname}#t${Number(expand)}`);
  } else if (!location.hash) {
    history.replaceState(null, '', `${location.pathname}#route`);
  }
  syncRoute();
}

start().catch((error) => {
  app.innerHTML = `<p class="no-results">The guide could not start: ${escapeHtml(error.message)}</p>`;
});
