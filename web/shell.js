// Wasl HRMS — professional staff shell: grouped top navigation with drop-down menus and a sliding
// active pill, a floating tool rail, breadcrumbs + live clock, a command palette and a profile menu with
// appearance controls. Ideas inspired by modern ERP dashboards; all code here is original.
import { THEMES, applyTheme } from './ext.js';

export const GROUPS = [
  { key: 'home', label: 'Dashboard', labelAr: 'لوحة التحكم', mods: ['dash'] },
  { key: 'people', label: 'People', labelAr: 'الموظفون', mods: ['emp', 'people', 'requests', 'reflect'] },
  { key: 'time', label: 'Time', labelAr: 'الوقت', mods: ['attendance', 'timeplus', 'leave', 'away'] },
  { key: 'payroll', label: 'Payroll', labelAr: 'الرواتب', mods: ['pay', 'payplus', 'eosb'] },
  { key: 'comp', label: 'Compliance', labelAr: 'الامتثال', mods: ['emi', 'docs', 'audit'] },
  { key: 'talent', label: 'Talent', labelAr: 'المواهب', mods: ['ats', 'talent'] },
  { key: 'insights', label: 'Insights', labelAr: 'التحليلات', mods: ['insights'] },
  { key: 'admin', label: 'Admin', labelAr: 'الإدارة', mods: ['platform', 'setup'] },
];
export const EMP_GROUPS = [
  { key: 'home', label: 'Home', labelAr: 'الرئيسية', mods: ['ehome'] },
  { key: 'time', label: 'Time', labelAr: 'الوقت', mods: ['eclock', 'eshift', 'eleave', 'eaway'] },
  { key: 'pay', label: 'Pay & services', labelAr: 'الرواتب والخدمات', mods: ['epay', 'eservices'] },
  { key: 'req', label: 'Requests', labelAr: 'الطلبات', mods: ['ereq', 'edocs', 'etag'] },
  { key: 'growth', label: 'Growth', labelAr: 'التطوير', mods: ['egrowth', 'ereflect'] },
  { key: 'help', label: 'Assistant', labelAr: 'المساعد', mods: ['evoice', 'eai'] },
];
const DESC = {
  ehome: 'Your day at a glance', eclock: 'Clock in and out with Face ID', eshift: 'Your roster and corrections', eleave: 'Apply and track leave', eaway: "Who's out on your team",
  epay: 'Payslips as PDF', eservices: 'Expenses, loans, airfare, insurance, perks', ereq: 'Letters and HR requests', edocs: 'Your visa, ID and passport', etag: 'Your digital ID card',
  egrowth: 'Goals, feedback, recognition, surveys', ereflect: 'Weekly wellbeing check-in', evoice: 'Speak in your language', eai: 'Ask HR anything',
  dash: 'Everything due today, ranked by risk', emp: 'Profiles, documents and contracts', people: 'Expenses, visas, insurance, assets', requests: 'Letters and employee requests', reflect: 'Wellbeing check-ins',
  attendance: 'Clock-ins, GPS and selfies', timeplus: 'Shifts, roster, holidays, corrections', leave: 'Requests and approvals', away: "Who's out this month",
  pay: 'Compute, approve and export WPS', payplus: 'Loans, overtime, airfare, journals', eosb: 'End-of-service calculator',
  emi: 'Quota, fines and NAFIS', docs: 'Visa and ID expiry radar', audit: 'Every change, who and when',
  ats: 'Applicant pipeline', talent: 'AI hiring agent, offers, performance', insights: 'Cash-flow forecast and retention', platform: 'Reports, API, integrations, rules', setup: 'Company settings and go-live checklist',
};
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } } };
let S; // context

export const groupOf = (m) => GROUPS.find((g) => g.mods.includes(m)) || EMP_GROUPS.find((g) => g.mods.includes(m));
const groupsFor = (ctx) => (ctx.isStaff() ? GROUPS : EMP_GROUPS);

/** Top navigation markup. Only groups with at least one module the user may open are shown. */
export function navHtml(ctx) {
  S = ctx; const allowed = new Set(ctx.mods());
  const cg = groupOf(ctx.cur)?.key;
  return `<nav class="gnav" id="gnav" aria-label="Main"><span class="gpill" aria-hidden="true"></span>${groupsFor(ctx).filter((g) => g.mods.some((m) => allowed.has(m))).map((g) => {
    const mods = g.mods.filter((m) => allowed.has(m)); const single = mods.length === 1;
    const lbl = ctx.lang() === 'ar' ? g.labelAr : g.label;
    return `<div class="gitem" data-g="${g.key}"><button class="gbtn ${g.key === cg ? 'on' : ''}" ${single ? `data-m="${mods[0]}"` : `data-open="${g.key}" aria-haspopup="true" aria-expanded="false"`}>${ctx.esc(lbl)}<span class="gbadge" data-badge="${g.key}" hidden></span>${single ? '' : '<svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'}</button>
      ${single ? '' : `<div class="gmenu" role="menu" hidden>${mods.map((m) => `<button role="menuitem" class="gmi ${m === ctx.cur ? 'on' : ''}" data-m="${m}"><span class="gmi-ic">${ctx.icon(ctx.ICONS[m], 18)}</span><span><b>${ctx.esc(ctx.t(m))}</b><small>${ctx.esc(DESC[m] || '')}</small></span><span class="gbadge sm" data-badge="m:${m}" hidden></span></button>`).join('')}</div>`}</div>`;
  }).join('')}</nav>`;
}

// ---------------------------------------------------------------- sliding pill (edges move at different speeds)
const ease = { out: (t) => 1 - (1 - t) ** 3, inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) };
const pillState = { l: 0, r: 0, t: 0, b: 0, ready: false, raf: 0 };
function placePill(animate) {
  const nav = document.getElementById('gnav'); const pill = nav?.querySelector('.gpill'); const target = nav?.querySelector('.gbtn.on');
  if (!pill) return;
  if (!target) { pill.style.opacity = '0'; return; }
  pill.style.opacity = '1';
  const W = nav.clientWidth, H = nav.clientHeight;
  const nr = nav.getBoundingClientRect(), tr = target.getBoundingClientRect(); const bl = nav.clientLeft, bt = nav.clientTop; // measure against the nav, not the item wrapper
  const x = tr.left - nr.left - bl + nav.scrollLeft, y = tr.top - nr.top - bt;
  const to = { l: x, t: y, r: W - (x + tr.width), b: H - (y + tr.height) };
  const draw = (s) => { pill.style.clipPath = `inset(${s.t}px ${s.r}px ${s.b}px ${s.l}px round 999px)`; };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!animate || !pillState.ready || reduce) { if (!animate && pillState.raf) return; Object.assign(pillState, to, { ready: true }); draw(pillState); return; }
  const from = { ...pillState }; const fwd = to.l > from.l; const [lead, trail] = fwd ? ['r', 'l'] : ['l', 'r'];
  const t0 = performance.now(); cancelAnimationFrame(pillState.raf);
  const step = (now) => {
    const a = Math.min(1, (now - t0) / 360), b = Math.min(1, (now - t0) / 550);
    pillState[lead] = from[lead] + (to[lead] - from[lead]) * ease.out(a); // leading edge goes first and faster
    pillState[trail] = from[trail] + (to[trail] - from[trail]) * ease.inOut(b); // trailing edge follows
    pillState.t = to.t; pillState.b = to.b; draw(pillState);
    if (b < 1) pillState.raf = requestAnimationFrame(step); else { pillState.raf = 0; placePill(false); }
  };
  pillState.raf = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- rail, page head, menus, palette
export function railHtml(ctx) {
  const dark = document.documentElement.dataset.mode === 'dark';
  const b = (id, label, d, i) => `<button class="rbtn" id="${id}" data-label="${label}" aria-label="${label}" style="--i:${i}">${ctx.icon(d, 21)}</button>`;
  return `<aside class="rail" id="rail" aria-label="Tools"><span class="rhl" aria-hidden="true"></span>
    ${b('rSearch', 'Search  ·  Ctrl K', 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', 0)}
    ${b('rAdd', 'Quick create  ·  N', 'M12 5v14M5 12h14', 1)}
    ${b('rTheme', 'Colours & appearance', 'M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3zM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM10.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 2)}
    ${b('rMode', dark ? 'Light mode  ·  Shift D' : 'Dark mode  ·  Shift D', dark ? 'M12 4V2M12 22v-2M4.9 4.9L3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', 3)}
    <i class="rsep"></i>
    ${b('rHelp', 'Shortcuts & help', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v.01M12 13a2.5 2.5 0 1 0-2.5-2.5', 4)}
    ${b('rSet', ctx.isStaff() ? 'Settings' : 'My ID tag', ctx.isStaff() ? 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4' : 'M4 6h16v12H4zM8 10h3M8 14h5M15 10h2v4h-2z', 5)}
    <div class="rpop panel" id="rPop" hidden></div></aside>`;
}
function themePanel(ctx) {
  const t = store.get('wasl_theme', 'classic'), m = store.get('wasl_mode', 'light');
  return `<h4>Colour theme</h4><div class="rsw">${THEMES.map(([k, l, p, a]) => `<button class="rsw-b ${k === t ? 'on' : ''}" data-theme="${k}" aria-pressed="${k === t}"><i style="background:linear-gradient(135deg,${p} 55%,${a} 55%)"></i><span>${l}</span></button>`).join('')}</div>
    <h4>Appearance</h4><div class="seg rseg" role="group" aria-label="Appearance">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'System']].map(([k, l]) => `<button data-mode="${k}" class="${k === m ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
export function pageHeadHtml(ctx) {
  const g = groupOf(ctx.cur); const est = ctx.isStaff() ? ctx.estName() || 'Wasl' : 'My workspace';
  const lbl = g ? (ctx.lang() === 'ar' ? g.labelAr : g.label) : '';
  return `<div class="phead"><nav class="crumbs" aria-label="Breadcrumb"><span>${ctx.esc(est)}</span>${g && g.key !== 'home' && lbl !== ctx.t(ctx.cur) ? `<i>›</i><span>${ctx.esc(lbl)}</span>` : ''}<i>›</i><b>${ctx.esc(ctx.t(ctx.cur))}</b></nav>
    <div class="livepill" id="livePill"><span class="ldot"></span><b id="liveClock">--:--</b><span class="lsep"></span><span id="liveTxt" class="xmuted">Gulf Standard Time</span><span class="lbar"><i id="liveBar" style="width:0"></i></span></div></div>`;
}
export function profileMenuHtml(ctx) {
  const t = store.get('wasl_theme', 'classic'), m = store.get('wasl_mode', 'light');
  const it = (id, label, d, extra = '') => `<button class="pmi" ${id} role="menuitem">${ctx.icon(d, 16)}<span>${label}</span>${extra}</button>`;
  const check = '<svg class="ck" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12l5 5 9-10"/></svg>';
  return `<div class="pm-head"><span class="av">${ctx.esc(ctx.ini(ctx.me().name))}</span><div><b>${ctx.esc(ctx.me().name)}</b><small>${ctx.esc(ctx.me().email || '')}</small></div></div>
    ${ctx.isStaff() ? it('data-go="setup"', 'Settings', 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4') : it('data-go="etag"', 'My ID tag', 'M4 6h16v12H4zM8 10h3M8 14h5M15 10h2v4h-2z')}
    ${it('data-pm="keys"', 'Keyboard shortcuts', 'M4 6h16v12H4zM8 10h.01M12 10h.01M16 10h.01M8 14h8')}
    <i class="pm-sep"></i>
    ${[['light', 'Light', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 2v2M12 20v2M2 12h2M20 12h2'], ['dark', 'Dark', 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'], ['auto', 'Match system', 'M7 3h10v18H7zM11 18h2']].map(([k, l, d]) => it(`data-mode="${k}"`, l, d, k === m ? check : '')).join('')}
    <div class="pm-sw">${THEMES.map(([k, l, p, a]) => `<button class="pm-dot ${k === t ? 'on' : ''}" data-theme="${k}" title="${l}" aria-label="${l} colours" style="background:${p};--sw-acc:${a}"></button>`).join('')}</div>
    <i class="pm-sep"></i>
    ${it('data-pm="lang"', ctx.t('lang'), 'M4 5h8M8 3v2M5 13c2-2 4-5 5-8M7 9c1 2 3 4 5 5M13 21l4-9 4 9M14.5 18h5')}
    ${it('data-pm="out" class="pmi danger"', ctx.t('signout'), 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11')}`;
}

function palette(ctx, mode = 'search') {
  const allowed = ctx.mods();
  const actions = [
    ['New employee', 'emp', 'waslNewEmployee'], ['Open the Face ID tablet link', 'timeplus', 'waslKioskLink'], ['Run payroll', 'pay'], ['Approve leave', 'leave'], ['New loan or fine', 'payplus'], ['Plan a hire with the AI agent', 'talent'], ['Upload a document', 'docs'], ['Paint the roster', 'timeplus'], ['Export a report', 'platform'], ['Check Emiratisation quota', 'emi'],
    ['Clock in', 'eclock'], ['Apply for leave', 'eleave'], ['New expense claim', 'eservices'], ['Request a letter', 'ereq'], ['Download a payslip', 'epay'], ['Ask the voice assistant', 'evoice'], ['Thank a colleague', 'egrowth'],
  ].filter(([, m]) => allowed.includes(m));
  const items = mode === 'add' ? actions.map(([l, m, fn]) => ({ l, m, fn, d: ctx.t(m) })) : allowed.map((m) => ({ l: ctx.t(m), m, d: DESC[m] || '' })).concat(actions.map(([l, m, fn]) => ({ l, m, fn, d: ctx.t(m) })));
  const el = document.createElement('div'); el.className = 'sheet cpal-wrap';
  el.innerHTML = `<div class="cpal panel" role="dialog" aria-modal="true" aria-label="${mode === 'add' ? 'Quick create' : 'Search'}"><div class="cpal-in">${ctx.icon(mode === 'add' ? 'M12 5v14M5 12h14' : 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4', 18)}<input id="cpQ" placeholder="${mode === 'add' ? 'What do you want to create?' : 'Jump to a page or action…'}" autocomplete="off"><kbd>Esc</kbd></div><div class="cpal-list" id="cpL"></div></div>`;
  document.body.appendChild(el);
  let sel = 0; const q = el.querySelector('#cpQ'); const list = el.querySelector('#cpL');
  const close = () => el.remove();
  const paint = () => {
    const s = q.value.toLowerCase(); const rows = items.filter((x) => !s || `${x.l} ${x.d}`.toLowerCase().includes(s)).slice(0, 10); sel = Math.min(sel, Math.max(0, rows.length - 1));
    list.innerHTML = rows.map((x, i) => `<button class="cpal-row ${i === sel ? 'on' : ''}" data-m="${x.m}" data-fn="${x.fn || ''}">${ctx.icon(ctx.ICONS[x.m], 16)}<span><b>${ctx.esc(x.l)}</b><small>${ctx.esc(x.d)}</small></span></button>`).join('') || '<div class="empty">No matches</div>';
    list.onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { close(); ctx.go(b.dataset.m); if (b.dataset.fn) setTimeout(() => window[b.dataset.fn]?.(), 350); } };
    return rows;
  };
  let rows = paint();
  q.oninput = () => { sel = 0; rows = paint(); };
  q.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, rows.length - 1); rows = paint(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); rows = paint(); e.preventDefault(); }
    else if (e.key === 'Enter' && rows[sel]) { close(); ctx.go(rows[sel].m); if (rows[sel].fn) setTimeout(() => window[rows[sel].fn]?.(), 350); }
    else if (e.key === 'Escape') close();
  };
  el.onclick = (e) => { if (e.target === el) close(); };
  q.focus();
}
function shortcuts(ctx) {
  ctx.sheetForm('Keyboard shortcuts', `<dl class="kv">${[['Ctrl / ⌘ + K', 'Search and jump anywhere'], ['N', 'Quick create'], ['/', 'Focus the AI command bar'], ['G then P', 'Go to Payroll'], ['G then E', 'Go to Employees'], ['G then D', 'Go to Dashboard'], ['Shift + D', 'Toggle light / dark'], ['Esc', 'Close menus and dialogs']].map(([k, v]) => `<div><dt><kbd>${k}</kbd></dt><dd>${v}</dd></div>`).join('')}</dl>`, async () => {}, 'Close');
}

// ---------------------------------------------------------------- wiring
let keysBound = false, clockTimer = 0;
export function wireShell(ctx) {
  S = ctx;
  const nav = document.getElementById('gnav');
  const closeMenus = () => nav?.querySelectorAll('.gmenu').forEach((m) => { m.hidden = true; m.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  if (nav) {
    nav.addEventListener('click', (e) => {
      const go = e.target.closest('[data-m]'); if (go) { closeMenus(); ctx.go(go.dataset.m); return; }
      const op = e.target.closest('[data-open]'); if (!op) return;
      e.stopPropagation(); const menu = op.nextElementSibling; const open = menu.hidden; closeMenus();
      if (open) { menu.hidden = false; op.setAttribute('aria-expanded', 'true'); menu.querySelector('.gmi')?.focus({ preventScroll: true }); }
    });
    nav.addEventListener('keydown', (e) => {
      const items = [...(e.target.closest('.gmenu')?.querySelectorAll('.gmi') || [])]; const i = items.indexOf(e.target);
      if (e.key === 'ArrowDown' && items.length) { items[(i + 1) % items.length].focus(); e.preventDefault(); }
      if (e.key === 'ArrowUp' && items.length) { items[(i - 1 + items.length) % items.length].focus(); e.preventDefault(); }
      if (e.key === 'Escape') { const btn = e.target.closest('.gitem')?.querySelector('.gbtn'); closeMenus(); btn?.focus(); }
    });
    // hover-open on desktop pointers
    nav.querySelectorAll('.gitem').forEach((it) => {
      let tmo; const btn = it.querySelector('[data-open]'); if (!btn) return;
      it.onmouseenter = () => { if (!matchMedia('(hover:hover)').matches) return; clearTimeout(tmo); closeMenus(); it.querySelector('.gmenu').hidden = false; btn.setAttribute('aria-expanded', 'true'); };
      it.onmouseleave = () => { tmo = setTimeout(() => { it.querySelector('.gmenu').hidden = true; btn.setAttribute('aria-expanded', 'false'); }, 160); };
    });
    document.addEventListener('click', closeMenus);
    requestAnimationFrame(() => placePill(true));
    // badges and web fonts change button widths after the first paint: keep the pill glued to the active item
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (!document.body.contains(nav)) return ro.disconnect(); placePill(false); }); nav.querySelectorAll('.gbtn').forEach((x) => ro.observe(x)); }
    document.fonts?.ready.then(() => placePill(false));
    if (!window.__pillResize) { window.__pillResize = true; addEventListener('resize', () => placePill(false)); }
  }
  // rail
  const $ = (id) => document.getElementById(id);
  if ($('rSearch')) {
    $('rSearch').onclick = () => palette(ctx, 'search'); $('rAdd').onclick = () => palette(ctx, 'add');
    $('rMode').onclick = () => { const dark = document.documentElement.dataset.mode === 'dark'; store.set('wasl_mode', dark ? 'light' : 'dark'); applyTheme(); syncThemeUi(ctx); };
    $('rHelp').onclick = () => shortcuts(ctx); $('rSet').onclick = () => ctx.go(ctx.isStaff() ? 'setup' : 'etag');
    const pop = $('rPop'); const paintPop = () => { pop.innerHTML = themePanel(ctx); };
    $('rTheme').onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; if (!pop.hidden) paintPop(); };
    pop.onclick = (e) => {
      e.stopPropagation(); const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.theme) store.set('wasl_theme', b.dataset.theme);
      if (b.dataset.mode) store.set('wasl_mode', b.dataset.mode);
      applyTheme(); paintPop(); syncThemeUi(ctx);
    };
    document.addEventListener('click', () => { if (pop) pop.hidden = true; });
    const rail = $('rail'); const hl = rail.querySelector('.rhl');
    rail.querySelectorAll('.rbtn').forEach((x) => { x.onmouseenter = () => { hl.style.transform = `translateY(${x.offsetTop}px)`; hl.style.opacity = '1'; }; x.onfocus = x.onmouseenter; });
    rail.onmouseleave = () => { hl.style.opacity = '0'; };
  }
  // profile menu
  const pm = $('whoMenu');
  if (pm) {
    pm.onclick = (e) => {
      e.stopPropagation();
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.go) { pm.hidden = true; ctx.go(b.dataset.go); }
      if (b.dataset.mode) { store.set('wasl_mode', b.dataset.mode); applyTheme(); pm.innerHTML = profileMenuHtml(ctx); syncThemeUi(ctx); }
      if (b.dataset.theme) { store.set('wasl_theme', b.dataset.theme); applyTheme(); pm.innerHTML = profileMenuHtml(ctx); syncThemeUi(ctx); }
      if (b.dataset.pm === 'keys') { pm.hidden = true; shortcuts(ctx); }
      if (b.dataset.pm === 'lang') ctx.toggleLang();
      if (b.dataset.pm === 'out') ctx.signOut();
    };
  }
  // live clock pill (Dubai time + who is on shift today)
  clearInterval(clockTimer);
  const tick = () => { const c = $('liveClock'); if (!c) return clearInterval(clockTimer); c.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }); };
  tick(); clockTimer = setInterval(tick, 15000);
  if (ctx.has('hr_admin', 'manager', 'payroll_maker')) ctx.api('/attendance').then((d) => {
    const c = d?.counts; if (!c?.total || !$('liveTxt')) return;
    const on = c.in + c.out; const ok = Math.max(0, on - c.late);
    $('liveTxt').innerHTML = `<b style="color:var(--ink)">${on} of ${c.total} at work</b><small>${ok} on time · ${c.late} late · ${c.leave} on leave</small>`;
    $('liveBar').style.width = `${Math.round((on / c.total) * 100)}%`;
  }).catch(() => {});
  const mine = () => ctx.api('/me/attendance/today', { fresh: true }).then((d) => {
    const r = d?.record; if (!$('liveTxt')) return;
    const fmt = (x) => new Date(x).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
    const first = r?.sessions?.[0]?.clockIn?.at || r?.clockIn?.at;
    $('liveTxt').innerHTML = first ? `<b style="color:var(--ink)">${r.open ? 'On shift' : 'Shift complete'}</b><small>In at ${fmt(first)}${r.lateMinutes ? ` · ${r.lateMinutes} min late` : ' · on time'}</small>` : '<b style="color:var(--ink)">Not clocked in</b><small>Time › Attendance to start</small>';
    const worked = r?.minutesWorked || 0; $('liveBar').style.width = `${Math.min(100, Math.round((worked / 480) * 100))}%`;
  }).catch(() => {});
  window.waslRefreshLive = ctx.isStaff() ? null : mine; if (!ctx.isStaff()) mine();
  loadBadges(ctx);
  // keyboard shortcuts
  if (!keysBound) {
    keysBound = true; let gPrefix = 0;
    document.addEventListener('keydown', (e) => {
      if (!S) return;
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(S, 'search'); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.sheet')) return;
      if (e.key === '/') { e.preventDefault(); document.getElementById('cmd')?.focus(); }
      else if (e.key === 'n') { e.preventDefault(); palette(S, 'add'); }
      else if (e.key === 'D' && e.shiftKey) document.getElementById('rMode')?.click();
      else if (e.key === 'g') gPrefix = Date.now();
      else if (Date.now() - gPrefix < 900) { const m = (S.isStaff() ? { p: 'pay', e: 'emp', d: 'dash', l: 'leave', a: 'attendance' } : { p: 'epay', d: 'ehome', l: 'eleave', a: 'eclock', e: 'eservices' })[e.key]; if (m) S.go(m); gPrefix = 0; }
    });
  }
}

async function loadBadges(ctx) {
  const set = (key, n) => document.querySelectorAll(`[data-badge="${key}"]`).forEach((b) => { b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  const safe = (p) => ctx.api(p).catch(() => null);
  if (!ctx.isStaff()) {
    const [sv, rv] = await Promise.all([safe('/me/surveys'), safe('/me/reviews')]);
    const g = (Array.isArray(sv) ? sv.filter((x) => !x.answered).length : 0) + (Array.isArray(rv) ? rv.filter((x) => !x.submitted).length : 0);
    set('m:egrowth', g); set('growth', g); return;
  }
  const [ws, exp, disp, req] = await Promise.all([safe('/workspace'), safe('/expenses?status=submitted'), safe('/attendance/disputes'), ctx.has('hr_admin') ? safe('/requests') : null]);
  const leave = ws?.counts?.pendingLeave || 0, apps = ws?.counts?.openApplicants || 0;
  const expN = Array.isArray(exp) ? exp.length : 0, dispN = Array.isArray(disp) ? disp.length : 0;
  const reqN = Array.isArray(req) ? req.filter((r) => ['open', 'in_progress'].includes(r.status)).length : 0;
  set('m:leave', leave); set('m:timeplus', dispN); set('time', leave + dispN);
  set('m:people', expN); set('m:requests', reqN); set('people', expN + reqN);
  set('m:ats', apps); set('talent', apps);
}

/** After a theme change: swap the rail's mode icon/label and repaint canvas-based visuals (no page reload needed). */
function syncThemeUi(ctx) {
  const dark = document.documentElement.dataset.mode === 'dark'; const b = document.getElementById('rMode');
  if (b) { b.innerHTML = ctx.icon(dark ? 'M12 4V2M12 22v-2M4.9 4.9L3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z' : 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z', 21); const l = dark ? 'Light mode  ·  Shift D' : 'Dark mode  ·  Shift D'; b.dataset.label = l; b.setAttribute('aria-label', l); }
  requestAnimationFrame(() => placePill(false));
}
