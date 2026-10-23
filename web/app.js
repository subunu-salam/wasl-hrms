// Wasl HRMS web client. Plain ES modules, no build step.
import { translateTree } from './i18n.js';
import { installExt, wireThemeButton, accentRgb } from './ext.js';
import { navHtml, railHtml, pageHeadHtml, profileMenuHtml, wireShell } from './shell.js';
import './face.js';
const API = '/api';
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AED = (f) => ((f || 0) / 100).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const AED0 = (f) => Math.round((f || 0) / 100).toLocaleString('en-AE');
const ini = (n) => String(n).split(' ').map((x) => x[0]).slice(0, 2).join('');
const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

let token = localStorage.getItem('wasl_token');
let me = JSON.parse(localStorage.getItem('wasl_user') || 'null');
let L = localStorage.getItem('wasl_lang') || 'en';
let cur = location.hash.slice(1) || 'dash';

const T = {
  en: { dash: 'Command Center', emp: 'Employees', pay: 'Payroll & WPS', emi: 'Emiratisation', docs: 'Document Radar', eosb: 'Gratuity (EOSB)', leave: 'Leave', audit: 'Audit log', requests: 'Requests', setup: 'Setup', me: 'My Workspace', run: 'Run', lang: 'العربية', signout: 'Sign out',
    ehome: 'Home', eclock: 'Attendance', eleave: 'Leave', epay: 'Payslips', edocs: 'Documents', ereq: 'Requests', eai: 'HR assistant', etag: 'My ID tag', attendance: 'Attendance', away: "Who's away", eaway: "Who's away", ats: 'Applicant tracker', reflect: 'Wellness', ereflect: 'Check-in',
    ph: 'Ask or instruct… e.g. Hire Omar Al-Maktoum as Senior Engineer, AED 22,000, start Nov 1' },
  ar: { dash: 'مركز القيادة', emp: 'الموظفون', pay: 'الرواتب ونظام حماية الأجور', emi: 'التوطين', docs: 'رادار الوثائق', eosb: 'مكافأة نهاية الخدمة', leave: 'الإجازات', audit: 'سجل التدقيق', requests: 'الطلبات', setup: 'الإعداد', me: 'مساحتي', run: 'تنفيذ', lang: 'English', signout: 'تسجيل الخروج',
    ehome: 'الرئيسية', eclock: 'الحضور', eleave: 'الإجازات', epay: 'قسائم الرواتب', edocs: 'الوثائق', ereq: 'الطلبات', eai: 'مساعد الموارد البشرية', etag: 'بطاقتي', attendance: 'الحضور', away: 'من في إجازة', eaway: 'من في إجازة', ats: 'متابعة المتقدمين', reflect: 'الرفاهية', ereflect: 'تسجيل الحالة',
    ph: 'اطلب أو وجّه… مثال: تعيين عمر المكتوم مهندساً أول براتب 22,000 درهم' },
};
const t = (k) => T[L][k] || T.en[k];

// API client with a short-lived GET cache: identical requests in flight are shared, and repeat visits within
// CACHE_MS reuse the answer. Any write (POST/PUT/PATCH/DELETE) clears the cache so screens never show stale data.
const CACHE_MS = 20000; const apiCache = new Map();
async function rawApi(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { signOut(); throw new Error(data.error); }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
async function api(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  if (method !== 'GET') { apiCache.clear(); return rawApi(path, opts); }
  if (opts.fresh) apiCache.delete(path);
  const hit = apiCache.get(path);
  if (hit && Date.now() - hit.at < CACHE_MS) return structuredClone(await hit.p);
  const p = rawApi(path, opts); apiCache.set(path, { at: Date.now(), p });
  try { return structuredClone(await p); } catch (e) { apiCache.delete(path); throw e; }
}
const prefetch = (paths) => (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => paths.forEach((x) => api(x).catch(() => {})));

let tt;
function toast(m) { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => (el.hidden = true), 3200); }
const fail = (e) => toast(e.message);
const has = (...r) => me?.roles?.some((x) => r.includes(x) || x === 'owner');

// ---------------- Login ----------------
const EMP_ENTRY = /^\/employee\/?$/.test(location.pathname);
function loginView() {
  const empMode = EMP_ENTRY;
  const perks = empMode
    ? ['Clock in with a selfie and GPS', 'Apply for leave in seconds', 'Payslips and letters on your phone', 'Ask the HR assistant in your language']
    : ['WPS-ready payroll with 25 pre-flight checks', 'Emiratisation shield and NAFIS planner', 'Selfie + GPS attendance', 'Arabic and English, mobile ready'];
  $('#root').innerHTML = `<div class="login split">
    <aside class="login-side" aria-hidden="false">
      <div class="brand" style="color:#fff"><span class="mark">W</span><div><b>Wasl</b><small style="color:#bdbbb5">${empMode ? 'Employee app' : 'HRMS for the UAE'}</small></div></div>
      <div class="ls-mid"><h2 class="ls-title">${empMode ? 'Your workday, in your pocket.' : 'HR, payroll and compliance in one place.'}</h2>
        <ul class="ls-list">${perks.map((p) => `<li><span>${icon('M5 12l4 4 10-10', 14)}</span>${esc(p)}</li>`).join('')}</ul></div>
      <div class="powered" style="border-color:rgba(255,255,255,.12)"><span style="color:#bdbbb5">POWERED BY</span><img src="devx-logo-light.png" alt="DevX Technologies"></div>
    </aside>
    <form class="login-form" id="lf">
      <div class="lf-top"><a href="${empMode ? '/' : '/employee'}" style="font-size:13.5px">${empMode ? 'HR or manager? Sign in here' : 'Employee? Use the employee app'}</a></div>
      <div class="lf-box">
        <h1 style="font-size:34px;margin:0">${empMode ? 'Employee sign in' : 'Sign in'}</h1>
        <p class="sub" style="margin:0 0 8px">${empMode ? 'Use the work email HR gave you.' : 'Welcome back. Sign in to your workspace.'}</p>
        <div class="field"><label class="lbl" for="em">${empMode ? 'Work email' : 'Email'}</label><input id="em" type="email" autocomplete="username" value="${empMode ? 'ahmed@alnoor.demo' : 'admin@alnoor.demo'}" required></div>
        <div class="field"><label class="lbl" for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" value="Demo@2026" required></div>
        <div class="err" id="le"></div>
        <button class="btn pri" type="submit">Sign in</button>
        <p class="note" style="margin:0">${empMode
          ? 'Demo employees: ahmed@alnoor.demo (delivery driver), grace@alnoor.demo (sales). Password Demo@2026.'
          : 'Demo accounts: admin@alnoor.demo (HR + payroll maker), checker@alnoor.demo (payroll checker). Password Demo@2026.'}</p>
      </div>
    </form>
  </div>`;
  translateTree($('#root'), L);
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/auth/login', { method: 'POST', body: { email: $('#em').value, password: $('#pw').value } });
      token = r.token; me = r.user;
      localStorage.setItem('wasl_token', token); localStorage.setItem('wasl_user', JSON.stringify(me));
      shell();
    } catch (err) { $('#le').textContent = err.message; }
  };
}
function signOut() { window.waslFace?.reset(); apiCache.clear(); token = null; me = null; localStorage.removeItem('wasl_token'); localStorage.removeItem('wasl_user'); loginView(); }

// ---------------- Pulse grid background ----------------
const bg = { mx: -999, my: -999, raf: 0, rgb: accentRgb(), dark: document.documentElement.dataset.mode === 'dark' };
addEventListener('wasl:theme', () => { bg.rgb = accentRgb(); bg.dark = document.documentElement.dataset.mode === 'dark'; });
function startBackground() {
  const c = document.getElementById('bgfx'); if (!c) return;
  const ctx = c.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now(); const G = 48;
  const draw = () => {
    const w = innerWidth, h = innerHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = bg.dark ? 'rgba(255,255,255,0.05)' : 'rgba(17,17,17,0.045)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= w; x += G) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
    for (let y = 0; y <= h; y += G) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
    ctx.stroke();
    for (let x = 0; x < w; x += G) for (let y = 0; y < h; y += G) {
      const d = Math.hypot(x + G / 2 - bg.mx, y + G / 2 - bg.my);
      const wave = reduce ? 0 : Math.max(0, Math.sin(x * 0.013 + y * 0.021 - t * 1.4)) ** 8 * 0.3;
      const a = Math.max(wave, d < 200 ? (1 - d / 200) * 0.45 : 0);
      if (a > 0.02) { ctx.fillStyle = `rgba(${bg.rgb},${a * 0.45})`; ctx.fillRect(x + 4, y + 4, G - 8, G - 8); }
    }
    if (!reduce) bg.raf = requestAnimationFrame(draw);
  };
  addEventListener('pointermove', (e) => { bg.mx = e.clientX; bg.my = e.clientY; if (reduce) draw(); });
  addEventListener('resize', () => reduce && draw());
  draw();
}

// ---------------- Shell ----------------
const STAFF_MODS = ['dash', 'emp', 'attendance', 'away', 'ats', 'pay', 'emi', 'docs', 'eosb', 'leave', 'reflect', 'requests', 'setup', 'audit'];
const EMP_MODS = ['ehome', 'eclock', 'eleave', 'eaway', 'epay', 'edocs', 'ereq', 'ereflect', 'eai', 'etag'];
const isStaffUser = () => has('hr_admin', 'payroll_maker', 'payroll_checker', 'manager');
const mods = () => (isStaffUser() ? STAFF_MODS.filter((m) => !['audit', 'setup', 'requests', 'reflect'].includes(m) || has('hr_admin')) : EMP_MODS);
let ESTS = []; let EST = localStorage.getItem('wasl_est') || '';
const currentEst = () => ESTS.find((e) => e._id === EST) || ESTS.find((e) => e.jurisdiction === 'MAINLAND') || ESTS[0];
// Open an authenticated HTML document (payslip, letter) in a new tab
async function openHtml(path, opts = {}) {
  const w = window.open('', '_blank');
  try {
    const res = await fetch(API + path, { method: opts.method || 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
    const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
    if (w) w.location = url; else location.href = url;
  } catch (e) { if (w) w.close(); fail(e); }
}
async function openFile(path) {
  const w = window.open('', '_blank');
  try {
    const res = await fetch(API + path, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
    if ((res.headers.get('content-type') || '').includes('application/json')) { const j = await res.json(); if (w) w.location = j.url; return; }
    const url = URL.createObjectURL(await res.blob()); if (w) w.location = url;
  } catch (e) { if (w) w.close(); fail(e); }
}
const fileToBase64 = (file) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = bad; r.readAsDataURL(file); });
const ICONS = {
  dash: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  emp: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6M22 19v-1a4 4 0 0 0-3-3.9M16 4.1a3 3 0 0 1 0 5.8',
  pay: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zM3 7l2-3h11M16 13.5h2',
  emi: 'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3zM9 12l2 2 4-4',
  docs: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4',
  eosb: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  leave: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  audit: 'M9 5h11M9 12h11M9 19h11M4 5h.01M4 12h.01M4 19h.01',
  requests: 'M4 5h16v11H9l-5 4z',
  setup: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  ehome: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  eclock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  attendance: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  eleave: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  epay: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zM3 7l2-3h11M16 13.5h2',
  edocs: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4',
  ereq: 'M4 5h16v11H9l-5 4z',
  eai: 'M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z',
  etag: 'M4 6h16v12H4zM8 10h3M8 14h5M15 10h2v4h-2z',
  away: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M13 17h3',
  eaway: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4M8 14h3M13 17h3',
  ats: 'M3 17l5-5 4 4 8-8M15 8h5v5',
  reflect: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z',
  ereflect: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z',
};
const icon = (d, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
let collapsed = localStorage.getItem('wasl_rail') === '1';
function shell() {
  document.documentElement.dir = L === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = L;
  if (!mods().includes(cur)) cur = mods()[0];
  document.body.classList.toggle('empmode', !isStaffUser());
    $('#root').innerHTML = `<div class="app ${isStaffUser() ? '' : 'emp'}">
  <header class="topbar"><div class="topbar-in">
    <a class="brand" href="${isStaffUser() ? '/' : '/employee'}" aria-label="Wasl home"><span class="mark">W</span><span class="brand-txt"><b>Wasl</b><span class="by">by <img src="devx-logo-dark.png" alt="DevX Technologies"></span></span></a>
    ${isStaffUser() ? navHtml(SH) : `${navHtml(SH)}<button class="iconbtn menubtn" id="menuBtn" aria-label="Open menu" aria-controls="sidenav" aria-expanded="false">${icon('M4 7h16M4 12h16M4 17h16', 20)}</button><div class="page-title">${esc(t(cur))}</div>`}
    <div class="actions">
      <div style="position:relative"><button class="iconbtn" id="bell" aria-label="Notifications" title="Notifications">${icon('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0', 18)}<span id="bellCt" class="ct" hidden></span></button>
        <div id="bellPanel" class="panel popover" hidden></div></div>

      <div style="position:relative"><button class="avatarbtn" id="whoBtn" aria-haspopup="true" aria-expanded="false"><span class="av">${esc(ini(me.name))}</span><span class="who-txt"><b>${esc(me.name)}</b><small>${esc(isStaffUser() ? me.roles.map((r) => r.replace('_', ' ')).join(', ') : 'Employee')}</small></span></button>
        <div id="whoMenu" class="panel popover pmenu" hidden style="width:264px">${profileMenuHtml(SH)}</div></div>
    </div></div></header>
  ${isStaffUser() ? '' : `<aside class="sidenav" id="sidenav" aria-label="Main">
    <div class="sn-head"><span class="mark">W</span><div><b>Wasl</b><small>Employee app</small></div><button class="iconbtn sn-close" id="snClose" aria-label="Close menu">${icon('M6 6l12 12M18 6L6 18', 18)}</button></div>
    <div class="sn-who"><span class="av">${esc(ini(me.name))}</span><div style="min-width:0"><b>${esc(me.name)}</b><small>Employee</small></div></div>
    <nav class="sn-nav">${mods().map((m) => `<button class="nav ${m === cur ? 'on' : ''}" data-m="${m}">${icon(ICONS[m], 19)}<span>${t(m)}</span></button>`).join('')}</nav>
    <div class="sn-foot"><button class="btn" id="so2" style="width:100%">${t('signout')}</button><div class="powered"><span>POWERED BY</span><img src="devx-logo-dark.png" alt="DevX Technologies"></div></div>
  </aside><div class="scrim" id="scrim" hidden></div>`}
  ${railHtml(SH)}
  <main>
    ${pageHeadHtml(SH)}
    <div class="top"><form class="cmd" id="cf">${icon('M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z', 18)}<input id="cmd" autocomplete="off" placeholder="${esc(isStaffUser() ? t('ph') : 'Ask… e.g. I need a salary certificate for Emirates NBD')}"><button class="btn pri sm" type="submit">${t('run')}</button></form>
    ${isStaffUser() ? '<label class="sr" for="estSel">Entity</label><select id="estSel" class="btn" style="max-width:260px" title="Entity"></select>' : ''}</div>
    <div class="chips" id="chips" style="margin-bottom:18px"></div>
    <div id="agent"></div><section id="view"><div class="loading">Loading…</div></section>
  </main></div>`;
  document.querySelectorAll('.nav').forEach((b) => (b.onclick = () => go(b.dataset.m)));
  if ($('#so')) $('#so').onclick = signOut;
  if (!isStaffUser()) {
    const sn = $('#sidenav'), scrim = $('#scrim'), mb = $('#menuBtn');
    const setOpen = (o) => { document.body.classList.toggle('navopen', o); scrim.hidden = !o; mb.setAttribute('aria-expanded', String(o)); if (o) sn.querySelector('.nav.on')?.focus(); };
    mb.onclick = () => setOpen(!document.body.classList.contains('navopen'));
    $('#snClose').onclick = () => setOpen(false); scrim.onclick = () => setOpen(false);
    sn.onkeydown = (ev) => { if (ev.key === 'Escape') { setOpen(false); mb.focus(); } };
    $('#so2').onclick = signOut;
    document.body.classList.remove('navopen');
  }
  $('#whoBtn').onclick = (e) => { e.stopPropagation(); const m = $('#whoMenu'); m.hidden = !m.hidden; $('#whoBtn').setAttribute('aria-expanded', String(!m.hidden)); };
  if (!window.__whoBound) { window.__whoBound = true; document.addEventListener('click', (e) => { const m = $('#whoMenu'); if (m && !m.hidden && !e.target.closest('#whoMenu')) m.hidden = true; }); }
  { const on = document.querySelector('.navpills .nav.on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  if ($('#lb')) $('#lb').onclick = () => { L = L === 'en' ? 'ar' : 'en'; localStorage.setItem('wasl_lang', L); shell(); };
  $('#cf').onsubmit = (e) => { e.preventDefault(); const q = $('#cmd').value.trim(); if (!q) return; if (isStaffUser()) agent(q); else { pendingQuestion = q; go('eai'); } };
  ['Hire Omar Al-Maktoum as Senior Frontend Engineer, AED 22,000, start Nov 1', 'Ahmed Khan wants 3 days annual leave from 26 Oct', 'Salary certificate for Priya Menon addressed to Emirates NBD'].forEach((c) => {
    const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = c; b.onclick = () => { $('#cmd').value = c; agent(c); }; $('#chips').appendChild(b);
  });
  if (!isStaffUser() || cur !== 'dash') $('#chips').hidden = true;
  wireShell(SH);
  prefetch(isStaffUser() ? ['/employees?status=active', '/payroll/runs', '/dashboard', '/documents/expiring', '/leave'] : ['/me/home', '/me/payslips', '/me/leave', '/me/requests']);
  translateTree($('#root'), L);
  wireThemeButton();
  loadBell();
  if (isStaffUser()) {
    api('/establishments').then((list) => {
      ESTS = list; { const cr = document.querySelector('.crumbs span'); if (cr && currentEst()) cr.textContent = currentEst().name; }
      const sel = $('#estSel'); if (!sel) return;
      sel.innerHTML = list.map((e) => `<option value="${e._id}" ${currentEst()?._id === e._id ? 'selected' : ''}>${esc(e.name)}${e.freeZone ? ` · ${esc(e.freeZone)}` : ' · Mainland'}</option>`).join('');
      sel.onchange = () => { EST = sel.value; localStorage.setItem('wasl_est', EST); views[cur]().catch(fail); };
    }).catch(() => {});
  }
  views[cur]().catch(fail);
}
async function loadBell() {
  try {
    const list = await api('/notifications');
    const unread = list.filter((n) => !n.read).length;
    const ct = $('#bellCt'); if (ct) { ct.hidden = !unread; ct.textContent = unread > 9 ? '9+' : unread; }
    const panel = $('#bellPanel');
    panel.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-family:var(--f-display);letter-spacing:-.01em">Notifications</b><button class="btn sm" id="readAll">Mark all read</button></div>
      ${list.length ? list.map((n) => `<div class="row" style="padding:10px 0"><span class="sev" style="background:var(--${sevVar(n.severity)})"></span><div class="grow"><div style="font-size:14px;${n.read ? 'color:var(--muted)' : ''}">${esc(n.title)}</div><div style="font-size:12px;color:var(--muted)">${esc(n.body || '')} · ${new Date(n.createdAt).toLocaleDateString('en-GB')}</div></div>${n.link ? `<button class="btn sm" data-link="${esc(n.link.slice(1))}">Open</button>` : ''}</div>`).join('') : '<div class="empty">No notifications yet.</div>'}`;
    translateTree(panel, L);
    $('#bell').onclick = () => { panel.hidden = !panel.hidden; };
    $('#readAll').onclick = async () => { await api('/notifications/read-all', { method: 'POST' }); loadBell(); };
    panel.querySelectorAll('[data-link]').forEach((b) => (b.onclick = () => { panel.hidden = true; go(b.dataset.link); }));
  } catch { /* bell is optional */ }
}
function go(m) { if (m === 'emp') { EMP_OPEN = ''; try { localStorage.removeItem('wasl_empid'); } catch {} } cur = m; location.hash = m; shell(); }
const V = (html) => { $('#view').innerHTML = html; translateTree($('#view'), L); animateView($('#view')); };
// Entrance motion: staggered card rise + count-up numbers (skipped for reduced-motion users)
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateView(root) {
  if (REDUCE) return;
  root.querySelectorAll('.panel, .idcard').forEach((el, i) => { el.style.setProperty('--i', Math.min(i, 12)); el.classList.add('rise'); });
  root.querySelectorAll('.stat .v, .big').forEach((el) => {
    const node = [...el.childNodes].find((n) => n.nodeType === 3 && /\d/.test(n.textContent));
    if (!node) return;
    const m = node.textContent.match(/^(\s*)([\d,]+(?:\.\d+)?)(.*)$/s); if (!m) return;
    const target = parseFloat(m[2].replace(/,/g, '')); if (!isFinite(target) || target === 0) return;
    const dec = (m[2].split('.')[1] || '').length, comma = m[2].includes(','), t0 = performance.now(), dur = 900;
    const fmt = (v) => { const x = v.toFixed(dec); return comma ? Number(x).toLocaleString('en-AE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : x; };
    const step = (now) => { const p = Math.min(1, (now - t0) / dur), e = 1 - (1 - p) ** 3; node.textContent = m[1] + fmt(target * e) + m[3]; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const sevVar = (s) => ({ bad: 'bad', warn: 'warn', info: 'accent' }[s] || 'accent');
const pill = (cls, txt) => `<span class="pill ${cls}">${esc(txt)}</span>`;

// ---------------- Views ----------------
const views = {
  async dash() {
    const [d, runs, emps] = await Promise.all([api('/dashboard'), api('/payroll/runs'), api('/employees?status=active')]);
    const k = (f) => (f >= 100000000 ? `${Math.round(f / 100000)}k` : AED0(f));
    const first = (me.name || '').split(' ')[0];
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    V(`<div class="eyebrow">${esc(today)}</div>
    <h1>Good day, <em>${esc(first)}</em></h1><p class="sub">Everything due across your establishments this month, ranked by risk.</p>
    <div class="grid g4">
      <div class="panel stat"><div class="v">${d.headcount}</div><span class="lbl">Active employees</span><div class="d">${d.nationals} UAE nationals</div></div>
      <div class="panel stat"><div class="v num">${d.lastRun ? k(d.lastRun.totals?.netFils || 0) : '—'}</div><span class="lbl">Latest net payroll · AED</span><div class="d">${d.lastRun ? `${d.lastRun.period} · ${esc(d.lastRun.status.replace('_', ' '))}` : 'No run yet'}</div></div>
      <div class="panel stat"><div class="v ${d.expiringCount ? 'warn' : ''}">${d.expiringCount}</div><span class="lbl">Docs expiring ≤ 30 days</span><div class="d">Visas, Emirates IDs, licences</div></div>
      <div class="panel stat"><div class="v num ${d.exposureFils ? 'bad' : ''}">${k(d.exposureFils)}</div><span class="lbl">Penalty risk · AED / month</span><div class="d">${d.exposureFils ? 'Emiratisation slot unfilled' : 'No quota gap'}</div></div>
    </div>
    <div class="grid g3" style="margin-top:16px">
      <div class="panel span2"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div><h2 style="margin:0">Net payroll</h2><div style="color:var(--muted);font-size:13px">AED thousands · hover for each month</div></div>
        <div class="seg" role="group" aria-label="Range"><button data-r="6">6M</button><button data-r="12" class="on">12M</button></div></div>
        <div class="chart" id="chart"></div></div>
      <div class="panel"><h2>Headcount by team</h2><div id="deptCap" style="font-size:13px;color:var(--muted);min-height:20px;margin-bottom:6px"></div><div id="depts" style="display:flex;flex-direction:column;gap:6px"></div></div>
    </div>
    <div class="panel" style="margin-top:16px"><h2>Needs attention</h2><div class="list">
      ${d.actions.length ? d.actions.map((a) => `<div class="row"><span class="sev" style="background:var(--${sevVar(a.severity)})"></span><div class="grow">${esc(a.text)}</div><button class="btn sm" data-go="${a.go}">Open</button></div>`).join('') : '<div class="empty">Nothing needs attention right now.</div>'}
    </div></div>`);
    document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));

    // Interactive payroll trend
    const series = runs.filter((r) => r.totals?.netFils).sort((a, b) => a.period.localeCompare(b.period)).map((r) => ({ p: r.period, v: r.totals.netFils / 100000 }));
    const drawChart = (n) => {
      const data = series.slice(-n);
      const el = $('#chart');
      if (data.length < 2) { el.innerHTML = '<div class="empty">The trend appears after two payroll runs.</div>'; return; }
      const vs = data.map((x) => x.v), lo = Math.floor(Math.min(...vs) * 0.97), hi = Math.ceil(Math.max(...vs) * 1.02);
      const X0 = 48, X1 = 664, Y0 = 200, Y1 = 16;
      const px = (i) => X0 + (i * (X1 - X0)) / (data.length - 1), py = (v) => Y0 - ((v - lo) / (hi - lo || 1)) * (Y0 - Y1);
      const pts = data.map((x, i) => [px(i), py(x.v)]);
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
      const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
      const mon = (p) => new Date(p + '-01').toLocaleDateString('en-GB', { month: 'short' });
      el.innerHTML = `<svg viewBox="0 0 680 230" role="img" aria-label="Net payroll trend">
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop style="stop-color:var(--accent)" offset="0" stop-opacity=".3"/><stop style="stop-color:var(--accent)" offset="1" stop-opacity="0"/></linearGradient></defs>
        ${ticks.map((v) => `<line style="stroke:var(--line)" x1="40" x2="672" y1="${py(v)}" y2="${py(v)}"/><text style="fill:var(--faint)" x="0" y="${py(v) + 4}" font-size="11">${Math.round(v)}</text>`).join('')}
        <path d="${line} L${X1} ${Y0} L${X0} ${Y0} Z" fill="url(#ga)"/>
        <path style="stroke:var(--accent)" d="${line}" fill="none" stroke-width="2.5" stroke-linejoin="round"/>
        ${data.map((x, i) => `<text style="fill:var(--faint)" x="${px(i)}" y="226" font-size="11" text-anchor="middle">${mon(x.p)}</text>`).join('')}
        <circle style="fill:var(--accent)" cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4.5"/>
        <g id="hov" visibility="hidden"><line style="stroke:var(--accent)" id="hl" y1="12" y2="200" stroke-opacity=".4" stroke-dasharray="3 4"/><circle style="fill:var(--surface);stroke:var(--accent)" id="hc" r="6" stroke-width="2.5"/></g>
      </svg><div class="tip" id="tip" hidden></div>`;
      const svg = el.querySelector('svg'), tip = $('#tip');
      svg.onmousemove = (e) => {
        const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 680;
        const i = Math.max(0, Math.min(data.length - 1, Math.round(((x - X0) / (X1 - X0)) * (data.length - 1))));
        $('#hov').setAttribute('visibility', 'visible');
        $('#hl').setAttribute('x1', pts[i][0]); $('#hl').setAttribute('x2', pts[i][0]);
        $('#hc').setAttribute('cx', pts[i][0]); $('#hc').setAttribute('cy', pts[i][1]);
        tip.hidden = false; tip.style.left = `${(pts[i][0] / 680) * 100}%`;
        tip.innerHTML = `<small>${esc(data[i].p)}</small><span class="num">AED ${data[i].v.toFixed(1)}k</span>`;
      };
      svg.onmouseleave = () => { $('#hov').setAttribute('visibility', 'hidden'); tip.hidden = true; };
    };
    document.querySelectorAll('.seg button').forEach((b) => (b.onclick = () => { document.querySelectorAll('.seg button').forEach((x) => x.classList.toggle('on', x === b)); drawChart(+b.dataset.r); }));
    drawChart(12);

    // Team bars
    const byDept = {}; emps.forEach((e) => { const k2 = e.department || 'Other'; (byDept[k2] ||= []).push(e); });
    const teams = Object.entries(byDept).sort((a, b) => b[1].length - a[1].length);
    const max = teams[0]?.[1].length || 1;
    const showDept = (name) => {
      const list = byDept[name] || [];
      const nat = list.filter((e) => e.isUaeNational).length;
      $('#deptCap').textContent = `${name} · ${list.length} people${nat ? ` · ${nat} UAE national${nat > 1 ? 's' : ''}` : ''}`;
      document.querySelectorAll('#depts .bar').forEach((b) => b.classList.toggle('on', b.dataset.d === name));
    };
    $('#depts').innerHTML = teams.map(([name, list]) => `<button class="bar" data-d="${esc(name)}"><div style="display:flex;justify-content:space-between;font-size:13px"><span>${esc(name)}</span><span class="num" style="color:var(--muted)">${list.length}</span></div><div class="t"><i style="width:${(list.length / max) * 100}%"></i></div></button>`).join('');
    document.querySelectorAll('#depts .bar').forEach((b) => { b.onmouseenter = b.onfocus = b.onclick = () => showDept(b.dataset.d); });
    if (teams[0]) showDept(teams[0][0]);
  },

  async emp() {
    const list = await api('/employees');
    V(`<h1>${t('emp')}</h1><p class="sub">${list.length} employees. Bank details are masked; full IBANs are never sent to the browser.</p>
    <div class="panel tw"><table><thead><tr><th>Employee</th><th>Role</th><th>Nationality</th><th>Joined</th><th>Status</th><th>IBAN</th><th class="r">Basic (AED)</th></tr></thead><tbody>
    ${list.map((e) => `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="av">${esc(ini(e.fullName))}</span><div><b style="font-weight:500">${esc(L === 'ar' && e.fullNameAr ? e.fullNameAr : e.fullName)}</b><div class="mono" style="font-size:11px;color:var(--muted)">${esc(e.employeeNo)}</div></div></div></td>
      <td>${esc(e.jobTitle)}</td><td>${e.isUaeNational ? pill('p-g', 'UAE National') : esc(e.nationality)}</td><td class="mono">${fmtDate(e.joinDate)}</td>
      <td>${pill(e.status === 'active' ? 'p-ok' : 'p-n', e.status)}</td>
      <td>${e.ibanValid ? `<span class="mono">${esc(e.bank.ibanMasked)}</span>` : `${pill('p-bad', 'Invalid')} ${has('hr_admin') ? `<button class="btn sm" data-fix="${e._id}">Update</button>` : ''}`}</td>
      <td class="r num">${AED(e.compensation.basicFils)}</td></tr>`).join('')}
    </tbody></table></div>`);
    document.querySelectorAll('[data-fix]').forEach((b) => (b.onclick = () => ibanForm(b.dataset.fix, b.closest('td'))));
  },

  async pay() {
    const [ests, runs, emps] = await Promise.all([api('/establishments'), api('/payroll/runs'), api('/employees')]);
    const est = (EST && ests.find((e) => e._id === EST)) || ests.find((e) => e.jurisdiction === 'MAINLAND') || ests[0];
    const now = new Date(); const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let run = runs.find((r) => r.period === period && String(r.establishmentId) === String(est._id) && (r.type || 'regular') === 'regular');
    const extraRuns = runs.filter((r) => String(r.establishmentId) === String(est._id) && r.type && r.type !== 'regular');
    if (!run) {
      V(`<div class="eyebrow">${esc(est.name)}</div><h1>Payroll <em>studio</em></h1>
      <div class="panel"><p>No payroll computed for ${period} yet. Computing pulls salaries, overtime, unpaid leave and loans, then runs every WPS check.</p><button class="btn pri" id="comp">Compute ${period} payroll</button></div>`);
      $('#comp').onclick = () => compute(est._id, period); return;
    }
    run = await api(`/payroll/runs/${run._id}`);
    const pf = await api(`/payroll/runs/${run._id}/preflight`);
    const deptOf = Object.fromEntries(emps.map((e) => [String(e._id), e.department || 'Other']));
    const released = ['approved', 'exported', 'paid'].includes(run.status);
    const stepsAll = ['draft', 'pending_approval', 'approved', 'exported'];
    const at = run.status === 'preflight_failed' ? 0 : stepsAll.indexOf(run.status);
    const fixedT = run.lines.reduce((a, l) => a + l.fixedFils, 0), varT = run.lines.reduce((a, l) => a + l.variableFils, 0), dedT = run.lines.reduce((a, l) => a + (l.deductionsFils || 0), 0);
    const gross = fixedT + varT + dedT || 1;
    const C = 2 * Math.PI * 52, seg = (f) => (f / gross) * C;
    V(`<div class="eyebrow">${esc(est.name)} · RULE PACK ${esc(run.rulePack)}</div>
    <h1>Payroll <em>studio</em> · ${run.period}</h1><p class="sub">Export stays locked until pre-flight passes and a different person approves.</p>
    <div class="steps">${['Compute', 'Pre-flight & submit', 'Checker approval', 'SIF export'].map((s, i) => `<span class="${i < at + 1 ? 'done' : i === at + 1 ? 'on' : ''}">${s}</span>`).join('')}</div>
    <div class="grid g3">
      <div class="panel span2"><div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><h2 style="margin:0">Cost by team</h2><span style="font-size:13px;color:var(--muted)">Click a column to filter the register</span></div>
        <div id="cols" style="display:flex;align-items:flex-end;gap:16px;height:220px;margin-top:18px;border-bottom:1px solid var(--line)"></div>
        <div id="colLabels" style="display:flex;gap:16px;margin-top:8px"></div></div>
      <div class="panel"><h2>Pay mix</h2><div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Pay mix">
          <circle style="stroke:var(--surface-2)" cx="70" cy="70" r="52" fill="none" stroke-width="18"/>
          <circle style="stroke:var(--accent)" cx="70" cy="70" r="52" fill="none" stroke-width="18" stroke-dasharray="${seg(fixedT)} 999" transform="rotate(-90 70 70)"/>
          <circle style="stroke:var(--black)" cx="70" cy="70" r="52" fill="none" stroke-width="18" stroke-dasharray="${seg(varT)} 999" stroke-dashoffset="${-seg(fixedT)}" transform="rotate(-90 70 70)"/>
          <circle style="stroke:var(--warn)" cx="70" cy="70" r="52" fill="none" stroke-width="18" stroke-dasharray="${seg(dedT)} 999" stroke-dashoffset="${-seg(fixedT) - seg(varT)}" transform="rotate(-90 70 70)"/>
          <text style="fill:var(--faint)" x="70" y="66" text-anchor="middle" font-size="11">NET AED</text>
          <text style="fill:var(--ink)" x="70" y="88" text-anchor="middle" font-size="22" font-weight="600" font-family="Geist, sans-serif">${Math.round(run.totals.netFils / 100000)}k</text></svg>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
          <div><span style="display:inline-block;width:10px;height:10px;background:var(--accent);margin-inline-end:8px"></span>Fixed ${Math.round((fixedT / gross) * 100)}%</div>
          <div><span style="display:inline-block;width:10px;height:10px;background:var(--black);margin-inline-end:8px"></span>Overtime &amp; commission ${Math.round((varT / gross) * 100)}%</div>
          <div><span style="display:inline-block;width:10px;height:10px;background:var(--warn);margin-inline-end:8px"></span>Deductions ${Math.round((dedT / gross) * 100)}%</div></div></div></div>
    </div>
    <div class="grid g3" style="margin-top:16px">
      <div class="panel span2"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0" id="regTitle">Register · all teams</h2><button class="btn sm" id="regAll" hidden>Show all teams</button></div>
        <div class="tw" style="margin-top:10px"><table><thead><tr><th>Employee</th><th>Team</th><th class="r">Fixed</th><th class="r">Variable</th><th class="r">Net</th><th>Status</th>${released ? '<th>Payslip</th>' : ''}</tr></thead><tbody id="reg"></tbody></table></div></div>
      <div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">WPS pre-flight</h2>${pf.blocking ? pill('p-bad', `${pf.blocking} blocking`) : pill('p-ok', 'No blocking errors')}</div>
        <div class="meter" style="margin:12px 0 4px"><i id="pfBar" style="width:0%"></i></div>
        <div id="pfList"></div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap" id="acts"><button class="btn" id="rerun">Re-run checks</button></div></div>
    </div><div id="sifOut"></div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h2>Payslips</h2>
        ${released ? `<p style="margin:0 0 12px;color:var(--muted)">Bilingual payslips are ready. Releasing notifies every employee in My Workspace, and by email or WhatsApp where configured.</p><button class="btn pri" id="relSlips">Release payslips</button>` : '<p style="margin:0;color:var(--muted)">Payslips become available once this payroll is approved by a checker.</p>'}
        <h2 style="margin-top:22px">Off-cycle payment</h2>
        <form id="ocForm" class="form"><div class="field" style="grid-column:1/-1"><label class="lbl" for="ocTitle">Title</label><input id="ocTitle" placeholder="e.g. Eid bonus, missed overtime" required></div>
          <div class="field"><label class="lbl" for="ocEmp">Employee</label><select id="ocEmp">${emps.filter((e) => String(e.establishmentId) === String(est._id) && e.status !== 'exited').map((e) => `<option value="${e._id}">${esc(e.fullName)}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl" for="ocAmt">Amount (AED)</label><input id="ocAmt" type="number" min="1" step="0.01" required></div>
          <div style="grid-column:1/-1"><button class="btn" type="submit">Create off-cycle run</button></div></form></div>
      <div class="panel"><h2>Off-cycle &amp; final settlement runs</h2>
        ${extraRuns.length ? `<div class="list">${extraRuns.map((x) => `<div class="row"><div class="grow"><b style="font-weight:600">${esc(x.title || x.type)}</b><div style="font-size:12px;color:var(--muted)">${esc(x.period)} · ${esc(x.type)} #${x.runNo} · AED ${AED(x.totals?.netFils)}</div></div>${pill(x.status === 'draft' ? 'p-n' : x.status === 'pending_approval' ? 'p-warn' : 'p-ok', x.status.replace('_', ' '))}
          ${x.status === 'draft' && has('payroll_maker', 'hr_admin') ? `<button class="btn sm" data-sub="${x._id}">Submit</button>` : ''}${x.status === 'pending_approval' && has('payroll_checker') ? `<button class="btn sm pri" data-appr="${x._id}">Approve</button>` : ''}${['approved', 'exported'].includes(x.status) ? `<button class="btn sm" data-sif="${x._id}">SIF</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">None yet. Final settlements are created from the Gratuity screen.</div>'}</div>
    </div>`);

    if ($('#relSlips')) $('#relSlips').onclick = async () => { try { const r2 = await api(`/payroll/runs/${run._id}/payslips/send`, { method: 'POST' }); toast(`Released ${r2.released} payslips${r2.channels.email || r2.channels.whatsapp ? ' (with email/WhatsApp)' : ''}`); } catch (e) { fail(e); } };
    $('#ocForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/payroll/offcycle', { method: 'POST', body: { establishmentId: est._id, period, title: $('#ocTitle').value, items: [{ employeeId: $('#ocEmp').value, amount: $('#ocAmt').value }] } }); toast('Off-cycle run created as draft'); views.pay(); } catch (err) { fail(err); } };
    document.querySelectorAll('[data-sub]').forEach((b) => (b.onclick = async () => { try { const r2 = await api(`/payroll/runs/${b.dataset.sub}/submit`, { method: 'POST' }); toast(r2.blocking ? `Blocked: ${r2.blocking} error(s)` : 'Sent to checker'); views.pay(); } catch (e) { fail(e); } }));
    document.querySelectorAll('[data-appr]').forEach((b) => (b.onclick = async () => { try { await api(`/payroll/runs/${b.dataset.appr}/approve`, { method: 'POST' }); toast('Approved'); views.pay(); } catch (e) { fail(e); } }));
    document.querySelectorAll('[data-sif]').forEach((b) => (b.onclick = async () => { try { const r2 = await api(`/payroll/runs/${b.dataset.sif}/sif`, { method: 'POST' }); const url = URL.createObjectURL(new Blob([r2.content], { type: 'text/plain' })); const a = document.createElement('a'); a.href = url; a.download = r2.filename; a.click(); } catch (e) { fail(e); } }));

    // Team columns + register filter
    const teams = {}; run.lines.forEach((l) => { const d = deptOf[String(l.employeeId)] || 'Other'; teams[d] = (teams[d] || 0) + l.netFils; });
    const tlist = Object.entries(teams).sort((a, b) => b[1] - a[1]); const tmax = tlist[0]?.[1] || 1;
    let team = null;
    const drawReg = () => {
      const rows = run.lines.filter((l) => !team || deptOf[String(l.employeeId)] === team);
      $('#reg').innerHTML = rows.map((l) => `<tr><td>${esc(l.employeeName)}</td><td style="color:var(--muted)">${esc(deptOf[String(l.employeeId)] || '')}</td><td class="r num">${AED(l.fixedFils)}</td><td class="r num">${AED(l.variableFils)}</td><td class="r num">${AED(l.netFils)}</td><td>${l.held ? pill('p-bad', 'Held') : l.flags.some((f) => f.severity === 'warn') ? pill('p-warn', 'Review') : l.unpaidLeaveDays ? pill('p-warn', `${l.unpaidLeaveDays}d unpaid`) : pill('p-ok', 'Ready')}</td>${released ? `<td><button class="btn sm" data-slip="${l.employeeId}">View</button></td>` : ''}</tr>`).join('');
      document.querySelectorAll('[data-slip]').forEach((b) => (b.onclick = () => openHtml(`/payroll/runs/${run._id}/payslips/${b.dataset.slip}`)));
      $('#regTitle').textContent = `Register · ${team || 'all teams'}`; $('#regAll').hidden = !team;
      document.querySelectorAll('#cols button').forEach((b) => { const on = b.dataset.t === team; b.querySelector('i').style.background = team ? (on ? 'var(--accent)' : 'var(--line-2)') : 'var(--black)'; });
    };
    $('#cols').innerHTML = tlist.map(([n, v]) => `<button data-t="${esc(n)}" aria-label="${esc(n)} AED ${Math.round(v / 100000)} thousand" style="all:unset;cursor:pointer;flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px"><span class="num" style="font-size:12px;color:var(--muted)">${Math.round(v / 100000)}k</span><i style="display:block;width:100%;max-width:60px;height:0%;background:var(--black);border-radius:3px 3px 0 0;transition:height .6s cubic-bezier(.2,.8,.2,1),background .2s"></i></button>`).join('');
    $('#colLabels').innerHTML = tlist.map(([n]) => `<span style="flex:1;text-align:center;font-size:12px;color:var(--muted)">${esc(n)}</span>`).join('');
    requestAnimationFrame(() => document.querySelectorAll('#cols button').forEach((b, i) => { b.querySelector('i').style.height = `${(tlist[i][1] / tmax) * 88}%`; }));
    document.querySelectorAll('#cols button').forEach((b) => (b.onclick = () => { team = team === b.dataset.t ? null : b.dataset.t; drawReg(); }));
    $('#regAll').onclick = () => { team = null; drawReg(); };
    drawReg();

    // Animated pre-flight reveal
    let timer;
    const reveal = () => {
      clearInterval(timer); let n = 0; const list = pf.checks;
      const paint = () => {
        if (!$('#pfBar')) { clearInterval(timer); return; } // user navigated away
        $('#pfBar').style.width = `${(n / list.length) * 100}%`;
        $('#pfList').innerHTML = list.map((c, i) => i < n
          ? `<div class="check"><span class="ic ${c.status === 'pass' ? 'ok' : c.status === 'fail' ? 'bad' : 'warn'}">${c.status === 'pass' ? '✓' : c.status === 'fail' ? '!' : '~'}</span><div style="min-width:0"><div>${esc(c.label)}</div><div class="mono" style="font-size:12px;color:var(--muted);overflow-wrap:anywhere">${esc(c.detail)}</div></div></div>`
          : `<div class="check" style="color:var(--muted)"><span class="ic" style="background:var(--surface-2)"></span><div>${esc(c.label)}</div></div>`).join('');
      };
      paint();
      timer = setInterval(() => { n++; paint(); if (n >= list.length) clearInterval(timer); }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
    };
    $('#rerun').onclick = reveal; reveal();

    const acts = $('#acts');
    const btn = (label, fn, pri) => { const b = document.createElement('button'); b.className = `btn ${pri ? 'pri' : ''}`; b.textContent = label; b.onclick = () => fn().catch(fail); acts.appendChild(b); };
    if (!run.locked && has('payroll_maker', 'hr_admin')) btn('Recompute', () => compute(est._id, period));
    if (['draft', 'preflight_failed'].includes(run.status) && has('payroll_maker', 'hr_admin')) btn('Submit for approval', async () => { const r = await api(`/payroll/runs/${run._id}/submit`, { method: 'POST' }); toast(r.blocking ? `Blocked: ${r.blocking} error(s) to fix first` : 'Sent to checker'); shell(); }, true);
    if (run.status === 'pending_approval' && has('payroll_checker')) btn('Approve payroll', async () => { await api(`/payroll/runs/${run._id}/approve`, { method: 'POST' }); toast('Approved and locked'); shell(); }, true);
    if (run.status === 'pending_approval' && !has('payroll_checker')) acts.insertAdjacentHTML('beforeend', `<span class="note" style="margin:0">Waiting for a payroll checker. Sign in as checker@alnoor.demo to approve.</span>`);
    if (['approved', 'exported'].includes(run.status)) btn('Export .SIF', async () => {
      const r = await api(`/payroll/runs/${run._id}/sif`, { method: 'POST' });
      const url = URL.createObjectURL(new Blob([r.content], { type: 'text/plain' }));
      $('#sifOut').innerHTML = `<div class="panel" style="margin-top:16px"><h2>${esc(r.filename)}</h2><pre class="sif">${esc(r.content)}</pre><a class="btn pri" style="display:inline-block;margin-top:10px;text-decoration:none" href="${url}" download="${esc(r.filename)}">Download file</a></div>`;
    }, true);
  },

  async emi() {
    const list = await api('/compliance/emiratisation');
    const a = list.find((x) => x.applicable) || list[0];
    if (!a) { V(`<h1>${t('emi')}</h1><div class="panel empty">No establishments yet.</div>`); return; }
    const others = list.filter((x) => x !== a);
    V(`<div class="eyebrow">RULE PACK ${esc(a.rulePack || '')}</div><h1>Emiratisation <em>shield</em></h1>
    <p class="sub">Quota status from the versioned rule pack, plus a planner to compare hiring against paying the fine. Figures need legal validation.</p>
    ${a.applicable ? `<div class="grid g2">
      <div class="panel"><div class="lbl">${esc(a.establishment.name)} · Tier ${a.tier} · ${a.headcount} staff</div>
        <div class="big" style="margin-top:8px">${a.qualifyingCount} <span style="color:var(--muted);font-size:24px">/ ${a.required}</span></div>
        <div class="meter" style="margin:12px 0"><i style="width:${Math.min(100, (a.qualifyingCount / a.required) * 100)}%"></i></div>
        <div class="list">${a.qualifying.map((q) => `<div class="row"><span class="av">${esc(ini(q.name))}</span><div class="grow">${esc(q.name)}<div style="font-size:12px;color:var(--muted)">AED ${AED0(q.wageFils)} / month</div></div>${pill('p-ok', 'Counts')}</div>`).join('')}
        ${a.notQualifying.map((q) => `<div class="row"><span class="av">${esc(ini(q.name))}</span><div class="grow">${esc(q.name)}<div style="font-size:12px;color:var(--bad)">${esc(q.reasons.join(' · '))}</div></div>${pill('p-bad', 'Not counted')}</div>`).join('')}
        ${(a.inGrace || []).map((q) => `<div class="row"><span class="av">${esc(ini(q.name))}</span><div class="grow">${esc(q.name)}<div style="font-size:12px;color:var(--muted)">Left ${fmtDate(q.exitDate)} · slot protected until ${fmtDate(q.graceUntil)}</div></div>${pill('p-warn', 'Grace period')}</div>`).join('')}</div>
        ${a.checkpoint ? `<p class="note">Next checkpoint ${esc(a.checkpoint.date)}: ${a.checkpoint.pct}% of skilled roles.</p>` : ''}
        ${(a.alerts || []).map((al) => `<div class="row" style="padding:8px 0"><span class="sev" style="background:var(--${sevVar(al.severity)})"></span><div class="grow" style="font-size:13px">${esc(al.msg)}</div></div>`).join('')}</div>
      <div class="panel"><h2>Hire vs. pay the fine</h2>
        <div class="field"><label class="lbl" for="pH" style="display:flex;justify-content:space-between">New UAE national hires <span class="num" id="pHv" style="color:var(--accent-hi)"></span></label><input id="pH" type="range" min="0" max="4" step="1" value="${a.gap}" style="accent-color:var(--accent)"></div>
        <div class="field" style="margin-top:12px"><label class="lbl" for="pW" style="display:flex;justify-content:space-between">Monthly wage per hire <span class="num" id="pWv" style="color:var(--accent-hi)"></span></label><input id="pW" type="range" min="6000" max="15000" step="500" value="6500" style="accent-color:var(--accent)"></div>
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px">
          <div class="panel" style="padding:14px;background:var(--surface-2)"><div class="lbl">Quota</div><div class="big" id="pQ" style="font-size:34px"></div></div>
          <div class="panel" style="padding:14px;background:var(--surface-2)"><div class="lbl">Fine / year</div><div class="big" id="pF" style="font-size:34px"></div></div>
          <div class="panel" style="padding:14px;background:var(--surface-2);grid-column:span 2"><div class="lbl">Net hiring cost / year after modelled NAFIS</div><div class="big" id="pC" style="font-size:34px"></div></div>
        </div><p class="note">Scenario only. NAFIS support depends on the candidate and programme rules.</p></div>
    </div>` : `<div class="panel">${esc(a.reason || 'Below quota thresholds.')}</div>`}
    ${others.map((o) => `<div class="panel" style="margin-top:16px"><h2>${esc(o.establishment.name)}</h2><p style="margin:0;color:var(--muted)">${esc(o.reason || (o.applicable ? `Tier ${o.tier}: ${o.qualifyingCount}/${o.required}` : 'Below quota thresholds.'))}</p></div>`).join('')}`);
    if (!a.applicable) return;
    const upd = () => {
      const h = +$('#pH').value, w = +$('#pW').value;
      const quota = Math.min(a.required, a.qualifyingCount + h), gap = Math.max(0, a.required - quota);
      const fine = gap * 9000 * 12, sub = Math.min(Math.round(w * 0.5), 7000), cost = h * (w - sub) * 12;
      $('#pHv').textContent = h; $('#pWv').textContent = `AED ${w.toLocaleString('en-AE')}`;
      $('#pQ').textContent = `${quota}/${a.required}`; $('#pQ').style.color = gap ? 'var(--warn)' : 'var(--ok)';
      $('#pF').textContent = fine ? `AED ${fine.toLocaleString('en-AE')}` : 'None'; $('#pF').style.color = fine ? 'var(--bad)' : 'var(--ok)';
      $('#pC').textContent = `AED ${cost.toLocaleString('en-AE')}`;
    };
    $('#pH').oninput = $('#pW').oninput = upd; upd();
  },

  async docs() {
    const docs = await api('/documents/expiring?days=120');
    const col = (d) => (d <= 14 ? 'var(--bad)' : d <= 30 ? 'var(--warn)' : 'var(--ok)');
    const hash = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
    const dots = docs.map((d, i) => {
      // golden-angle spacing spreads points evenly around the radar; hash keeps each document's spot stable
      const days = Math.max(0, Math.min(120, d.daysLeft)), r = 14 + (days / 120) * 146, ang = ((i * 137.508 + (hash(d._id) % 23)) % 360) * (Math.PI / 180);
      return { d, x: 180 + r * Math.cos(ang), y: 180 - r * Math.sin(ang) };
    });
    const week = Array.from({ length: 12 }, (_, i) => docs.filter((d) => d.daysLeft >= i * 7 && d.daysLeft < (i + 1) * 7));
    const overdue = docs.filter((d) => d.daysLeft < 0).length;
    const nextStep = { residence_visa: 'Medical fitness → EID biometrics → visa stamping', emirates_id: 'Typing centre application → biometrics', passport: 'Collect new passport scan', labour_card: 'MOHRE renewal', health_insurance: 'Insurer renewal quote', driving_licence: 'RTA renewal', trade_licence: 'DED renewal + tenancy contract', establishment_card: 'ICP online renewal' };
    V(`<div class="eyebrow">NEXT 120 DAYS · ${docs.length} DOCUMENTS${overdue ? ` · ${overdue} OVERDUE` : ''}</div><h1>Compliance <em>radar</em></h1>
    <p class="sub">Each point is a document. The closer to the centre, the sooner it expires. Click a point to open it.</p>
    <style>@keyframes rdSweep{to{transform:rotate(360deg)}}.rd-sweep{transform-origin:180px 180px;animation:rdSweep 6s linear infinite}.rd-dot{cursor:pointer}.rd-dot:focus{outline:none}.rd-dot:focus circle:last-child{stroke:#fff}@media (prefers-reduced-motion:reduce){.rd-sweep{animation:none}}</style>
    <div class="grid g2">
      <div class="panel" style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
        <svg viewBox="0 0 360 360" width="340" style="max-width:100%;height:auto;flex:0 1 340px" role="img" aria-label="Document expiry radar">
          <defs><linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop style="stop-color:var(--accent)" offset="0" stop-opacity="0"/><stop style="stop-color:var(--accent)" offset="1" stop-opacity=".35"/></linearGradient></defs>
          ${[30, 60, 90, 120].map((dd) => { const r = 14 + (dd / 120) * 146; return `<circle cx="180" cy="180" r="${r}" fill="none" stroke="${dd === 30 ? 'var(--accent-soft)' : 'var(--line)'}"/><text style="fill:var(--faint)" x="184" y="${180 - r + 12}" font-size="10">${dd}d</text>`; }).join('')}
          <line style="stroke:var(--line)" x1="20" y1="180" x2="340" y2="180"/><line style="stroke:var(--line)" x1="180" y1="20" x2="180" y2="340"/>
          <g class="rd-sweep"><path d="M180 180 L340 180 A160 160 0 0 0 293 67 Z" fill="url(#beam)"/></g>
          ${dots.map((p, i) => `<g class="rd-dot" data-i="${i}" tabindex="0" role="button" aria-label="${esc(p.d.holder)}, ${esc(p.d.docType.replace(/_/g, ' '))}, ${p.d.daysLeft} days"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="10" fill="${col(p.d.daysLeft)}" fill-opacity=".18"/><circle style="stroke:var(--surface)" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5" fill="${col(p.d.daysLeft)}" stroke-width="2"/></g>`).join('')}
          <circle style="fill:var(--accent)" cx="180" cy="180" r="4"/>
        </svg>
        <div id="rdSel" style="flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:10px"></div>
      </div>
      <div class="panel"><h2>Next 12 weeks</h2><div id="wkCap" style="font-size:13px;color:var(--muted);min-height:40px"></div>
        <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:10px">
          ${week.map((w, i) => `<button class="wk" data-w="${i}" aria-label="Week ${i + 1}: ${w.length} documents" style="all:unset;cursor:pointer;display:flex;flex-direction:column;gap:4px"><span style="height:52px;border-radius:4px;display:grid;place-items:center;font-family:var(--f-mono);font-size:15px;font-weight:600;background:${['var(--surface-2)', '#ffd9c7', '#ff9a6b', 'var(--accent)'][Math.min(3, w.length)]};color:${w.length >= 2 ? '#fff' : 'var(--ink)'};border:1px solid transparent">${w.length}</span><span style="font-size:11px;color:var(--muted);text-align:center">W${i + 1}</span></button>`).join('')}
        </div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:16px">
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--bad);margin-inline-end:6px"></span>≤ 14 days</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--warn);margin-inline-end:6px"></span>15–30 days</span>
          <span><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ok);margin-inline-end:6px"></span>30+ days</span></div></div>
    </div>
    <div class="panel tw" style="margin-top:16px"><table><thead><tr><th>Holder</th><th>Document</th><th>Expiry</th><th>Expires in</th><th>Renewal</th></tr></thead><tbody>
    ${docs.map((d) => `<tr><td>${esc(d.holder)}</td><td>${esc(d.docType.replace(/_/g, ' '))}</td><td class="mono">${fmtDate(d.expiryDate)}</td><td>${pill(d.daysLeft < 0 ? 'p-bad' : d.daysLeft <= 14 ? 'p-bad' : d.daysLeft <= 30 ? 'p-warn' : 'p-ok', d.daysLeft < 0 ? `${-d.daysLeft} days overdue` : `${d.daysLeft} days`)}</td>
      <td>${d.renewalCase?.status && d.renewalCase.status !== 'none' ? pill('p-ok', `Case ${d.renewalCase.status}`) : has('hr_admin') ? `<button class="btn sm" data-case="${d._id}">Open case</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">No documents expiring in 120 days.</td></tr>`}
    </tbody></table></div>`);
    const openCase = async (id) => { try { const c = await api(`/documents/${id}/renewal`, { method: 'POST' }); toast(`Case opened: ${c.steps.map((s) => s.name).join(' → ')}`); views.docs(); } catch (e) { fail(e); } };
    const select = (i) => {
      const d = dots[i]?.d; if (!d) { $('#rdSel').innerHTML = '<div class="empty">Nothing due.</div>'; return; }
      const done = d.renewalCase?.status && d.renewalCase.status !== 'none';
      $('#rdSel').innerHTML = `<div class="lbl">Selected</div><div style="font-family:var(--f-display);font-size:24px;font-weight:600;letter-spacing:-.02em;line-height:1.1">${esc(d.holder)}</div>
        <div style="color:var(--soft)">${esc(d.docType.replace(/_/g, ' '))}</div>
        <div class="big" style="color:${col(d.daysLeft)}">${d.daysLeft < 0 ? -d.daysLeft : d.daysLeft}<span style="font-size:16px;color:var(--muted);font-weight:500"> days ${d.daysLeft < 0 ? 'overdue' : 'left'}</span></div>
        <div style="font-size:13px;color:var(--muted)">Next step: ${esc(nextStep[d.docType] || 'Collect new copy')}</div>
        ${done ? pill('p-ok', `Case ${d.renewalCase.status}`) : has('hr_admin') ? `<button class="btn pri" id="rdCase" style="align-self:flex-start">Open renewal case</button>` : ''}`;
      const b = $('#rdCase'); if (b) b.onclick = () => openCase(d._id);
      document.querySelectorAll('.rd-dot').forEach((g) => g.querySelectorAll('circle')[0].setAttribute('r', +g.dataset.i === i ? 15 : 10));
    };
    document.querySelectorAll('.rd-dot').forEach((g) => { g.onclick = () => select(+g.dataset.i); g.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(+g.dataset.i); } }; });
    const showWeek = (i) => {
      const w = week[i];
      $('#wkCap').textContent = `Week ${i + 1}: ${w.length ? w.map((d) => `${d.holder} (${d.docType.replace(/_/g, ' ')})`).join(', ') : 'nothing due'}`;
      document.querySelectorAll('.wk span:first-child').forEach((s, j) => (s.style.borderColor = j === i ? 'var(--accent)' : 'transparent'));
    };
    document.querySelectorAll('.wk').forEach((b) => { b.onmouseenter = b.onfocus = b.onclick = () => showWeek(+b.dataset.w); });
    document.querySelectorAll('[data-case]').forEach((b) => (b.onclick = () => openCase(b.dataset.case)));
    select(dots.findIndex((p) => p.d.daysLeft >= 0) >= 0 ? dots.findIndex((p) => p.d.daysLeft >= 0) : 0); showWeek(0);
  },
  async eosb() {
    const list = await api('/employees?status=active');
    V(`<h1>${t('eosb')}</h1><p class="sub">Calculated on the server from the versioned rule pack, with every step shown.</p>
    <div class="grid g2"><div class="panel"><div class="form">
      <div class="field" style="grid-column:1/-1"><label class="lbl" for="eE">Employee</label><select id="eE">${list.map((e) => `<option value="${e._id}">${esc(e.fullName)} · joined ${fmtDate(e.joinDate)}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="eD">Last working day</label><input id="eD" type="date" value="${new Date(Date.now() + 12 * 864e5).toISOString().slice(0, 10)}"></div>
      <div class="field"><label class="lbl" for="eU">Unpaid leave days</label><input id="eU" type="number" min="0" value="0"></div>
      <div class="field"><label class="lbl" for="eS">Scheme</label><select id="eS"><option value="">Mainland (Art. 51)</option><option value="DEWS">DEWS / savings scheme</option></select></div>
    </div></div><div class="panel" id="eO"><div class="loading">Calculating…</div></div></div>`);
    const calc = async () => {
      try {
        const r = await api('/compliance/gratuity', { method: 'POST', body: { employeeId: $('#eE').value, lastWorkingDate: $('#eD').value, unpaidLeaveDays: Number($('#eU').value) || 0, scheme: $('#eS').value || undefined } });
        $('#eO').innerHTML = `<div class="lbl">Gratuity payable</div><div class="big num">AED ${AED(r.amountFils)}</div><div class="trace" style="margin-top:12px">${r.trace.map(esc).join('<br>')}</div>`;
      } catch (e) { $('#eO').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    };
    const anil = list.find((e) => e.fullName === 'Anil Kumar'); if (anil) $('#eE').value = anil._id;
    ['#eE', '#eD', '#eU', '#eS'].forEach((s) => $(s).addEventListener('change', calc));
    calc();
  },

  async leave() {
    const list = await api('/leave');
    V(`<h1>${t('leave')}</h1><p class="sub">Requests from the web, app, WhatsApp or the AI agent, with team overlap checks.</p>
    <div class="panel"><div class="list">
      ${list.map((l) => `<div class="row"><span class="av">${esc(ini(l.employeeId?.fullName || '?'))}</span><div class="grow"><b style="font-weight:500">${esc(l.employeeId?.fullName)}</b> · ${esc(l.type)} · <span class="mono">${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}</span> (${l.days}d)
        <div style="font-size:12px;color:var(--${l.overlaps?.length ? 'warn' : 'muted'})">${l.overlaps?.length ? `Overlaps ${esc(l.overlaps.join(', '))} in ${esc(l.employeeId?.department)}` : `Source: ${esc(l.source)}`}</div></div>
        ${l.status === 'pending' && has('hr_admin', 'manager') ? `<button class="btn sm" data-d="${l._id}" data-v="rejected">Reject</button><button class="btn sm pri" data-d="${l._id}" data-v="approved">Approve</button>` : pill(l.status === 'approved' ? 'p-ok' : l.status === 'rejected' ? 'p-bad' : 'p-n', l.status)}</div>`).join('') || '<div class="empty">No leave requests.</div>'}
    </div></div>`);
    document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => { try { await api(`/leave/${b.dataset.d}/decision`, { method: 'POST', body: { decision: b.dataset.v } }); toast(`Leave ${b.dataset.v}`); views.leave(); } catch (e) { fail(e); } }));
  },

  async audit() {
    const list = await api('/audit');
    V(`<h1>${t('audit')}</h1><p class="sub">Append-only record of every change, approval, export and AI action.</p>
    <div class="panel tw"><table><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Correlation</th></tr></thead><tbody>
    ${list.map((a) => `<tr><td class="mono">${new Date(a.createdAt).toLocaleString('en-AE')}</td><td>${pill(a.actorType === 'agent' ? 'p-g' : 'p-n', a.actorType)}</td><td class="mono">${esc(a.action)}</td><td>${esc(a.entity)}</td><td class="mono" style="font-size:11px">${esc((a.correlationId || '').slice(0, 8))}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No events yet.</td></tr>'}
    </tbody></table></div>`);
  },
};


// ================= Phase 1 screens: request centre, setup, employee workspace, uploads, settlements =================
const LETTER_LABEL = { salary_certificate: 'Salary certificate', bank_transfer: 'Salary transfer letter', noc: 'No objection certificate', experience: 'Experience certificate' };
const KIND_LABEL = { letter: 'Letter', bank_change: 'Bank details change', personal_data: 'Personal data change', salary_query: 'Salary query', document_renewal: 'Document renewal', it_facilities: 'IT / facilities', other: 'Other' };
const DOC_LABEL = { passport: 'Passport', residence_visa: 'Residence visa', emirates_id: 'Emirates ID', labour_card: 'Labour card', driving_licence: 'Driving licence', health_insurance: 'Health insurance', trade_licence: 'Trade licence', establishment_card: 'Establishment card' };
const after = (html) => { const v = $('#view'); const div = document.createElement('div'); div.innerHTML = html; v.appendChild(div); translateTree(div, L); return div; };
const empOptions = (list) => list.map((e) => `<option value="${e._id}">${esc(e.fullName)} · ${esc(e.employeeNo)}</option>`).join('');
const statusPill = (s) => pill(s === 'done' || s === 'approved' ? 'p-ok' : s === 'rejected' ? 'p-bad' : s === 'in_progress' || s === 'pending' ? 'p-warn' : 'p-n', s.replace('_', ' '));

Object.assign(views, {
  // ---------- Request centre (HR) ----------
  async requests() {
    const [list, emps] = await Promise.all([api('/requests'), api('/employees?status=active')]);
    const open = list.filter((x) => ['open', 'in_progress'].includes(x.status));
    V(`<div class="eyebrow">${open.length} OPEN · SLA TRACKED</div><h1>Request <em>centre</em></h1>
    <p class="sub">Letters, bank changes and salary queries from employees. Approving a letter issues it with a reference number and digital stamp; approving a bank change updates the IBAN.</p>
    <div class="grid g3"><div class="panel span2"><div class="list">
      ${list.length ? list.map((x) => `<div class="row"><span class="av">${esc(ini(x.employeeId?.fullName || '?'))}</span><div class="grow"><b style="font-weight:600">${esc(x.employeeId?.fullName || '')}</b> · ${esc(KIND_LABEL[x.kind] || x.kind)}${x.letterType ? ` · ${esc(LETTER_LABEL[x.letterType])}` : ''}
        <div style="font-size:12px;color:var(--muted)">${esc(x.reference || '')}${x.addressee ? ` · to ${esc(x.addressee)}` : ''}${x.details ? ` · ${esc(x.details)}` : ''}${x.slaDueAt && ['open', 'in_progress'].includes(x.status) ? ` · due ${fmtDate(x.slaDueAt)}${new Date(x.slaDueAt) < new Date() ? ' (overdue)' : ''}` : ''}</div></div>
        ${statusPill(x.status)}
        ${['open', 'in_progress'].includes(x.status) ? `${x.status === 'open' ? `<button class="btn sm" data-d="${x._id}" data-v="in_progress">In progress</button>` : ''}<button class="btn sm" data-d="${x._id}" data-v="rejected">Reject</button><button class="btn sm pri" data-d="${x._id}" data-v="done">${x.kind === 'letter' ? 'Issue letter' : 'Mark done'}</button>` : ''}
        ${x.kind === 'letter' && x.status === 'done' ? `<button class="btn sm" data-letter='${esc(JSON.stringify({ employeeId: x.employeeId?._id, type: x.letterType, addressee: x.addressee, purpose: x.purpose, lang: x.lang }))}'>Open letter</button>` : ''}</div>`).join('') : '<div class="empty">No requests yet.</div>'}
    </div></div>
    <div class="panel"><h2>Issue letter</h2><form id="ltrForm" style="display:flex;flex-direction:column;gap:12px">
      <div class="field"><label class="lbl" for="lEmp">Employee</label><select id="lEmp">${empOptions(emps)}</select></div>
      <div class="field"><label class="lbl" for="lType">Letter</label><select id="lType">${Object.entries(LETTER_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="lTo">Addressed to</label><input id="lTo" placeholder="e.g. Emirates NBD" value="To whom it may concern"></div>
      <div class="field"><label class="lbl" for="lPurpose">Purpose (NOC only)</label><input id="lPurpose" placeholder="e.g. travelling to India"></div>
      <div class="field"><label class="lbl" for="lLang">Language</label><select id="lLang"><option value="dual">English + Arabic</option><option value="en">English</option><option value="ar">Arabic</option></select></div>
      <button class="btn pri" type="submit">Issue letter</button></form></div></div>`);
    document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = async () => {
      try {
        const x = list.find((y) => y._id === b.dataset.d);
        await api(`/requests/${b.dataset.d}/decision`, { method: 'POST', body: { decision: b.dataset.v } });
        toast(`Request ${b.dataset.v.replace('_', ' ')}`);
        if (b.dataset.v === 'done' && x.kind === 'letter') openHtml('/letters', { method: 'POST', body: { employeeId: x.employeeId._id, type: x.letterType, addressee: x.addressee, purpose: x.purpose, lang: x.lang } });
        views.requests();
      } catch (e) { fail(e); }
    }));
    document.querySelectorAll('[data-letter]').forEach((b) => (b.onclick = () => openHtml('/letters', { method: 'POST', body: JSON.parse(b.dataset.letter) })));
    $('#ltrForm').onsubmit = (e) => { e.preventDefault(); openHtml('/letters', { method: 'POST', body: { employeeId: $('#lEmp').value, type: $('#lType').value, addressee: $('#lTo').value || undefined, purpose: $('#lPurpose').value || undefined, lang: $('#lLang').value } }); };
  },

  // ---------- Setup: go-live checklist, CSV import, settings, rule registry ----------
  async setup() {
    const [ck, rules, settings, ests] = await Promise.all([api('/setup/checklist'), api('/rules'), api('/settings'), api('/establishments')]);
    V(`<div class="eyebrow">${ck.done} OF ${ck.total} READY</div><h1>Go-live <em>setup</em></h1>
    <p class="sub">Everything a new company needs before its first real payroll. Automatic checks update themselves; tick the manual ones when done.</p>
    <div class="meter" style="margin-bottom:18px"><i style="width:${(ck.done / ck.total) * 100}%"></i></div>
    <div class="grid g2"><div class="panel"><h2>Go-live checklist</h2>
      ${ck.items.map((i) => `<div class="chk"><span class="ic ${i.ok ? 'ok' : 'warn'}">${i.ok ? '✓' : '!'}</span><div style="flex:1;min-width:0"><div>${esc(i.label)}</div>${i.detail ? `<div style="font-size:12px;color:var(--muted)">${esc(i.detail)}</div>` : ''}</div>
        ${i.manual ? `<label style="display:flex;gap:6px;align-items:center;font-size:13px;white-space:nowrap"><input type="checkbox" data-ck="${i.id}" ${i.ok ? 'checked' : ''} style="accent-color:var(--accent);width:18px;height:18px"> Done</label>` : ''}</div>`).join('')}</div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div class="panel"><h2>Import employees</h2><p style="margin:0 0 12px;color:var(--muted);font-size:14px">Upload a CSV. Every row is validated (IBAN checksum, 14-digit labour card, dates, duplicates) before anything is saved.</p>
        <div class="form"><div class="field"><label class="lbl" for="impEst">Establishment</label><select id="impEst">${ests.map((e) => `<option value="${e._id}">${esc(e.name)}</option>`).join('')}</select></div>
        <div class="field"><label class="lbl" for="impFile">CSV file</label><input id="impFile" type="file" accept=".csv,text/csv"></div></div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" id="impTpl">Download template</button><button class="btn" id="impCheck">Check file</button><button class="btn pri" id="impGo" disabled>Import</button></div>
        <div id="impOut" style="margin-top:12px"></div></div>
      <div class="panel"><h2>Settings</h2><div class="field"><label class="lbl" for="capBasis">Gratuity cap basis</label><select id="capBasis"><option value="total" ${settings.gratuityCapBasis !== 'basic' ? 'selected' : ''}>Total remuneration (PRD default)</option><option value="basic" ${settings.gratuityCapBasis === 'basic' ? 'selected' : ''}>Basic salary</option></select></div>
        <p class="note">Gratuity is capped at 24 months of wage. Confirm the basis with UAE employment counsel.</p></div>
    </div></div>
    <div class="panel tw" style="margin-top:16px"><h2>Rule packs</h2><table><thead><tr><th>Profile</th><th>Version</th><th>Effective</th><th>Status</th><th>Gratuity</th><th>Annual leave</th><th>Emiratisation</th><th>Source</th></tr></thead><tbody>
      ${rules.map((p) => `<tr><td><b style="font-weight:600">${esc(p.id)}</b></td><td class="mono">${esc(p.version)}</td><td class="mono">${esc(p.effectiveFrom)}${p.effectiveTo ? ` → ${esc(p.effectiveTo)}` : ''}</td><td>${pill(p.status === 'approved' ? 'p-ok' : 'p-warn', p.status)}</td>
        <td>${p.gratuity?.basis === 'dews' ? 'DEWS fund' : `${p.gratuity?.daysPerYearFirst5}/${p.gratuity?.daysPerYearAfter5} days, cap ${p.gratuity?.capMonthsOfWage}m ${p.gratuity?.capBasis || 'basic'}`}</td><td>${p.leave ? `${p.leave.annualDays} ${p.leave.annualDaysUnit || 'calendar'} days` : '—'}</td><td>${p.emiratisation ? 'MOHRE quota' : 'Not applied'}</td>
        <td style="font-size:12px;color:var(--muted);max-width:280px">${esc(p.source)}${(p.sourceUrls || []).map((u) => ` <a href="${esc(u)}" target="_blank" rel="noopener">link</a>`).join('')}</td></tr>`).join('')}</tbody></table></div>`);
    document.querySelectorAll('[data-ck]').forEach((c) => (c.onchange = async () => { try { await api('/setup/checklist', { method: 'PATCH', body: { id: c.dataset.ck, ok: c.checked } }); views.setup(); } catch (e) { fail(e); } }));
    $('#capBasis').onchange = async () => { try { await api('/settings', { method: 'PATCH', body: { gratuityCapBasis: $('#capBasis').value } }); toast('Saved'); } catch (e) { fail(e); } };
    $('#impTpl').onclick = async () => { try { const res = await fetch(`${API}/import/template`, { headers: { Authorization: `Bearer ${token}` } }); const a = document.createElement('a'); a.href = URL.createObjectURL(await res.blob()); a.download = 'wasl-employee-template.csv'; a.click(); } catch (e) { fail(e); } };
    let csv = '';
    const run = async (dryRun) => {
      const f = $('#impFile').files[0]; if (!f) return toast('Choose a CSV file first');
      csv = await f.text();
      try {
        const r2 = await api('/import/employees', { method: 'POST', body: { csv, establishmentId: $('#impEst').value, dryRun } });
        $('#impOut').innerHTML = r2.dryRun
          ? `<div>${pill(r2.errors.length ? 'p-bad' : 'p-ok', r2.errors.length ? `${r2.errors.length} problem(s)` : `${r2.toCreate} ready to import`)}</div>
             ${r2.errors.length ? `<div class="tw" style="margin-top:8px"><table><thead><tr><th>Row</th><th>Field</th><th>Problem</th></tr></thead><tbody>${r2.errors.slice(0, 50).map((x) => `<tr><td class="mono">${x.row}</td><td>${esc(x.field)}</td><td>${esc(x.msg)}</td></tr>`).join('')}</tbody></table></div>` : `<div style="font-size:13px;color:var(--muted);margin-top:8px">${r2.preview.map((p) => `${esc(p.employeeNo)} ${esc(p.fullName)}`).join(' · ')}${r2.toCreate > 5 ? ' …' : ''}</div>`}`
          : `${pill('p-ok', `Imported ${r2.created} employees`)}`;
        $('#impGo').disabled = !(r2.dryRun && !r2.errors.length && r2.toCreate);
        if (!r2.dryRun) toast(`Imported ${r2.created} employees`);
      } catch (e) { fail(e); }
    };
    $('#impCheck').onclick = () => run(true); $('#impGo').onclick = () => run(false);
  },

  // ---------- Employee workspace (self-service) ----------
  async me() {
    const tab = localStorage.getItem('wasl_metab') || 'overview';
    const [p, bal] = await Promise.all([api('/me/profile'), api('/me/balances')]);
    V(`<div class="eyebrow">${esc(p.establishment?.name || '')}</div><h1>Hello, <em>${esc(p.fullName.split(' ')[0])}</em></h1>
    <div class="tabs" role="tablist">${[['overview', 'Overview'], ['payslips', 'Payslips'], ['leave', 'Leave'], ['docs', 'My documents'], ['req', 'My requests']].map(([k, v]) => `<button role="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="meBody"></div>`);
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { localStorage.setItem('wasl_metab', b.dataset.tab); views.me(); }));
    const body = $('#meBody');
    const put = (html) => { body.innerHTML = html; translateTree(body, L); };
    if (tab === 'overview') {
      put(`<div class="grid g4">
        <div class="panel stat"><div class="v">${bal.annual.remaining}</div><span class="lbl">Annual leave remaining</span><div class="d">of ${bal.annual.entitlement} · ${esc(bal.annual.basis)}</div></div>
        <div class="panel stat"><div class="v">${bal.sick.fullPayLeft}</div><span class="lbl">Full-pay sick days left</span><div class="d">${bal.sick.taken} taken this year</div></div>
        <div class="panel stat"><div class="v num" style="font-size:40px">${esc(p.employeeNo)}</div><span class="lbl">Employee number</span><div class="d">${esc(p.jobTitle || '')}</div></div>
        <div class="panel stat"><div class="v num" style="font-size:40px">${fmtDate(p.joinDate).slice(0, 4)}</div><span class="lbl">Joined</span><div class="d">${fmtDate(p.joinDate)}</div></div></div>
        <div class="panel" style="margin-top:16px"><h2>My details</h2><table><tbody>
          <tr><td style="color:var(--muted)">Department</td><td>${esc(p.department || '')}</td></tr><tr><td style="color:var(--muted)">Nationality</td><td>${esc(p.nationality || '')}</td></tr>
          <tr><td style="color:var(--muted)">Bank</td><td>${esc(p.bank?.bankName || '')} ${esc(p.bank?.ibanMasked || '')}</td></tr><tr><td style="color:var(--muted)">Contract</td><td>${esc(p.contractType || '')}</td></tr></tbody></table>
          <p class="note">To change your bank or personal details, send a request from My requests.</p></div>`);
    } else if (tab === 'payslips') {
      const list = await api('/me/payslips');
      put(`<div class="panel"><h2>Payslips</h2>${list.length ? `<table><thead><tr><th>Period</th><th>Type</th><th class="r">Net</th><th></th></tr></thead><tbody>${list.map((x) => `<tr><td class="mono">${esc(x.period)}</td><td>${esc(x.type || 'regular')}</td><td class="r num">AED ${AED(x.netFils)}</td><td><button class="btn sm" data-ps="${x.runId}">View</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No payslips released yet.</div>'}</div>`);
      body.querySelectorAll('[data-ps]').forEach((b) => (b.onclick = () => openHtml(`/me/payslips/${b.dataset.ps}`)));
    } else if (tab === 'leave') {
      const list = await api('/me/leave');
      put(`<div class="grid g2"><div class="panel"><h2>Request leave</h2><form id="lvForm" class="form">
        <div class="field" style="grid-column:1/-1"><label class="lbl" for="lvType">Leave type</label><select id="lvType">${['annual', 'sick', 'parental', 'maternity', 'hajj', 'unpaid'].map((x) => `<option value="${x}">${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></div>
        <div class="field"><label class="lbl" for="lvS">Start date</label><input id="lvS" type="date" required></div><div class="field"><label class="lbl" for="lvE">End date</label><input id="lvE" type="date" required></div>
        <div class="field" id="lvBirthWrap" hidden style="grid-column:1/-1"><label class="lbl" for="lvBirth">Child's date of birth</label><input id="lvBirth" type="date"></div>
        <div class="field" style="grid-column:1/-1"><label class="lbl" for="lvR">Reason</label><input id="lvR"></div>
        <div id="lvPrev" style="grid-column:1/-1"></div>
        <div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn" type="button" id="lvCheck">Check policy</button><button class="btn pri" type="submit">Submit</button></div></form></div>
        <div class="panel"><h2>My leave</h2>${list.length ? `<div class="list">${list.map((x) => `<div class="row"><div class="grow">${esc(x.type)} · <span class="mono">${fmtDate(x.startDate)} → ${fmtDate(x.endDate)}</span> (${x.days}d)${x.unpaidDays ? `<div style="font-size:12px;color:var(--warn)">${x.unpaidDays} unpaid day(s)</div>` : ''}</div>${statusPill(x.status)}</div>`).join('')}</div>` : '<div class="empty">No leave yet.</div>'}</div></div>`);
      const bodyOf = () => ({ type: $('#lvType').value, startDate: $('#lvS').value, endDate: $('#lvE').value, reason: $('#lvR').value || undefined, childBirthDate: $('#lvBirth').value || undefined });
      $('#lvType').onchange = () => { $('#lvBirthWrap').hidden = $('#lvType').value !== 'parental'; };
      $('#lvCheck').onclick = async () => { try { const ev = await api('/leave', { method: 'POST', body: { ...bodyOf(), preview: true } }); showLeavePreview($('#lvPrev'), ev); } catch (e) { fail(e); } };
      $('#lvForm').onsubmit = async (e) => { e.preventDefault(); try { const r2 = await api('/leave', { method: 'POST', body: bodyOf() }); toast(`Leave requested${r2.warnings?.length ? `: ${r2.warnings[0]}` : ''}`); views.me(); } catch (err) { fail(err); } };
    } else if (tab === 'docs') {
      const list = await api('/me/documents');
      put(`<div class="panel"><h2>My documents</h2>${list.length ? `<table><thead><tr><th>Document</th><th>Expiry</th><th>Expires in</th><th></th></tr></thead><tbody>${list.map((d) => `<tr><td>${esc(DOC_LABEL[d.docType] || d.docType)}</td><td class="mono">${fmtDate(d.expiryDate)}</td><td>${pill(d.daysLeft <= 14 ? 'p-bad' : d.daysLeft <= 30 ? 'p-warn' : 'p-ok', d.daysLeft < 0 ? `${-d.daysLeft} days overdue` : `${d.daysLeft} days`)}</td><td>${d.hasFile ? `<button class="btn sm" data-f="${d._id}">View</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No documents on file.</div>'}</div>`);
      body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => openFile(`/me/documents/${b.dataset.f}/file`)));
    } else {
      const list = await api('/me/requests');
      put(`<div class="grid g2"><div class="panel"><h2>New request</h2><form id="rqForm" style="display:flex;flex-direction:column;gap:12px">
        <div class="field"><label class="lbl" for="rqKind">Request type</label><select id="rqKind">${Object.entries(KIND_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        <div id="rqLetter" style="display:flex;flex-direction:column;gap:12px"><div class="field"><label class="lbl" for="rqLt">Letter</label><select id="rqLt">${Object.entries(LETTER_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl" for="rqTo">Addressed to</label><input id="rqTo" placeholder="e.g. Emirates NBD"></div>
          <div class="field"><label class="lbl" for="rqLang">Language</label><select id="rqLang"><option value="dual">English + Arabic</option><option value="en">English</option><option value="ar">Arabic</option></select></div></div>
        <div class="field" id="rqIbanWrap" hidden><label class="lbl" for="rqIban">New IBAN</label><input id="rqIban" placeholder="AE.. (23 characters)"></div>
        <div class="field"><label class="lbl" for="rqDet">Details</label><textarea id="rqDet"></textarea></div>
        <button class="btn pri" type="submit">Send request</button></form></div>
        <div class="panel"><h2>My requests</h2>${list.length ? `<div class="list">${list.map((x) => `<div class="row"><div class="grow">${esc(KIND_LABEL[x.kind])}${x.letterType ? ` · ${esc(LETTER_LABEL[x.letterType])}` : ''}<div style="font-size:12px;color:var(--muted)">${esc(x.reference || '')} · ${fmtDate(x.createdAt)}</div></div>${statusPill(x.status)}${x.kind === 'letter' && x.status === 'done' ? `<button class="btn sm" data-lt="${x._id}">Open letter</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">No requests yet.</div>'}</div></div>`);
      const sync = () => { const k = $('#rqKind').value; $('#rqLetter').hidden = k !== 'letter'; $('#rqIbanWrap').hidden = k !== 'bank_change'; };
      $('#rqKind').onchange = sync; sync();
      body.querySelectorAll('[data-lt]').forEach((b) => (b.onclick = () => openHtml(`/me/letters/${b.dataset.lt}`)));
      $('#rqForm').onsubmit = async (e) => { e.preventDefault(); const k = $('#rqKind').value; try { await api('/me/requests', { method: 'POST', body: { kind: k, details: $('#rqDet').value || undefined, ...(k === 'letter' ? { letterType: $('#rqLt').value, addressee: $('#rqTo').value || undefined, lang: $('#rqLang').value } : {}), ...(k === 'bank_change' ? { iban: $('#rqIban').value } : {}) } }); toast('Request sent to HR'); views.me(); } catch (err) { fail(err); } };
    }
  },
});

function showLeavePreview(el, ev) {
  el.innerHTML = `<div class="panel" style="padding:14px;background:var(--surface-2)">${ev.errors?.length ? `<div class="err">${ev.errors.map(esc).join('<br>')}</div>` : pill('p-ok', 'Allowed by policy')}
    ${ev.warnings?.length ? `<div style="color:var(--warn);font-size:13px;margin-top:6px">${ev.warnings.map(esc).join('<br>')}</div>` : ''}
    <div class="trace" style="margin-top:8px">${ev.days} day(s): <b>${ev.split?.fullDays ?? 0}</b> full pay · <b>${ev.split?.halfDays ?? 0}</b> half pay · <b>${ev.split?.unpaidDays ?? 0}</b> unpaid<br>Annual balance <b>${ev.balances?.annual?.remaining ?? '—'}</b> of ${ev.balances?.annual?.entitlement ?? '—'} · sick days taken <b>${ev.balances?.sick?.taken ?? 0}</b></div></div>`;
  translateTree(el, L);
}

// ---------- Enhancements to existing screens ----------
const baseDocs = views.docs, baseEosb = views.eosb, baseLeave = views.leave;
views.docs = async () => {
  await baseDocs();
  if (!has('hr_admin')) return;
  const [emps, ests] = await Promise.all([api('/employees?status=active'), api('/establishments')]);
  const box = document.createElement('div');
  box.className = 'panel'; box.style.marginBottom = '16px';
  box.innerHTML = `<details><summary style="cursor:pointer;font-family:var(--f-display);font-weight:600;font-size:16px">Upload document</summary>
    <form id="upForm" class="form" style="margin-top:14px">
      <div class="field"><label class="lbl" for="upOwner">Holder</label><select id="upOwner"><optgroup label="Employees">${emps.map((e) => `<option value="employee:${e._id}">${esc(e.fullName)}</option>`).join('')}</optgroup><optgroup label="Company">${ests.map((e) => `<option value="establishment:${e._id}">${esc(e.name)}</option>`).join('')}</optgroup></select></div>
      <div class="field"><label class="lbl" for="upFile">File</label><input id="upFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div>
      <div class="field"><label class="lbl" for="upType">Document type</label><select id="upType">${Object.entries(DOC_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="upNo">Document number</label><input id="upNo"></div>
      <div class="field"><label class="lbl" for="upIssue">Issue date</label><input id="upIssue" type="date"></div>
      <div class="field"><label class="lbl" for="upExp">Expiry date</label><input id="upExp" type="date" required></div>
      <div id="upMsg" style="grid-column:1/-1;font-size:13px;color:var(--muted)">PDF, JPG, PNG or WEBP up to 8 MB. "Read with AI" fills the fields for you to check.</div>
      <div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn" type="button" id="upOcr">Read with AI</button><button class="btn pri" type="submit">Save document</button></div></form></details>`;
  $('#view').insertBefore(box, $('#view').children[3] || null);
  translateTree(box, L);
  const fileData = async () => { const f = $('#upFile').files[0]; if (!f) return null; if (f.size > 8 * 1024 * 1024) throw new Error('That file is larger than 8 MB.'); return { fileBase64: await fileToBase64(f), contentType: f.type, fileName: f.name }; };
  $('#upOcr').onclick = async () => {
    try {
      const fd = await fileData(); if (!fd) return toast('Choose a file first');
      $('#upMsg').textContent = 'Reading the document…';
      const r2 = await api('/documents/ocr', { method: 'POST', body: fd });
      if (!r2.available) { $('#upMsg').textContent = r2.message; return; }
      const f = r2.fields || {};
      if (f.docType) $('#upType').value = f.docType; if (f.number) $('#upNo').value = f.number; if (f.issueDate) $('#upIssue').value = f.issueDate; if (f.expiryDate) $('#upExp').value = f.expiryDate;
      $('#upMsg').textContent = `Filled from the document${f.holderName ? ` (${f.holderName})` : ''}, confidence ${Math.round((f.confidence || 0) * 100)}%. Check every field before saving.`;
    } catch (e) { $('#upMsg').textContent = ''; fail(e); }
  };
  $('#upForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const [ownerType, id] = $('#upOwner').value.split(':');
      const fd = await fileData();
      await api('/documents', { method: 'POST', body: { ownerType, [ownerType === 'employee' ? 'employeeId' : 'establishmentId']: id, docType: $('#upType').value, number: $('#upNo').value || undefined, issueDate: $('#upIssue').value || undefined, expiryDate: $('#upExp').value, ...(fd || {}) } });
      toast('Document saved'); views.docs();
    } catch (err) { fail(err); }
  };
  // file links in the table
  const docs = await api('/documents/expiring?days=120');
  document.querySelectorAll('#view table tbody tr').forEach((tr, i) => { const d = docs[i]; if (d?.storageKey) { const td = tr.lastElementChild; td.insertAdjacentHTML('beforeend', ` <button class="btn sm" data-file="${d._id}">File</button>`); } });
  document.querySelectorAll('[data-file]').forEach((b) => (b.onclick = () => openFile(`/documents/${b.dataset.file}/file`)));
};

views.eosb = async () => {
  await baseEosb();
  if (!has('hr_admin', 'payroll_maker')) return;
  after(`<div class="panel" style="margin-top:16px"><h2>Final settlement</h2><p style="margin:0 0 12px;color:var(--muted);font-size:14px">Uses the employee and last working day selected above. Adds pro-rata salary, unused annual leave, gratuity and notice pay, minus loans; creates a draft run for maker-checker approval and WPS export.</p>
    <div class="form"><div class="field"><label class="lbl" for="fsNotice">Notice pay in lieu (days)</label><input id="fsNotice" type="number" min="0" max="90" value="0"></div>
      <div class="field"><label class="lbl" for="fsLoan">Outstanding loan (AED)</label><input id="fsLoan" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label class="lbl" for="fsOther">Other deductions (AED)</label><input id="fsOther" type="number" min="0" step="0.01" value="0"></div>
      <div class="field"><label class="lbl" for="fsReason">Reason</label><input id="fsReason" placeholder="Resignation, end of contract…"></div></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn" id="fsPrev">Preview</button><button class="btn pri" id="fsGo" disabled>Create final settlement</button></div><div id="fsOut" style="margin-top:12px"></div></div>`);
  const body = () => ({ employeeId: $('#eE').value, lastWorkingDate: $('#eD').value, noticePayDays: Number($('#fsNotice').value) || 0, outstandingLoan: $('#fsLoan').value || 0, otherDeductions: $('#fsOther').value || 0, reason: $('#fsReason').value || undefined });
  $('#fsPrev').onclick = async () => {
    try {
      const s2 = await api('/payroll/settlements/preview', { method: 'POST', body: body() });
      const c = s2.components;
      $('#fsOut').innerHTML = `<div class="grid g2"><table><tbody>
        <tr><td>Pro-rata salary</td><td class="r num">${AED(c.proRataSalaryFils)}</td></tr><tr><td>Leave encashment (${s2.unusedLeaveDays} days)</td><td class="r num">${AED(c.leaveEncashmentFils)}</td></tr>
        <tr><td>Gratuity</td><td class="r num">${AED(c.gratuityFils)}</td></tr><tr><td>Notice pay</td><td class="r num">${AED(c.noticePayFils)}</td></tr>
        <tr><td>Deductions</td><td class="r num">−${AED(s2.deductionsFils)}</td></tr><tr><td><b>Net settlement</b></td><td class="r num"><b style="color:var(--accent)">AED ${AED(s2.netFils)}</b></td></tr></tbody></table>
        <div class="trace" style="font-size:12.5px">${s2.trace.map(esc).join('<br>')}</div></div>`;
      $('#fsGo').disabled = false;
    } catch (e) { fail(e); }
  };
  $('#fsGo').onclick = async () => { try { await api('/payroll/settlements', { method: 'POST', body: body() }); toast('Final settlement created as a draft run. Submit it from Payroll & WPS.'); $('#fsGo').disabled = true; } catch (e) { fail(e); } };
};

views.leave = async () => {
  await baseLeave();
  if (!has('hr_admin', 'manager')) return;
  const emps = await api('/employees?status=active');
  after(`<div class="panel" style="margin-top:16px"><h2>Request leave</h2><form id="hlForm" class="form">
    <div class="field"><label class="lbl" for="hlEmp">Employee</label><select id="hlEmp">${empOptions(emps)}</select></div>
    <div class="field"><label class="lbl" for="hlType">Leave type</label><select id="hlType">${['annual', 'sick', 'parental', 'maternity', 'hajj', 'unpaid'].map((x) => `<option value="${x}">${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="hlS">Start date</label><input id="hlS" type="date" required></div><div class="field"><label class="lbl" for="hlE">End date</label><input id="hlE" type="date" required></div>
    <div class="field" id="hlBirthWrap" hidden><label class="lbl" for="hlBirth">Child's date of birth</label><input id="hlBirth" type="date"></div>
    <div class="field"><label class="lbl" for="hlCert"><input id="hlCert" type="checkbox" style="accent-color:var(--accent)"> Medical certificate attached</label></div>
    <div id="hlPrev" style="grid-column:1/-1"></div>
    <div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn" type="button" id="hlCheck">Check policy</button><button class="btn pri" type="submit">Submit</button></div></form></div>`);
  const bodyOf = () => ({ employeeId: $('#hlEmp').value, type: $('#hlType').value, startDate: $('#hlS').value, endDate: $('#hlE').value, childBirthDate: $('#hlBirth').value || undefined, certificateAttached: $('#hlCert').checked });
  $('#hlType').onchange = () => { $('#hlBirthWrap').hidden = $('#hlType').value !== 'parental'; };
  $('#hlCheck').onclick = async () => { try { showLeavePreview($('#hlPrev'), await api('/leave', { method: 'POST', body: { ...bodyOf(), preview: true } })); } catch (e) { fail(e); } };
  $('#hlForm').onsubmit = async (e) => { e.preventDefault(); try { await api('/leave', { method: 'POST', body: bodyOf() }); toast('Leave request created'); views.leave(); } catch (err) { fail(err); } };
};

async function compute(establishmentId, period) {
  try { await api('/payroll/runs', { method: 'POST', body: { establishmentId, period } }); toast('Payroll computed'); views.pay(); } catch (e) { fail(e); }
}

function ibanForm(id, td) {
  td.innerHTML = `<form style="display:flex;gap:6px"><input class="mono" style="min-width:0;width:210px;font:inherit;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink)" placeholder="AE.. 23 characters" required><button class="btn sm pri">Save</button></form>`;
  td.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api(`/employees/${id}/bank`, { method: 'PATCH', body: { iban: td.querySelector('input').value.replace(/\s/g, '') } }); toast('IBAN updated. Recompute payroll to clear the hold.'); views.emp(); } catch (err) { fail(err); } };
}

// ---------------- AI agent ----------------
async function agent(q) {
  const slot = $('#agent');
  slot.innerHTML = `<div class="agent"><div class="loading" style="padding:0">Reading your instruction…</div></div>`;
  try {
    const p = await api('/agent/propose', { method: 'POST', body: { command: q } });
    slot.innerHTML = `<div class="agent"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><h2 style="margin:0">${esc(p.title)}</h2>${p.valid ? pill('p-g', 'Needs your approval') : pill('p-warn', 'More detail needed')}</div>
      ${p.steps ? `<div class="steps">${p.steps.map((s, i) => `<span class="${i === 0 ? 'done' : ''}">${esc(s)}</span>`).join('')}</div>` : ''}
      <div class="trace">${(p.checks || []).map(esc).join('<br>')}</div>
      <div style="display:flex;gap:8px;margin-top:14px">${p.valid ? '<button class="btn pri" id="aOk">Approve & run</button>' : ''}<button class="btn" id="aNo">Discard</button></div></div>`;
    $('#aNo').onclick = async () => { slot.innerHTML = ''; api(`/agent/${p.id}/discard`, { method: 'POST' }).catch(() => {}); };
    if (p.valid) $('#aOk').onclick = async () => {
      try { const r = await api(`/agent/${p.id}/execute`, { method: 'POST' }); slot.querySelectorAll('.steps span').forEach((s) => (s.className = 'done')); toast(r.message); setTimeout(() => { slot.innerHTML = ''; views[cur]().catch(fail); }, 1200); } catch (e) { fail(e); }
    };
  } catch (e) { slot.innerHTML = ''; fail(e); }
}

// ================= Employee app (self-service): home, clock in/out, leave, payslips, documents, requests, assistant, tag =================
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—');
const hmFromMin = (m) => (m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`);
const distLabel = (m) => (m == null ? '' : m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
const flagPills = (flags = []) => flags.map((f) => pill(f.code === 'LATE' || f.code === 'LOW_GPS_ACCURACY' ? 'p-warn' : f.code === 'OVERTIME' || f.code === 'HR_APPROVED' ? 'p-n' : 'p-bad', { LATE: 'Late', OUTSIDE_GEOFENCE: 'Outside site', NO_GPS: 'No GPS', LOW_GPS_ACCURACY: 'Weak GPS', OVERTIME: 'Overtime', HR_APPROVED: 'HR approved' }[f.code] || f.code)).join(' ');
let assistantLog = [];
let pendingQuestion = '';

function getLocation() {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok({ gpsError: 'This browser cannot share location' });
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }),
      (e) => ok({ gpsError: e.code === 1 ? 'Location permission denied' : e.code === 3 ? 'Location timed out' : 'Location unavailable' }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
// Downscale any image source to a small JPEG data URL (keeps uploads ~40–80 KB)
let SITE = null; // work site of the signed-in employee (set by Home / Attendance)
const kmOrM = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m >= 100000 ? 0 : 1)} km` : `${Math.round(m)} m`);
function haversine(a, b) {
  const R = 6371000, r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Downscale to a small JPEG and stamp time + GPS on it (keeps uploads ~40–80 KB, nothing is cropped)
function toJpeg(source, w, h, gps) {
  const scale = Math.min(1, 640 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const g = c.getContext('2d');
  g.drawImage(source, 0, 0, c.width, c.height); // raw frames are un-mirrored; only the live preview is mirrored
  const lines = [`${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'medium' })} GST`];
  lines.push(gps?.lat != null ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} ±${gps.accuracyM} m` : `Location: ${gps?.gpsError || 'not available'}`);
  const fs = Math.max(13, Math.round(c.width / 34)), pad = Math.round(fs * 0.7), lh = Math.round(fs * 1.35), boxH = lines.length * lh + pad * 1.5;
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, c.height - boxH, c.width, boxH);
  g.fillStyle = '#fff'; g.font = `${fs}px system-ui, sans-serif`; g.textBaseline = 'top';
  lines.forEach((t, i) => g.fillText(t, pad, c.height - boxH + pad * 0.75 + i * lh));
  return c.toDataURL('image/jpeg', 0.75);
}
const fromImage = (im, gps) => toJpeg(im, im.naturalWidth, im.naturalHeight, gps);

// Camera sheet with a live location readout. Resolves { photo, gps } or null.
function captureSelfie() {
  return new Promise((resolve) => {
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `<div class="sheet-card panel" role="dialog" aria-modal="true" aria-label="Clock-in photo">
      <h2 style="margin:0">Clock-in photo</h2><p style="margin:0;color:var(--muted);font-size:14px">Centre your face in the frame. Your photo, time and location are attached to this clock-in.</p>
      <div class="cam"><video id="camV" playsinline muted autoplay></video><div class="cam-ring"></div><img id="camP" alt="Captured photo" hidden></div>
      <div class="gpsline" id="camGps" aria-live="polite"><span class="gdot wait"></span><span>Finding your location…</span></div>
      <div id="camMsg" style="font-size:13px;color:var(--muted)">Starting camera…</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn pri" id="camShot" disabled>Take photo</button>
        <label class="btn" for="camFile" style="display:inline-flex;align-items:center">Use phone camera</label><input id="camFile" type="file" accept="image/*" capture="user" hidden>
        <button class="btn" id="camRetake" hidden>Retake</button>
        <button class="btn pri" id="camUse" hidden>Use this photo</button>
        <button class="btn" id="camCancel">Cancel</button></div></div>`;
    document.body.appendChild(sheet);
    translateTree(sheet, L);
    let stream = null, shot = null, gps = null, watch = null;
    const v = sheet.querySelector('#camV'), img = sheet.querySelector('#camP'), msg = sheet.querySelector('#camMsg'), gl = sheet.querySelector('#camGps');
    const paintGps = () => {
      if (!gps) return;
      if (gps.gpsError) {
        gl.innerHTML = `<span class="gdot bad"></span><span><b>Location off:</b> ${esc(gps.gpsError)}. ${gps.gpsError.includes('denied') ? 'Allow location for this site in your browser settings (the lock icon in the address bar), then try again.' : 'You can still clock in; HR will see it was missing.'}</span>`;
        return;
      }
      const dist = SITE?.lat != null ? haversine(gps, SITE) : null;
      const inside = dist != null && dist <= (SITE.radiusM || 300) + Math.min(gps.accuracyM <= 250 ? gps.accuracyM : 0, 150);
      const weak = gps.accuracyM > 250;
      gl.innerHTML = `<span class="gdot ${dist == null ? 'ok' : inside ? 'ok' : 'warn'}"></span><span><b class="num">${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}</b> · ±${kmOrM(gps.accuracyM)}${weak ? ' (approximate: laptops often locate by network, phones are more precise)' : ''}${dist != null ? `<br>${inside ? 'At' : `${kmOrM(dist)} from`} ${esc(SITE.label || 'the work site')}${inside ? '' : ' · HR will review this clock-in'}` : ''}</span>`;
    };
    const stop = () => { stream?.getTracks().forEach((tr) => tr.stop()); if (watch != null) navigator.geolocation.clearWatch(watch); };
    const close = (val) => { stop(); sheet.remove(); resolve(val); };
    // Keep refining the fix while the camera is open; the most accurate reading wins.
    if (navigator.geolocation) {
      watch = navigator.geolocation.watchPosition(
        (p) => { const n = { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }; if (!gps || gps.gpsError || n.accuracyM <= gps.accuracyM) { gps = n; paintGps(); } },
        (e) => { if (!gps || gps.gpsError) { gps = { gpsError: e.code === 1 ? 'Location permission denied' : e.code === 3 ? 'Location timed out' : 'Location unavailable' }; paintGps(); } },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      );
    } else { gps = { gpsError: 'This browser cannot share location' }; paintGps(); }
    const show = (dataUrl) => {
      shot = dataUrl; img.src = dataUrl; img.hidden = false; v.hidden = true; sheet.querySelector('.cam-ring').hidden = true;
      sheet.querySelector('#camShot').hidden = true; sheet.querySelector('#camRetake').hidden = false; sheet.querySelector('#camUse').hidden = false; msg.textContent = 'Looks good?';
    };
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
        v.srcObject = stream; await v.play().catch(() => {});
        sheet.querySelector('#camShot').disabled = false; msg.textContent = 'Camera ready.';
      } catch {
        msg.textContent = 'Camera access is blocked. Use “Use phone camera” instead, or allow camera access in your browser settings.';
      }
    })();
    sheet.querySelector('#camShot').onclick = () => show(toJpeg(v, v.videoWidth || 640, v.videoHeight || 480, gps));
    sheet.querySelector('#camRetake').onclick = () => { img.hidden = true; v.hidden = false; sheet.querySelector('.cam-ring').hidden = false; shot = null; sheet.querySelector('#camShot').hidden = false; sheet.querySelector('#camRetake').hidden = true; sheet.querySelector('#camUse').hidden = true; };
    sheet.querySelector('#camUse').onclick = () => close({ photo: shot, gps: gps || { gpsError: 'Location was still loading' } });
    sheet.querySelector('#camCancel').onclick = () => close(null);
    sheet.querySelector('#camFile').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const im = new Image(); im.onload = () => show(fromImage(im, gps)); im.src = URL.createObjectURL(f);
    };
  });
}

async function doClockIn(after) {
  // Face ID (when enrolled or required): the verification scan replaces the selfie step.
  const face = window.waslFace ? await window.waslFace.gate('in') : undefined;
  if (face === null) return;
  let photo, gps;
  if (face) { toast('Face verified · getting your location…'); photo = face.photo; gps = await getLocation(); } else {
    const got = await captureSelfie();
    if (!got) return;
    ({ photo, gps } = got);
  }
  try {
    const r = await api('/me/clock-in', { method: 'POST', body: { photo, ...gps, device: navigator.userAgent.slice(0, 180) }, headers: face ? { 'X-Face-Verification': face.verificationId } : {} });
    toast(r.message + (r.record.clockIn?.insideGeofence === false ? ' · outside the site, HR will review' : '') + (gps.gpsError ? ` · ${gps.gpsError}` : ''));
  } catch (e) { fail(e); }
  after();
}
async function doClockOut(after) {
  const face = window.waslFace ? await window.waslFace.gate('out') : undefined;
  if (face === null) return;
  toast('Getting your location…');
  const gps = await getLocation();
  try { const r = await api('/me/clock-out', { method: 'POST', body: { ...gps, device: navigator.userAgent.slice(0, 180) }, headers: face ? { 'X-Face-Verification': face.verificationId } : {} }); toast(r.message); } catch (e) { fail(e); }
  after();
}

// Live clock-in card used on Home and Attendance
function clockCardHtml(today, shift, site) {
  const rec = today;
  const state = !rec?.clockIn?.at ? 'out' : (rec.open ?? !rec.clockOut?.at) ? 'in' : 'done';
  const sessions = rec?.sessions || (rec ? [rec] : []);
  return `<div class="panel clockcard state-${state}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><div class="lbl">${state === 'in' ? (sessions.length > 1 ? `On shift · session ${sessions.length}` : 'On shift') : state === 'done' ? 'Clocked out' : 'Not clocked in'}</div>
        <div class="bigclock num" id="cardClock">--:--</div>
        <div style="color:var(--muted);font-size:13px">Shift ${esc(shift?.start || '08:00')}–${esc(shift?.end || '17:00')} · ${esc(site?.label || 'Work site')}</div></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        ${state === 'out' ? `<button class="btn pri big-btn" id="ciBtn">${icon('M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM4 8h3l2-3h6l2 3h3v11H4z', 20)}<span>Clock in</span></button><span style="font-size:12px;color:var(--muted)">Selfie + location required</span>` : ''}
        ${state === 'in' ? `<button class="btn pri big-btn" id="coBtn">${icon('M10 17l5-5-5-5M15 12H3M21 3v18', 20)}<span>Clock out</span></button><span style="font-size:12px;color:var(--muted)">Location captured</span>` : ''}
        ${state === 'done' ? `<button class="btn big-btn" id="ciBtn">${icon('M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM4 8h3l2-3h6l2 3h3v11H4z', 20)}<span>Clock in again</span></button><span style="font-size:12px;color:var(--muted)">${hmFromMin(rec.minutesWorked)} worked today</span>` : ''}
      </div></div>
    ${rec ? `<div class="punches">
      <div><span class="lbl">${sessions.length > 1 ? 'First in' : 'In'}</span><b class="num">${fmtTime(rec.clockIn?.at)}</b><small>${rec.clockIn?.insideGeofence === false ? `${distLabel(rec.clockIn.distanceM)} from site` : rec.clockIn?.insideGeofence ? 'On site' : rec.clockIn?.gpsError ? esc(rec.clockIn.gpsError) : ''}</small></div>
      <div><span class="lbl">${sessions.length > 1 ? 'Last out' : 'Out'}</span><b class="num">${fmtTime(rec.clockOut?.at)}</b><small>${rec.clockOut?.at ? (rec.clockOut.insideGeofence === false ? `${distLabel(rec.clockOut.distanceM)} from site` : 'Location saved') : ''}</small></div>
      <div><span class="lbl">Worked today</span><b class="num" id="liveWorked">${hmFromMin(rec.minutesWorked || 0)}</b><small>${rec.overtimeMinutes ? `${hmFromMin(rec.overtimeMinutes)} overtime` : ''}</small></div>
    </div>${sessions.length > 1 ? `<div class="sessions">${sessions.map((x, i) => `<span class="pill p-n">${i + 1}. ${fmtTime(x.clockIn?.at)} – ${x.clockOut?.at ? fmtTime(x.clockOut.at) : 'now'}</span>`).join('')}</div>` : ''}<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${flagPills(rec.flags)}</div>` : ''}
  </div>`;
}
function wireClockCard(rec, refresh) {
  const tick = () => {
    const el = document.getElementById('cardClock'); if (!el) return clearInterval(window.__clk);
    el.textContent = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Dubai' });
    const w = document.getElementById('liveWorked');
    const curS = rec?.current || rec;
    if (w && curS?.clockIn?.at && !curS.clockOut?.at) w.textContent = hmFromMin((rec.minutesWorked || 0) + Math.max(0, Math.round((Date.now() - new Date(curS.clockIn.at)) / 60000)));
  };
  clearInterval(window.__clk); tick(); window.__clk = setInterval(tick, 1000);
  const ci = $('#ciBtn'); if (ci) ci.onclick = () => doClockIn(refresh);
  const co = $('#coBtn'); if (co) co.onclick = () => doClockOut(refresh);
  window.waslRefreshLive?.(); // keep the header status pill in step with the card
}

Object.assign(views, {
  async ehome() {
    const h = await api('/me/home');
    SITE = h.site;
    const first = h.profile.fullName.split(' ')[0];
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
    const pays = h.payslips; const lastPay = pays.at(-1);
    const maxPay = Math.max(1, ...pays.map((p) => p.netFils));
    const an = h.balances.annual || {}; const annPct = an.entitlement ? Math.min(100, (an.remaining / an.entitlement) * 100) : 0;
    V(`<div class="eyebrow">${esc(today)} · ${esc(h.profile.establishment || '')}</div>
    <h1>Hello, <em>${esc(first)}</em></h1><p class="sub">${esc(h.profile.jobTitle || '')} · ${esc(h.profile.department || '')} · ${esc(h.profile.employeeNo)}</p>
    <div class="grid emp-top">
      <div id="clockSlot">${clockCardHtml(h.today, h.shift, h.site)}</div>
      <div class="panel"><h2>Quick actions</h2><div class="qa">
        ${[['eleave', 'Apply for leave', ICONS.leave], ['epay', 'My payslips', ICONS.pay], ['ereq', 'Salary certificate', ICONS.requests], ['edocs', 'My documents', ICONS.docs], ['etag', 'My ID tag', ICONS.etag], ['eai', 'Ask HR assistant', ICONS.eai]]
          .map(([go2, label, ic]) => `<button class="qa-btn" data-go="${go2}">${icon(ic, 22)}<span>${label}</span></button>`).join('')}</div></div>
    </div>
    <div class="grid g4" style="margin-top:16px">
      <div class="panel stat"><div class="v">${an.remaining ?? '—'}</div><span class="lbl">Annual leave left</span><div class="meter" style="margin-top:10px"><i style="width:${annPct}%"></i></div><div class="d">of ${an.entitlement ?? '—'} days</div></div>
      <div class="panel stat"><div class="v">${h.balances.sick?.fullPayLeft ?? '—'}</div><span class="lbl">Full-pay sick days</span><div class="d">${h.balances.sick?.taken ?? 0} taken this year</div></div>
      <div class="panel stat"><div class="v">${h.month.daysPresent}</div><span class="lbl">Days present this month</span><div class="d">${h.month.lateDays} late · ${h.month.hoursWorked} h worked</div></div>
      <div class="panel stat"><div class="v num">${lastPay ? Math.round(lastPay.netFils / 100).toLocaleString('en-AE') : '—'}</div><span class="lbl">Last net pay · AED</span><div class="d">${lastPay ? esc(lastPay.period) : 'No payslip yet'}</div></div>
    </div>
    <div class="grid g3" style="margin-top:16px">
      <div class="panel"><h2>Pay history</h2>${pays.length ? `<div class="paybars">${pays.map((p) => `<button class="paybar" data-ps="${p.runId}" title="${esc(p.period)}: AED ${AED(p.netFils)}"><span class="num">${Math.round(p.netFils / 100000 * 10) / 10}k</span><i style="height:${Math.max(6, (p.netFils / maxPay) * 100)}%"></i><small>${esc(p.period.slice(5))}</small></button>`).join('')}</div><div style="font-size:12px;color:var(--muted);margin-top:28px">Tap a bar to open that payslip.</div>` : '<div class="empty">Payslips appear here once HR releases them.</div>'}</div>
      <div class="panel"><h2>Coming up</h2><div class="list">
        ${h.upcomingLeave.map((l) => `<div class="row"><span class="sev" style="background:var(--accent)"></span><div class="grow">${esc(l.type)} leave<div style="font-size:12px;color:var(--muted)">${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}</div></div>${statusPill(l.status)}</div>`).join('')}
        ${h.holidays.map((x) => `<div class="row"><span class="sev" style="background:var(--ok)"></span><div class="grow">${esc(x.name)}<div style="font-size:12px;color:var(--muted)">${esc(x.date)}${x.estimated ? ' · estimated' : ''}</div></div>${pill('p-ok', 'Public holiday')}</div>`).join('')}
      </div></div>
      <div class="panel"><h2>My documents</h2><div class="list">
        ${h.documents.length ? h.documents.map((d) => `<div class="row"><div class="grow">${esc(DOC_LABEL[d.docType] || d.docType)}<div style="font-size:12px;color:var(--muted)">Expires ${fmtDate(d.expiryDate)}</div></div>${pill(d.daysLeft < 0 ? 'p-bad' : d.daysLeft <= 30 ? 'p-warn' : 'p-ok', d.daysLeft < 0 ? 'Expired' : `${d.daysLeft} days`)}</div>`).join('') : '<div class="empty">No documents on file.</div>'}
      </div></div>
    </div>
    <div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">My requests</h2><button class="btn sm" data-go="ereq">New request</button></div>
      <div class="list" style="margin-top:6px">${h.requests.length ? h.requests.map((x) => `<div class="row"><div class="grow">${esc(KIND_LABEL[x.kind] || x.kind)}${x.letterType ? ` · ${esc(LETTER_LABEL[x.letterType] || x.letterType)}` : ''}<div style="font-size:12px;color:var(--muted)">${esc(x.reference || '')} · ${fmtDate(x.createdAt)}</div></div>${statusPill(x.status)}</div>`).join('') : '<div class="empty">No requests yet.</div>'}</div></div>`);
    wireClockCard(h.today, () => views.ehome().catch(fail));
    document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
    document.querySelectorAll('[data-ps]').forEach((b) => (b.onclick = () => openHtml(`/me/payslips/${b.dataset.ps}`)));
  },

  async eclock() {
    const month = localStorage.getItem('wasl_attmonth') || new Date().toISOString().slice(0, 7);
    const [t0, hist] = await Promise.all([api('/me/attendance/today'), api(`/me/attendance?month=${month}`)]);
    SITE = t0.site ? { ...t0.site, label: t0.site.label || t0.site.name } : null;
    const s = hist.summary;
    const months = Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });
    V(`<div class="eyebrow">ATTENDANCE · ${esc(t0.date)}${t0.ramadan ? ' · RAMADAN HOURS' : ''}</div><h1>Clock <em>in &amp; out</em></h1>
    <p class="sub">Clocking in checks your face (Face ID, or a selfie if it is not set up) and your GPS location; clocking out records your location. If you're away from the site (a delivery, say), clock in anyway: HR reviews it.</p>
    <div id="faceSlot"></div>
    <div class="grid g2">
      <div id="clockSlot">${clockCardHtml(t0.record, t0.site?.shift, t0.site)}</div>
      <div class="panel"><h2>Where you clock in</h2>
        <div class="sitemap" aria-hidden="true"><span class="ring r3"></span><span class="ring r2"></span><span class="ring r1"></span><span class="pin"></span>
          ${t0.record?.clockIn?.distanceM != null ? `<span class="me" style="--d:${Math.min(1, (t0.record.clockIn.distanceM || 0) / ((t0.site?.radiusM || 300) * 3))}"></span>` : ''}</div>
        <div style="font-size:14px;margin-top:10px"><b>${esc(t0.site?.label || t0.site?.name || 'Work site')}</b></div>
        <div style="font-size:13px;color:var(--muted)">Allowed radius ${esc(t0.site?.radiusM || 300)} m${t0.record?.clockIn?.distanceM != null ? ` · today you were ${distLabel(t0.record.clockIn.distanceM)} away` : ''}</div>
        ${t0.site?.lat != null ? `<a class="btn sm" style="margin-top:10px;display:inline-block;text-decoration:none" href="https://www.google.com/maps?q=${t0.site.lat},${t0.site.lng}" target="_blank" rel="noopener">Open in Maps</a>` : ''}</div>
    </div>
    <div class="grid g4" style="margin-top:16px">
      <div class="panel stat"><div class="v">${s.daysPresent}</div><span class="lbl">Days present</span></div>
      <div class="panel stat"><div class="v ${s.lateDays ? 'warn' : ''}">${s.lateDays}</div><span class="lbl">Late arrivals</span></div>
      <div class="panel stat"><div class="v">${s.hoursWorked}</div><span class="lbl">Hours worked</span></div>
      <div class="panel stat"><div class="v">${s.overtimeHours}</div><span class="lbl">Overtime hours</span></div>
    </div>
    <div class="panel tw" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">History</h2>
      <div class="seg" role="group" aria-label="Month">${months.map((m) => `<button data-m="${m}" class="${m === month ? 'on' : ''}">${new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short' })}</button>`).join('')}</div></div>
      <table style="margin-top:8px"><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Worked</th><th>Notes</th><th></th></tr></thead><tbody>
      ${hist.records.map((a) => `<tr><td class="mono">${esc(a.date)}</td><td class="num">${fmtTime(a.clockIn?.at)}</td><td class="num">${fmtTime(a.clockOut?.at)}</td><td class="num">${hmFromMin(a.minutesWorked)}</td><td>${flagPills(a.flags) || '<span style="color:var(--muted)">On time</span>'}</td><td>${a.hasPhoto ? `<button class="btn sm" data-ph="${a._id}">Photo</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No attendance this month.</td></tr>'}
      </tbody></table></div><div id="phView"></div>`);
    wireClockCard(t0.record, () => views.eclock().catch(fail));
    window.waslFace?.mountCard(document.getElementById('faceSlot'));
    document.querySelectorAll('.seg [data-m]').forEach((b) => (b.onclick = () => { localStorage.setItem('wasl_attmonth', b.dataset.m); views.eclock().catch(fail); }));
    document.querySelectorAll('[data-ph]').forEach((b) => (b.onclick = async () => { try { const r = await api(`/me/attendance/${b.dataset.ph}/photo`); $('#phView').innerHTML = `<div class="panel" style="margin-top:16px;max-width:360px"><h2>Clock-in photo</h2><img src="${r.photo}" alt="Clock-in photo" style="width:100%;border-radius:4px"></div>`; } catch (e) { fail(e); } }));
  },

  async eleave() { localStorage.setItem('wasl_metab', 'leave'); await views.me(); empStrip('Leave', 'Apply for leave and track your requests. The policy check shows paid, half-paid and unpaid days before you submit.'); },
  async epay() { localStorage.setItem('wasl_metab', 'payslips'); await views.me(); empStrip('Payslips', 'Open any payslip to view, print or save it as a PDF.'); },
  async edocs() { localStorage.setItem('wasl_metab', 'docs'); await views.me(); empStrip('My documents', 'Your passport, visa, Emirates ID and other documents held by HR, with expiry dates.'); },
  async ereq() { localStorage.setItem('wasl_metab', 'req'); await views.me(); empStrip('Requests', 'Ask for letters and certificates, update your bank or personal details, or raise a salary or IT query.'); },

  async eai() {
    V(`<div class="eyebrow">ASK IN ENGLISH, عربي, हिंदी, اردو, MALAYALAM OR TAGALOG</div><h1>HR <em>assistant</em></h1>
    <p class="sub">Answers come from your own records (leave, payslips, documents, attendance). It never changes anything itself: it points you to the right button.</p>
    <div class="panel chat"><div id="chatLog" class="chat-log" aria-live="polite"></div>
      <div class="chips" id="chatChips" style="margin:10px 0"></div>
      <form id="chatForm" class="cmd" style="margin:0"><label class="sr" for="chatIn">Message</label><input id="chatIn" autocomplete="off" placeholder="e.g. How many leave days do I have left?"><button class="btn pri sm" type="submit">Send</button></form></div>`);
    const log = $('#chatLog');
    const draw = () => {
      log.innerHTML = assistantLog.length ? assistantLog.map((m) => `<div class="msg ${m.who}"><div class="bubble">${esc(m.text)}</div>${(m.actions || []).length ? `<div class="msg-actions">${m.actions.map((a) => `<button class="btn sm" data-go="${a.go}">${esc(a.label)}</button>`).join('')}</div>` : ''}</div>`).join('')
        : '<div class="empty">Ask anything about your leave, pay, documents or attendance.</div>';
      log.scrollTop = log.scrollHeight;
      log.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
    };
    const ask = async (q) => {
      assistantLog.push({ who: 'me', text: q }); assistantLog.push({ who: 'bot', text: '…' }); draw();
      try { const r = await api('/me/assistant', { method: 'POST', body: { message: q } }); assistantLog[assistantLog.length - 1] = { who: 'bot', text: r.reply, actions: r.actions }; } catch (e) { assistantLog[assistantLog.length - 1] = { who: 'bot', text: e.message }; }
      draw();
    };
    ['How many leave days do I have left?', 'Show my last payslip', 'I need a salary certificate for Emirates NBD', 'When does my visa expire?', 'Next public holiday?'].forEach((c) => {
      const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = c; b.onclick = () => ask(c); $('#chatChips').appendChild(b);
    });
    $('#chatForm').onsubmit = (e) => { e.preventDefault(); const q = $('#chatIn').value.trim(); if (!q) return; $('#chatIn').value = ''; ask(q); };
    draw();
    if (pendingQuestion) { const q = pendingQuestion; pendingQuestion = ''; ask(q); }
  },

  async etag() {
    const tg = await api('/me/tag');
    const { default: qrcode } = await import('./vendor/qrcode.mjs');
    const q = qrcode(0, 'M'); q.addData(tg.token); q.make();
    V(`<div class="eyebrow">DIGITAL EMPLOYEE TAG</div><h1>My <em>ID tag</em></h1>
    <p class="sub">Show this tag at a site kiosk or to your supervisor. The code is signed for your company, so it can't be copied to another person's record.</p>
    <div class="idcard">
      <div class="idcard-top"><span class="mark">W</span><div><b>${esc(tg.establishment || '')}</b><small>EMPLOYEE TAG · بطاقة الموظف</small></div></div>
      <div class="idcard-body">
        <div class="idcard-av">${esc(ini(tg.fullName))}</div>
        <div style="min-width:0"><div class="idcard-name">${esc(tg.fullName)}</div>${tg.fullNameAr ? `<div dir="rtl" style="color:var(--soft)">${esc(tg.fullNameAr)}</div>` : ''}
          <div style="color:var(--muted);font-size:14px;margin-top:4px">${esc(tg.jobTitle || '')} · ${esc(tg.department || '')}</div></div></div>
      <div class="idcard-qr">${q.createSvgTag({ cellSize: 5, margin: 2, scalable: true, alt: 'Employee tag QR code' })}</div>
      <div class="idcard-foot"><div><span class="lbl">Employee no.</span><b class="num">${esc(tg.employeeNo)}</b></div><div><span class="lbl">Joined</span><b class="num">${fmtDate(tg.joinDate)}</b></div><div><span class="lbl">Nationality</span><b>${esc(tg.nationality || '')}</b></div></div>
      <div class="powered" style="padding:10px 0 0;border:0"><span>POWERED BY</span><img src="devx-logo-dark.png" alt="DevX Technologies"></div>
    </div>`);
  },

  // ---------- HR: live attendance monitor ----------
  async attendance() {
    const date = localStorage.getItem('wasl_attdate') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
    const estQ = currentEst()?._id ? `&establishmentId=${currentEst()._id}` : '';
    const d = await api(`/attendance?date=${date}${estQ}`);
    const c = d.counts;
    const stateP = { in: pill('p-ok', 'On shift'), out: pill('p-n', 'Clocked out'), leave: pill('p-g', 'On leave'), absent: pill('p-bad', 'Not in') };
    V(`<div class="eyebrow">LIVE ATTENDANCE · ${esc(currentEst()?.name || '')}</div><h1>Who's <em>in</em> today</h1>
    <p class="sub">Every clock-in carries a selfie and GPS position. Review anything outside the site or without location.</p>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px"><label class="lbl" for="attDate">Date</label><input id="attDate" type="date" value="${esc(date)}" class="btn" style="padding:7px 10px"></div>
    <div class="grid g4">
      <div class="panel stat"><div class="v">${c.in + c.out}<span style="font-size:24px;color:var(--muted)"> / ${c.total}</span></div><span class="lbl">Clocked in</span><div class="meter" style="margin-top:10px"><i style="width:${c.total ? ((c.in + c.out) / c.total) * 100 : 0}%"></i></div></div>
      <div class="panel stat"><div class="v warn">${c.late}</div><span class="lbl">Late arrivals</span></div>
      <div class="panel stat"><div class="v ${c.outside ? 'bad' : ''}">${c.outside}</div><span class="lbl">Outside the site</span></div>
      <div class="panel stat"><div class="v">${c.leave}</div><span class="lbl">On approved leave</span><div class="d">${c.absent} not in yet</div></div>
    </div>
    <div class="panel tw" style="margin-top:16px"><table><thead><tr><th>Employee</th><th>Status</th><th>In</th><th>Out</th><th>Location</th><th>Flags</th><th></th></tr></thead><tbody>
    ${d.rows.map((x) => { const a = x.record; return `<tr><td><div style="display:flex;gap:10px;align-items:center"><span class="av">${esc(ini(x.employee.fullName))}</span><div>${esc(x.employee.fullName)}<div style="font-size:12px;color:var(--muted)">${esc(x.employee.department || '')} · ${esc(x.employee.employeeNo)}</div></div></div></td>
      <td>${stateP[x.state]}${x.leaveType ? ` <span style="font-size:12px;color:var(--muted)">${esc(x.leaveType)}</span>` : ''}</td><td class="num">${fmtTime(a?.clockIn?.at)}</td><td class="num">${fmtTime(a?.clockOut?.at)}</td>
      <td style="font-size:13px">${a?.clockIn?.lat != null ? `<a href="https://www.google.com/maps?q=${a.clockIn.lat},${a.clockIn.lng}" target="_blank" rel="noopener">${a.clockIn.insideGeofence ? 'On site' : distLabel(a.clockIn.distanceM) + ' away'}</a>` : a ? '<span style="color:var(--bad)">No GPS</span>' : ''}</td>
      <td>${a ? flagPills(a.flags) : ''}</td>
      <td style="white-space:nowrap">${a?.hasPhoto ? `<button class="btn sm" data-ph="${a._id}">Photo</button> ` : ''}${a && a.flags.some((f) => ['OUTSIDE_GEOFENCE', 'NO_GPS', 'LOW_GPS_ACCURACY'].includes(f.code)) && has('hr_admin', 'manager') ? `<button class="btn sm" data-ok="${a._id}">Approve</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div><div id="phView"></div>`);
    $('#attDate').onchange = () => { localStorage.setItem('wasl_attdate', $('#attDate').value); views.attendance().catch(fail); };
    document.querySelectorAll('[data-ph]').forEach((b) => (b.onclick = async () => { try { const r = await api(`/attendance/${b.dataset.ph}/photo`); $('#phView').innerHTML = `<div class="panel" style="margin-top:16px;max-width:360px"><h2>Clock-in photo</h2><img src="${r.photo}" alt="Clock-in photo" style="width:100%;border-radius:4px"></div>`; $('#phView').scrollIntoView({ behavior: 'smooth' }); } catch (e) { fail(e); } }));
    document.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = async () => {
      const row = b.closest('td'); row.innerHTML = `<form style="display:flex;gap:6px"><input placeholder="Reason, e.g. delivery run" style="min-width:0;width:170px;font:inherit;padding:4px 6px;border:1px solid var(--line-2);border-radius:4px;background:var(--surface-2);color:var(--ink)" required minlength="3"><button class="btn sm pri">Save</button></form>`;
      row.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await api(`/attendance/${b.dataset.ok}`, { method: 'PATCH', body: { note: row.querySelector('input').value, approveException: true } }); toast('Exception approved'); views.attendance().catch(fail); } catch (err) { fail(err); } };
    }));
  },
});

// Employee section pages reuse the self-service tabs, without the tab strip, under their own heading.
function empStrip(title, sub) {
  const tabs = document.querySelector('#view .tabs'); if (tabs) tabs.remove();
  const h1 = document.querySelector('#view h1'); if (h1) h1.innerHTML = `${esc(title.split(' ')[0])} <em>${esc(title.split(' ').slice(1).join(' ') || '')}</em>`;
  const eb = document.querySelector('#view .eyebrow'); if (eb) eb.insertAdjacentHTML('afterend', '');
  if (h1 && !document.querySelector('#view .sub')) h1.insertAdjacentHTML('afterend', `<p class="sub">${esc(sub)}</p>`);
  translateTree($('#view'), L);
}

// ================= HR: employee directory (search) + full-page employee profile =================
let EMP_OPEN = (() => { try { return localStorage.getItem('wasl_empid') || ''; } catch { return ''; } })();
const openEmployee = (id) => { EMP_OPEN = id; try { localStorage.setItem('wasl_empid', id); } catch {} cur = 'emp'; location.hash = 'emp'; shell(); window.scrollTo({ top: 0 }); };
const closeEmployee = () => { EMP_OPEN = ''; try { localStorage.removeItem('wasl_empid'); } catch {} views.emp().catch(fail); };
const val = (x) => (x == null || x === '' ? '—' : esc(x));
const dateIn = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const kv = (rows) => `<dl class="kv">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
function sheetForm(title, inner, onSubmit, submitLabel = 'Save changes') {
  const sh = document.createElement('div'); sh.className = 'sheet';
  sh.innerHTML = `<form class="sheet-card panel wide" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0">${esc(title)}</h2><button type="button" class="iconbtn" data-x aria-label="Close">${icon('M6 6l12 12M18 6L6 18', 18)}</button></div>${inner}<div class="err" data-err></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-x>Cancel</button><button class="btn pri" type="submit">${esc(submitLabel)}</button></div></form>`;
  document.body.appendChild(sh); translateTree(sh, L);
  const close = () => sh.remove();
  sh.querySelectorAll('[data-x]').forEach((b) => (b.onclick = close));
  sh.addEventListener('click', (e) => { if (e.target === sh) close(); });
  sh.querySelector('form').onsubmit = async (e) => { e.preventDefault(); try { await onSubmit(sh); close(); } catch (err) { sh.querySelector('[data-err]').textContent = err.message; } };
  sh.querySelector('input,select,textarea')?.focus();
  return sh;
}

// ---------------- New employee (People → New employee, Quick create → New employee) ----------------
async function newEmployeeSheet() {
  const [ests, list] = await Promise.all([api('/establishments'), api('/employees')]);
  // suggest the next number in the company's own pattern (e.g. ANT-107)
  const nums = list.map((e) => /^(.*?)(\d+)$/.exec(e.employeeNo || '')).filter(Boolean);
  const pre = nums.length ? nums.sort((a, b) => b[2] - a[2])[0] : null;
  const nextNo = pre ? `${pre[1]}${String(Number(pre[2]) + 1).padStart(pre[2].length, '0')}` : 'EMP-001';
  const depts = [...new Set(list.map((e) => e.department).filter(Boolean))].sort();
  const f = (id, label, input, full) => `<label class="nf${full ? ' full' : ''}"><span>${label}</span>${input}</label>`;
  const inp = (id, attrs = '') => `<input id="${id}" ${attrs}>`;
  const sh = sheetForm('New employee', `<p style="margin:0;color:var(--muted);font-size:14px">Adds the employee to payroll, attendance and compliance. Bank details can be added later.</p>
    <div class="nfgrid">
      ${f('ne_name', 'Full name *', inp('ne_name', 'required minlength="2" placeholder="e.g. Mariam Al Falasi"'), true)}
      ${f('ne_no', 'Employee no. *', inp('ne_no', `required value="${esc(nextNo)}"`))}
      ${f('ne_est', 'Company / site *', `<select id="ne_est" required>${ests.map((e) => `<option value="${e._id}" ${currentEst()?._id === e._id ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>`)}
      ${f('ne_job', 'Job title *', inp('ne_job', 'required placeholder="e.g. Store associate"'))}
      ${f('ne_dept', 'Team', `<input id="ne_dept" list="ne_depts" placeholder="e.g. Retail"><datalist id="ne_depts">${depts.map((d) => `<option value="${esc(d)}">`).join('')}</datalist>`)}
      ${f('ne_nat', 'Nationality *', inp('ne_nat', 'required placeholder="e.g. India"'))}
      ${f('ne_join', 'Joining date *', inp('ne_join', `type="date" required value="${new Date().toISOString().slice(0, 10)}"`))}
      ${f('ne_ct', 'Contract', `<select id="ne_ct"><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="temporary">Temporary</option><option value="flexible">Flexible</option></select>`)}
      ${f('ne_basic', 'Basic salary (AED / month) *', inp('ne_basic', 'required inputmode="decimal" placeholder="4000"'))}
      ${f('ne_house', 'Housing (AED)', inp('ne_house', 'inputmode="decimal" placeholder="0"'))}
      ${f('ne_trans', 'Transport (AED)', inp('ne_trans', 'inputmode="decimal" placeholder="0"'))}
      ${f('ne_iban', 'IBAN (optional)', inp('ne_iban', 'placeholder="AE07 0331 2345 6789 0123 456"'), true)}
      <label class="nf full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="ne_uae" style="width:auto"> <span>UAE National (counts toward Emiratisation)</span></label>
    </div>`, async (sheet) => {
    const v = (id) => sheet.querySelector('#' + id).value.trim();
    const body = { fullName: v('ne_name'), employeeNo: v('ne_no'), establishmentId: v('ne_est'), jobTitle: v('ne_job'), department: v('ne_dept') || undefined, nationality: v('ne_nat'), joinDate: v('ne_join'), contractType: v('ne_ct'), basic: v('ne_basic'), housing: v('ne_house') || 0, transport: v('ne_trans') || 0, isUaeNational: sheet.querySelector('#ne_uae').checked };
    if (v('ne_iban')) body.iban = v('ne_iban').replace(/\s+/g, '').toUpperCase();
    const emp = await api('/employees', { method: 'POST', body });
    toast(`${emp.fullName || body.fullName} added`);
    if (window.waslFace?.hrEnroll && confirmFace(emp)) return;
    if (cur === 'emp') views.emp().catch(fail);
  }, 'Add employee');
  sh.querySelector('#ne_uae').onchange = (e) => { if (e.target.checked) sh.querySelector('#ne_nat').value = 'United Arab Emirates'; };
}
window.waslNewEmployee = () => newEmployeeSheet().catch(fail);
// After adding someone, offer to enroll their face right away (for staff who clock in on the shared tablet).
function confirmFace(emp) {
  const bar = document.createElement('div'); bar.className = 'sheet';
  bar.innerHTML = `<div class="sheet-card panel fid-card"><div class="fid-head"><h2>Set up Face ID for ${esc(emp.fullName)}?</h2><p>So they can clock in on the shared tablet with a glance. Takes about 20 seconds with them in front of this camera.</p></div><div class="fid-actions"><button class="btn" data-x="no">Later</button><button class="btn pri" data-x="yes">Scan face now</button></div></div>`;
  document.body.appendChild(bar);
  bar.querySelector('[data-x=no]').onclick = () => { bar.remove(); if (cur === 'emp') views.emp().catch(fail); };
  bar.querySelector('[data-x=yes]').onclick = async () => { bar.remove(); await window.waslFace.hrEnroll(emp._id, emp.fullName); if (cur === 'emp') views.emp().catch(fail); };
  return true;
}

async function employeeDirectory() {
  const list = await api(`/employees${currentEst()?._id ? `?establishmentId=${currentEst()._id}` : ''}`);
  const depts = [...new Set(list.map((e) => e.department).filter(Boolean))].sort();
  const saved = (() => { try { return JSON.parse(localStorage.getItem('wasl_empfilter') || '{}'); } catch { return {}; } })();
  V(`<div class="eyebrow">${esc(currentEst()?.name || '')}</div><h1>${t('emp')}</h1>
  <p class="sub">${list.length} people. Search by name, employee number, job, team, nationality or email, then open anyone for their full profile.</p>
  <div class="toolbar">
    <div class="search">${icon('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', 18)}<label class="sr" for="empQ">Search employees</label><input id="empQ" type="search" placeholder="Search employees…  ( / )" value="${esc(saved.q || '')}" autocomplete="off"></div>
    <label class="sr" for="empDept">Team</label><select id="empDept" class="btn"><option value="">All teams</option>${depts.map((d) => `<option ${saved.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
    <label class="sr" for="empStatus">Status</label><select id="empStatus" class="btn"><option value="">Any status</option>${['active', 'onboarding', 'notice', 'exited'].map((s) => `<option value="${s}" ${saved.status === s ? 'selected' : ''}>${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select>
    <span id="empCount" class="lbl" style="margin-inline-start:auto"></span>
    ${has('hr_admin') ? `<button class="btn pri" id="newEmpBtn">${icon('M12 5v14M5 12h14', 16)}<span>New employee</span></button>` : ''}
  </div>
  <div class="panel tw" style="padding-top:8px"><table class="clickable"><thead><tr><th>Employee</th><th>Role</th><th>Team</th><th>Nationality</th><th>Joined</th><th>Status</th><th>IBAN</th><th class="r">Basic (AED)</th></tr></thead><tbody id="empRows"></tbody></table><div class="pager" id="empPager"></div></div>`);
  $('#newEmpBtn')?.addEventListener('click', () => newEmployeeSheet());
  const draw = () => {
    const q = $('#empQ').value.trim().toLowerCase(), dept = $('#empDept').value, st = $('#empStatus').value;
    try { localStorage.setItem('wasl_empfilter', JSON.stringify({ q, dept, status: st })); } catch {}
    const rows = list.filter((e) => (!dept || e.department === dept) && (!st || e.status === st) && (!q || [e.fullName, e.fullNameAr, e.employeeNo, e.jobTitle, e.department, e.nationality, e.email].some((x) => String(x || '').toLowerCase().includes(q))));
    $('#empCount').textContent = `${rows.length} of ${list.length}`;
    const per = 12, pages = Math.max(1, Math.ceil(rows.length / per)); dirPage = Math.min(dirPage, pages);
    const pageRows = rows.slice((dirPage - 1) * per, dirPage * per);
    $('#empPager').innerHTML = pages > 1 ? `${dirPage > 1 ? `<button class="pg" data-dp="${dirPage - 1}" aria-label="Previous page">${icon('M15 6l-6 6 6 6', 16)}</button>` : ''}${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === dirPage ? 'on' : ''}" data-dp="${i + 1}">${i + 1}</button>`).join('')}${dirPage < pages ? `<button class="pg" data-dp="${dirPage + 1}" aria-label="Next page">${icon('M9 6l6 6-6 6', 16)}</button>` : ''}` : '';
    $('#empPager').querySelectorAll('[data-dp]').forEach((b) => (b.onclick = () => { dirPage = Number(b.dataset.dp); draw(); }));
    $('#empRows').innerHTML = pageRows.map((e) => `<tr data-open="${e._id}" tabindex="0"><td><div style="display:flex;gap:10px;align-items:center"><span class="av">${esc(ini(e.fullName))}</span><div><b style="font-weight:500">${esc(L === 'ar' && e.fullNameAr ? e.fullNameAr : e.fullName)}</b><div class="mono" style="font-size:11px;color:var(--muted)">${esc(e.employeeNo)}</div></div></div></td>
      <td>${esc(e.jobTitle || '')}</td><td>${deptTag(e.department)}</td><td>${e.isUaeNational ? pill('p-g', 'UAE National') : esc(e.nationality || '')}</td><td class="mono">${fmtDate(e.joinDate)}</td>
      <td>${pill(e.status === 'active' ? 'p-ok' : e.status === 'exited' ? 'p-bad' : 'p-warn', e.status)}</td>
      <td>${e.ibanValid ? `<span class="mono">${esc(e.bank?.ibanMasked || '')}</span>` : pill('p-bad', 'Invalid')}</td><td class="r num">${AED(e.compensation?.basicFils || 0)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No one matches. Try a different search.</td></tr>';
    translateTree($('#empRows'), L);
    document.querySelectorAll('[data-open]').forEach((tr) => { tr.onclick = () => openEmployee(tr.dataset.open); tr.onkeydown = (ev) => { if (ev.key === 'Enter') openEmployee(tr.dataset.open); }; });
  };
  let dirPage = 1;
  ['#empQ', '#empDept', '#empStatus'].forEach((s) => $(s).addEventListener('input', () => { dirPage = 1; draw(); }));
  draw();
  if (!window.__slashBound) { window.__slashBound = true; document.addEventListener('keydown', (ev) => { if (ev.key === '/' && cur === 'emp' && !/input|textarea|select/i.test(document.activeElement?.tagName)) { const i = $('#empQ'); if (i) { ev.preventDefault(); i.focus(); } } }); }
}

async function employeeProfile(id) {
  const tab = (() => { try { return localStorage.getItem('wasl_emptab') || 'overview'; } catch { return 'overview'; } })();
  const month = (() => { try { return localStorage.getItem('wasl_empmonth') || new Date().toISOString().slice(0, 7); } catch { return new Date().toISOString().slice(0, 7); } })();
  let d;
  try { d = await api(`/employees/${id}/full?month=${month}`); } catch (e) { EMP_OPEN = ''; throw e; }
  const e = d.employee, admin = has('hr_admin');
  const c = e.compensation || {}, total = (c.basicFils || 0) + (c.housingFils || 0) + (c.transportFils || 0) + (c.allowances || []).reduce((a, x) => a + x.amountFils, 0);
  const tabs = [['overview', 'Overview'], ['attendance', 'Attendance'], ['leave', 'Leave'], ['payslips', 'Payslips'], ['documents', 'Documents'], ['requests', 'Requests'], ['tag', 'ID tag'], ['activity', 'Activity']];
  V(`<button class="btn sm" id="back">${icon('M15 6l-6 6 6 6', 16)} All employees</button>
  <div class="profile-head panel">
    <div class="ph-av">${esc(ini(e.fullName))}</div>
    <div class="ph-main"><div class="eyebrow">${esc(d.establishment?.name || '')}${d.establishment?.freeZone ? ` · ${esc(d.establishment.freeZone)}` : ''}</div>
      <h1 style="margin:2px 0 4px">${esc(e.fullName)}</h1>${e.fullNameAr ? `<div dir="rtl" style="color:var(--muted);text-align:start">${esc(e.fullNameAr)}</div>` : ''}
      <div class="ph-meta">${pill(e.status === 'active' ? 'p-ok' : e.status === 'exited' ? 'p-bad' : 'p-warn', e.status)}<span>${esc(e.jobTitle || '')}</span><span>${esc(e.department || '')}</span><span class="mono">${esc(e.employeeNo)}</span>${e.isUaeNational ? pill('p-g', 'UAE National') : `<span>${esc(e.nationality || '')}</span>`}</div></div>
    <div class="ph-actions">${admin ? `<button class="btn pri" id="pEdit">${icon('M4 20h4L19 9l-4-4L4 16zM14 6l4 4', 16)} Edit details</button><button class="btn" id="pDoc">Upload document</button><button class="btn" id="pLetter">Issue letter</button><button class="btn" id="pLeave">Add leave</button>` : ''}</div>
  </div>
  <div class="grid g4" style="margin-top:16px">
    <div class="panel stat"><span class="lbl">Monthly package · AED</span><div class="v num">${AED0(total)}</div><div class="d">Basic ${AED0(c.basicFils || 0)}</div></div>
    <div class="panel stat"><span class="lbl">Annual leave left</span><div class="v">${d.balances.annual?.remaining ?? '—'}</div><div class="d">of ${d.balances.annual?.entitlement ?? '—'} days</div></div>
    <div class="panel stat"><span class="lbl">Present in ${esc(new Date(month + '-01').toLocaleDateString('en-GB', { month: 'long' }))}</span><div class="v">${d.attendance.summary.daysPresent}</div><div class="d">${d.attendance.summary.lateDays} late · ${d.attendance.summary.hoursWorked} h</div></div>
    <div class="panel stat"><span class="lbl">Documents</span><div class="v ${d.documents.some((x) => x.daysLeft <= 30) ? 'warn' : ''}">${d.documents.length}</div><div class="d">${d.documents.filter((x) => x.daysLeft <= 30).length} expiring within 30 days</div></div>
  </div>
  <div class="tabs" role="tablist" style="margin-top:20px">${tabs.map(([k, v]) => `<button role="tab" data-ptab="${k}" class="${tab === k ? 'on' : ''}">${v}</button>`).join('')}</div>
  <div id="pBody"></div>`);
  $('#back').onclick = closeEmployee;
  document.querySelectorAll('[data-ptab]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('wasl_emptab', b.dataset.ptab); } catch {} employeeProfile(id).catch(fail); }));
  const body = $('#pBody'); const put = (html) => { body.innerHTML = html; translateTree(body, L); animateView(body); };
  const reload = () => employeeProfile(id).catch(fail);

  if (tab === 'overview') {
    put(`<div class="grid g3">
      <div class="panel"><h2>Personal</h2>${kv([['Full name', val(e.fullName)], ['Arabic name', val(e.fullNameAr)], ['Nationality', val(e.nationality)], ['Gender', val({ M: 'Male', F: 'Female' }[e.gender])], ['Date of birth', val(fmtDate(e.dateOfBirth))], ['Email', val(e.email)], ['Phone', val(e.phone)], ['Emirates ID', e.emiratesIdLast4 ? `<span class="mono">•••• ${esc(e.emiratesIdLast4)}</span>` : '—']])}</div>
      <div class="panel"><h2>Job</h2>${kv([['Job title', val(e.jobTitle)], ['Team', val(e.department)], ['Establishment', val(d.establishment?.name)], ['Contract', val(e.contractType)], ['Joined', val(fmtDate(e.joinDate))], ['Probation ends', val(fmtDate(e.probationEndDate))], ['MOHRE skill level', val(e.mohreSkillLevel)], ['Labour card', e.labourCardLast4 ? `<span class="mono">•••• ${esc(e.labourCardLast4)}</span>` : '—']])}</div>
      <div class="panel"><h2>Pay &amp; bank</h2>${kv([['Basic', `<span class="num">AED ${AED(c.basicFils || 0)}</span>`], ['Housing', `<span class="num">AED ${AED(c.housingFils || 0)}</span>`], ['Transport', `<span class="num">AED ${AED(c.transportFils || 0)}</span>`], ['Total', `<b class="num">AED ${AED(total)}</b>`], ['Bank', val(e.bank?.bankName)], ['IBAN', e.bank?.ibanMasked ? `<span class="mono">${esc(e.bank.ibanMasked)}</span>` : '—'], ['Paid via WPS', e.paidViaWps ? 'Yes' : 'No'], ['Pension (GPSSA)', e.pensionRegistered ? 'Registered' : 'Not registered']])}
        ${(e.compensationHistory || []).length ? `<details style="margin-top:10px"><summary class="lbl" style="cursor:pointer">Salary history (${e.compensationHistory.length})</summary><div class="list">${e.compensationHistory.slice().reverse().map((h) => `<div class="row"><div class="grow num">AED ${AED((h.basicFils || 0) + (h.housingFils || 0) + (h.transportFils || 0))}</div><span class="lbl">from ${fmtDate(h.effectiveFrom)}</span></div>`).join('')}</div></details>` : ''}</div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="panel"><h2>Emergency contacts</h2>${(e.emergencyContacts || []).length ? `<div class="list">${e.emergencyContacts.map((x) => `<div class="row"><div class="grow">${esc(x.name)}<div style="font-size:12px;color:var(--muted)">${esc(x.relation || '')}</div></div><span class="mono">${esc(x.phone || '')}</span></div>`).join('')}</div>` : '<div class="empty">None added yet.</div>'}</div>
      <div class="panel"><h2>Employee login</h2>${d.login ? `${kv([['Sign-in email', esc(d.login.email)], ['Status', d.login.active ? pill('p-ok', 'Active') : pill('p-bad', 'Disabled')], ['Last sign-in', val(d.login.lastLoginAt ? new Date(d.login.lastLoginAt).toLocaleString('en-GB') : 'Never')], ['Two-step sign-in', d.login.mfaEnabled ? 'On' : 'Off']])}
        ${admin ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button class="btn sm" data-login="reset">Reset password</button><button class="btn sm" data-login="${d.login.active ? 'disable' : 'enable'}">${d.login.active ? 'Disable login' : 'Enable login'}</button></div>` : ''}`
        : `<p style="margin:0 0 12px;color:var(--muted)">No login yet. Create one so ${esc(e.fullName.split(' ')[0])} can clock in, apply for leave and see payslips.</p>${admin ? `<button class="btn pri sm" data-login="create">Create employee login</button>` : ''}`}
        <div id="loginOut"></div></div>
    </div>`);
    body.querySelectorAll('[data-login]').forEach((b) => (b.onclick = async () => {
      try {
        const r = await api(`/employees/${id}/login`, { method: 'POST', body: { action: b.dataset.login, email: e.email || undefined } });
        if (r.tempPassword) {
          $('#loginOut').innerHTML = `<div class="note" style="background:var(--accent-soft)"><b>${esc(r.message)}</b><br>Email <span class="mono">${esc(r.email)}</span> · Temporary password <span class="mono" id="tmpPw">${esc(r.tempPassword)}</span> <button class="btn sm" id="cpPw">Copy</button><br>Employee sign-in: <span class="mono">${esc(location.origin)}/employee</span></div>`;
          $('#cpPw').onclick = async () => { try { await navigator.clipboard.writeText(`${r.email} / ${r.tempPassword}`); toast('Copied'); } catch { toast('Select the password to copy it'); } };
        } else { toast(r.message); reload(); }
      } catch (err) { fail(err); }
    }));
  } else if (tab === 'attendance') {
    const months = Array.from({ length: 4 }, (_, i) => { const x = new Date(); x.setMonth(x.getMonth() - i); return x.toISOString().slice(0, 7); });
    put(`<div class="panel tw"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">Clock-ins</h2>
      <div class="seg" role="group" aria-label="Month">${months.map((m) => `<button data-m="${m}" class="${m === month ? 'on' : ''}">${new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short' })}</button>`).join('')}</div></div>
      <table style="margin-top:8px"><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Worked</th><th>Location</th><th>Flags</th><th></th></tr></thead><tbody>
      ${d.attendance.records.map((a) => `<tr><td class="mono">${esc(a.date)}${a.seq ? ` <span class="lbl">#${a.seq + 1}</span>` : ''}</td><td class="num">${fmtTime(a.clockIn?.at)}</td><td class="num">${fmtTime(a.clockOut?.at)}</td><td class="num">${hmFromMin(a.minutesWorked)}</td>
        <td style="font-size:13px">${a.clockIn?.lat != null ? `<a href="https://www.google.com/maps?q=${a.clockIn.lat},${a.clockIn.lng}" target="_blank" rel="noopener">${a.clockIn.insideGeofence ? 'On site' : `${distLabel(a.clockIn.distanceM)} away`}</a>` : '<span style="color:var(--bad)">No GPS</span>'}</td>
        <td>${flagPills(a.flags) || '<span style="color:var(--muted)">On time</span>'}</td><td>${a.hasPhoto ? `<button class="btn sm" data-ph="${a._id}">Photo</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No clock-ins this month.</td></tr>'}
      </tbody></table></div><div id="phView"></div>`);
    body.querySelectorAll('.seg [data-m]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('wasl_empmonth', b.dataset.m); } catch {} reload(); }));
    body.querySelectorAll('[data-ph]').forEach((b) => (b.onclick = async () => { try { const r = await api(`/attendance/${b.dataset.ph}/photo`); $('#phView').innerHTML = `<div class="panel" style="margin-top:16px;max-width:380px"><h2>Clock-in photo</h2><img src="${r.photo}" alt="Clock-in photo" style="width:100%;border-radius:12px"></div>`; $('#phView').scrollIntoView({ behavior: 'smooth' }); } catch (err) { fail(err); } }));
  } else if (tab === 'leave') {
    const b2 = d.balances;
    put(`<div class="grid g3">
      <div class="panel stat"><span class="lbl">Annual leave</span><div class="v">${b2.annual?.remaining ?? '—'}</div><div class="d">of ${b2.annual?.entitlement ?? '—'} · ${esc(b2.annual?.basis || '')}</div></div>
      <div class="panel stat"><span class="lbl">Full-pay sick days left</span><div class="v">${b2.sick?.fullPayLeft ?? '—'}</div><div class="d">${b2.sick?.taken ?? 0} taken this year</div></div>
      <div class="panel stat"><span class="lbl">Requests</span><div class="v">${d.leaves.length}</div><div class="d">${d.leaves.filter((l) => l.status === 'pending').length} waiting for a decision</div></div></div>
    <div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Leave history</h2>${admin ? '<button class="btn sm" id="pLeave2">Add leave</button>' : ''}</div>
      <div class="list" style="margin-top:6px">${d.leaves.map((l) => `<div class="row"><div class="grow">${esc(l.type)} · <span class="mono">${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}</span> (${l.days}d)${l.unpaidDays ? `<div style="font-size:12px;color:var(--warn)">${l.unpaidDays} unpaid day(s)</div>` : ''}${l.reason ? `<div style="font-size:12px;color:var(--muted)">${esc(l.reason)}</div>` : ''}</div>
        ${l.status === 'pending' && has('hr_admin', 'manager') ? `<button class="btn sm" data-dec="rejected" data-l="${l._id}">Reject</button><button class="btn sm pri" data-dec="approved" data-l="${l._id}">Approve</button>` : statusPill(l.status)}</div>`).join('') || '<div class="empty">No leave yet.</div>'}</div></div>`);
    body.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = async () => { try { await api(`/leave/${b.dataset.l}/decision`, { method: 'POST', body: { decision: b.dataset.dec } }); toast(`Leave ${b.dataset.dec}`); reload(); } catch (err) { fail(err); } }));
    const l2 = $('#pLeave2'); if (l2) l2.onclick = () => addLeave(id, e, reload);
  } else if (tab === 'payslips') {
    put(`<div class="panel tw"><h2>Payslips</h2><table><thead><tr><th>Period</th><th>Type</th><th>Status</th><th class="r">Gross</th><th class="r">Net</th><th></th></tr></thead><tbody>
      ${d.payslips.map((p) => `<tr><td class="mono">${esc(p.period)}</td><td>${esc(p.type)}</td><td>${statusPill(p.status)}</td><td class="r num">${AED(p.grossFils)}</td><td class="r num"><b>${AED(p.netFils)}</b></td><td><button class="btn sm" data-ps="${p.runId}">View</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">No payroll lines yet.</td></tr>'}
      </tbody></table><p class="note">HR sees every run, including drafts. The employee only sees approved payslips.</p></div>`);
    body.querySelectorAll('[data-ps]').forEach((b) => (b.onclick = () => openHtml(`/payroll/runs/${b.dataset.ps}/payslips/${id}`)));
  } else if (tab === 'documents') {
    put(`<div class="panel tw"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Documents</h2>${admin ? '<button class="btn sm pri" id="pDoc2">Upload document</button>' : ''}</div>
      <table style="margin-top:8px"><thead><tr><th>Document</th><th>Number</th><th>Issued</th><th>Expiry</th><th>Status</th><th></th></tr></thead><tbody>
      ${d.documents.map((x) => `<tr><td>${esc(DOC_LABEL[x.docType] || x.docType)}</td><td class="mono">${val(x.number)}</td><td class="mono">${fmtDate(x.issueDate) || '—'}</td><td class="mono">${fmtDate(x.expiryDate)}</td><td>${pill(x.daysLeft < 0 ? 'p-bad' : x.daysLeft <= 30 ? 'p-warn' : 'p-ok', x.daysLeft < 0 ? `${-x.daysLeft} days overdue` : `${x.daysLeft} days`)}</td>
        <td style="white-space:nowrap">${x.hasFile ? `<button class="btn sm" data-f="${x._id}">View file</button>` : '<span class="lbl">No file</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No documents yet.</td></tr>'}
      </tbody></table></div>`);
    body.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => openFile(`/documents/${b.dataset.f}/file`)));
    const u2 = $('#pDoc2'); if (u2) u2.onclick = () => uploadDoc(id, reload);
  } else if (tab === 'requests') {
    put(`<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Requests</h2>${admin ? '<button class="btn sm" id="pLetter2">Issue letter</button>' : ''}</div>
      <div class="list" style="margin-top:6px">${d.requests.map((x) => `<div class="row"><div class="grow">${esc(KIND_LABEL[x.kind] || x.kind)}${x.letterType ? ` · ${esc(LETTER_LABEL[x.letterType] || x.letterType)}` : ''}<div style="font-size:12px;color:var(--muted)">${esc(x.reference || '')} · ${fmtDate(x.createdAt)}${x.details ? ` · ${esc(x.details)}` : ''}</div></div>${statusPill(x.status)}</div>`).join('') || '<div class="empty">No requests yet.</div>'}</div>
      ${d.requests.some((x) => ['open', 'in_progress'].includes(x.status)) ? '<button class="btn sm" id="goReq" style="margin-top:12px">Open in the request centre</button>' : ''}</div>`);
    const g = $('#goReq'); if (g) g.onclick = () => go('requests');
    const l3 = $('#pLetter2'); if (l3) l3.onclick = () => issueLetter(id);
  } else if (tab === 'tag') {
    const { default: qrcode } = await import('./vendor/qrcode.mjs');
    const q = qrcode(0, 'M'); q.addData(d.tagToken); q.make();
    put(`<div class="idcard">
      <div class="idcard-top"><span class="mark">W</span><div><b>${esc(d.establishment?.name || '')}</b><small>EMPLOYEE TAG · بطاقة الموظف</small></div></div>
      <div class="idcard-body"><div class="idcard-av">${esc(ini(e.fullName))}</div><div style="min-width:0"><div class="idcard-name">${esc(e.fullName)}</div>${e.fullNameAr ? `<div dir="rtl" style="color:var(--soft);text-align:start">${esc(e.fullNameAr)}</div>` : ''}<div style="color:var(--muted);font-size:14px;margin-top:4px">${esc(e.jobTitle || '')} · ${esc(e.department || '')}</div></div></div>
      <div class="idcard-qr">${q.createSvgTag({ cellSize: 5, margin: 2, scalable: true, alt: 'Employee tag QR code' })}</div>
      <div class="idcard-foot"><div><span class="lbl">Employee no.</span><b class="num">${esc(e.employeeNo)}</b></div><div><span class="lbl">Joined</span><b class="num">${fmtDate(e.joinDate)}</b></div><div><span class="lbl">Nationality</span><b>${esc(e.nationality || '')}</b></div></div>
      <div class="powered" style="border:0;padding:0"><span>POWERED BY</span><img src="devx-logo-dark.png" alt="DevX Technologies"></div></div>
      <p class="note" style="max-width:400px">This is the same signed tag the employee sees in their app.</p>`);
  } else {
    put(`<div class="panel"><h2>Activity</h2><div class="list">${d.activity.map((a) => `<div class="row"><span class="sev" style="background:${a.actorType === 'agent' ? 'var(--accent)' : 'var(--line-2)'}"></span><div class="grow"><span class="mono" style="font-size:13px">${esc(a.action)}</span>${a.after && typeof a.after === 'object' ? `<div style="font-size:12px;color:var(--muted)">${esc(Object.keys(a.after).slice(0, 6).join(', '))}</div>` : ''}</div><span class="lbl">${new Date(a.at).toLocaleString('en-GB')}</span></div>`).join('') || '<div class="empty">No recorded activity.</div>'}</div></div>`);
  }

  const ed = $('#pEdit'); if (ed) ed.onclick = () => editEmployee(id, d, reload);
  const pd = $('#pDoc'); if (pd) pd.onclick = () => uploadDoc(id, reload);
  const pl = $('#pLetter'); if (pl) pl.onclick = () => issueLetter(id);
  const lv = $('#pLeave'); if (lv) lv.onclick = () => addLeave(id, e, reload);
}

function editEmployee(id, d, done) {
  const e = d.employee, c = e.compensation || {};
  const opt = (v, cur2) => `<option value="${esc(v)}" ${String(cur2) === String(v) ? 'selected' : ''}>${esc(v)}</option>`;
  const contacts = (e.emergencyContacts || []).concat([{}, {}]).slice(0, 2);
  sheetForm(`Edit ${e.fullName}`, `
    <div class="form-sec">Personal</div><div class="form">
      <div class="field"><label class="lbl" for="f_fullName">Full name</label><input id="f_fullName" value="${esc(e.fullName)}" required></div>
      <div class="field"><label class="lbl" for="f_fullNameAr">Arabic name</label><input id="f_fullNameAr" dir="rtl" value="${esc(e.fullNameAr || '')}"></div>
      <div class="field"><label class="lbl" for="f_email">Email</label><input id="f_email" type="email" value="${esc(e.email || '')}"></div>
      <div class="field"><label class="lbl" for="f_phone">Phone</label><input id="f_phone" value="${esc(e.phone || '')}" placeholder="+971 5x xxx xxxx"></div>
      <div class="field"><label class="lbl" for="f_nationality">Nationality</label><input id="f_nationality" value="${esc(e.nationality || '')}"></div>
      <div class="field"><label class="lbl" for="f_dateOfBirth">Date of birth</label><input id="f_dateOfBirth" type="date" value="${dateIn(e.dateOfBirth)}"></div>
      <div class="field"><label class="lbl" for="f_gender">Gender</label><select id="f_gender"><option value="">—</option><option value="M" ${e.gender === 'M' ? 'selected' : ''}>Male</option><option value="F" ${e.gender === 'F' ? 'selected' : ''}>Female</option></select></div>
      <div class="field"><label class="lbl" for="f_emiratesIdLast4">Emirates ID (last 4)</label><input id="f_emiratesIdLast4" inputmode="numeric" maxlength="4" value="${esc(e.emiratesIdLast4 || '')}"></div>
      <label class="chkline"><input type="checkbox" id="f_isUaeNational" ${e.isUaeNational ? 'checked' : ''}> UAE national</label></div>
    <div class="form-sec">Job</div><div class="form">
      <div class="field"><label class="lbl" for="f_jobTitle">Job title</label><input id="f_jobTitle" value="${esc(e.jobTitle || '')}"></div>
      <div class="field"><label class="lbl" for="f_department">Team</label><input id="f_department" value="${esc(e.department || '')}"></div>
      <div class="field"><label class="lbl" for="f_establishmentId">Establishment</label><select id="f_establishmentId">${ESTS.map((x) => `<option value="${x._id}" ${String(x._id) === String(e.establishmentId) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="f_contractType">Contract</label><select id="f_contractType">${['full-time', 'part-time', 'temporary', 'flexible'].map((v) => opt(v, e.contractType)).join('')}</select></div>
      <div class="field"><label class="lbl" for="f_status">Status</label><select id="f_status">${['onboarding', 'active', 'notice', 'exited'].map((v) => opt(v, e.status)).join('')}</select></div>
      <div class="field"><label class="lbl" for="f_mohreSkillLevel">MOHRE skill level</label><select id="f_mohreSkillLevel"><option value="">—</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => opt(v, e.mohreSkillLevel)).join('')}</select></div>
      <div class="field"><label class="lbl" for="f_joinDate">Joined</label><input id="f_joinDate" type="date" value="${dateIn(e.joinDate)}" required></div>
      <div class="field"><label class="lbl" for="f_probationEndDate">Probation ends</label><input id="f_probationEndDate" type="date" value="${dateIn(e.probationEndDate)}"></div>
      <div class="field"><label class="lbl" for="f_exitDate">Exit date</label><input id="f_exitDate" type="date" value="${dateIn(e.exitDate)}"></div>
      <div class="field"><label class="lbl" for="f_labourCardNo">Labour card no. (14 digits)</label><input id="f_labourCardNo" inputmode="numeric" maxlength="14" placeholder="${e.labourCardLast4 ? `•••• ${esc(e.labourCardLast4)} (leave blank to keep)` : ''}"></div></div>
    <div class="form-sec">Pay &amp; bank</div><div class="form">
      <div class="field"><label class="lbl" for="f_basic">Basic (AED)</label><input id="f_basic" inputmode="decimal" value="${((c.basicFils || 0) / 100).toFixed(2)}"></div>
      <div class="field"><label class="lbl" for="f_housing">Housing (AED)</label><input id="f_housing" inputmode="decimal" value="${((c.housingFils || 0) / 100).toFixed(2)}"></div>
      <div class="field"><label class="lbl" for="f_transport">Transport (AED)</label><input id="f_transport" inputmode="decimal" value="${((c.transportFils || 0) / 100).toFixed(2)}"></div>
      <div class="field"><label class="lbl" for="f_bankName">Bank</label><input id="f_bankName" value="${esc(e.bank?.bankName || '')}"></div>
      <div class="field"><label class="lbl" for="f_iban">New IBAN</label><input id="f_iban" placeholder="${esc(e.bank?.ibanMasked || 'AE… (23 characters)')} (leave blank to keep)"></div>
      <div class="field"><label class="lbl" for="f_routingCode">Bank routing code</label><input id="f_routingCode" inputmode="numeric" maxlength="9" placeholder="9 digits (leave blank to keep)"></div>
      <label class="chkline"><input type="checkbox" id="f_paidViaWps" ${e.paidViaWps !== false ? 'checked' : ''}> Paid via WPS</label>
      <label class="chkline"><input type="checkbox" id="f_pensionRegistered" ${e.pensionRegistered ? 'checked' : ''}> Pension (GPSSA) registered</label></div>
    <div class="form-sec">Emergency contacts</div>${contacts.map((x, i) => `<div class="form three"><div class="field"><label class="lbl" for="f_ec${i}n">Name</label><input id="f_ec${i}n" value="${esc(x.name || '')}"></div><div class="field"><label class="lbl" for="f_ec${i}r">Relation</label><input id="f_ec${i}r" value="${esc(x.relation || '')}"></div><div class="field"><label class="lbl" for="f_ec${i}p">Phone</label><input id="f_ec${i}p" value="${esc(x.phone || '')}"></div></div>`).join('')}
    <p class="note">Salary changes keep the previous package in the salary history. Every change is recorded in the audit log.</p>`,
  async (sh) => {
    const g = (k) => sh.querySelector(`#f_${k}`);
    const body = {};
    for (const k of ['fullName', 'fullNameAr', 'email', 'phone', 'nationality', 'jobTitle', 'department', 'establishmentId', 'contractType', 'status', 'joinDate', 'bankName', 'emiratesIdLast4']) body[k] = g(k).value.trim();
    for (const k of ['dateOfBirth', 'probationEndDate', 'exitDate']) body[k] = g(k).value || null;
    body.gender = g('gender').value || null;
    body.mohreSkillLevel = g('mohreSkillLevel').value ? Number(g('mohreSkillLevel').value) : null;
    for (const k of ['isUaeNational', 'paidViaWps', 'pensionRegistered']) body[k] = g(k).checked;
    for (const k of ['basic', 'housing', 'transport']) body[k] = g(k).value.replace(/,/g, '') || '0';
    for (const k of ['iban', 'routingCode', 'labourCardNo']) if (g(k).value.trim()) body[k] = g(k).value.trim();
    body.emergencyContacts = [0, 1].map((i) => ({ name: g(`ec${i}n`).value.trim(), relation: g(`ec${i}r`).value.trim(), phone: g(`ec${i}p`).value.trim() })).filter((x) => x.name);
    const r = await api(`/employees/${id}`, { method: 'PATCH', body });
    toast(r.changed.length ? `Saved: ${r.changed.length} change(s)` : 'No changes');
    done();
  });
}

function uploadDoc(id, done) {
  const sh = sheetForm('Upload document', `<div class="form">
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="u_file">File (PDF, JPG, PNG, WEBP · up to 8 MB)</label><input id="u_file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"></div>
    <div class="field"><label class="lbl" for="u_type">Document type</label><select id="u_type">${Object.entries(DOC_LABEL).filter(([k]) => !['trade_licence', 'establishment_card'].includes(k)).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="u_no">Document number</label><input id="u_no"></div>
    <div class="field"><label class="lbl" for="u_issue">Issue date</label><input id="u_issue" type="date"></div>
    <div class="field"><label class="lbl" for="u_exp">Expiry date</label><input id="u_exp" type="date" required></div></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="btn sm" id="u_ocr">Read with AI</button><span id="u_msg" class="lbl">Fills the fields from the file for you to check.</span></div>`,
  async (s) => {
    const f = s.querySelector('#u_file').files[0];
    if (f && f.size > 8 * 1024 * 1024) throw new Error('That file is larger than 8 MB.');
    await api('/documents', { method: 'POST', body: { ownerType: 'employee', employeeId: id, docType: s.querySelector('#u_type').value, number: s.querySelector('#u_no').value || undefined, issueDate: s.querySelector('#u_issue').value || undefined, expiryDate: s.querySelector('#u_exp').value, ...(f ? { fileBase64: await fileToBase64(f), contentType: f.type, fileName: f.name } : {}) } });
    toast('Document saved'); done();
  }, 'Save document');
  sh.querySelector('#u_ocr').onclick = async () => {
    const f = sh.querySelector('#u_file').files[0]; if (!f) return toast('Choose a file first');
    sh.querySelector('#u_msg').textContent = 'Reading the document…';
    try {
      const r = await api('/documents/ocr', { method: 'POST', body: { fileBase64: await fileToBase64(f), contentType: f.type } });
      if (!r.available) { sh.querySelector('#u_msg').textContent = 'AI reading is not set up. Fill the fields by hand.'; return; }
      const x = r.fields || {};
      if (x.docType) sh.querySelector('#u_type').value = x.docType; if (x.number) sh.querySelector('#u_no').value = x.number;
      if (x.issueDate) sh.querySelector('#u_issue').value = x.issueDate; if (x.expiryDate) sh.querySelector('#u_exp').value = x.expiryDate;
      sh.querySelector('#u_msg').textContent = 'Filled from the document. Check before saving.';
    } catch (err) { sh.querySelector('#u_msg').textContent = err.message; }
  };
}

function issueLetter(id) {
  sheetForm('Issue letter', `<div class="form">
    <div class="field"><label class="lbl" for="l_type">Letter</label><select id="l_type">${Object.entries(LETTER_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="l_lang">Language</label><select id="l_lang"><option value="dual">English + Arabic</option><option value="en">English</option><option value="ar">Arabic</option></select></div>
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="l_to">Addressed to</label><input id="l_to" placeholder="e.g. Emirates NBD"></div>
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="l_purpose">Purpose (optional)</label><input id="l_purpose" placeholder="e.g. personal loan application"></div></div>`,
  async (s) => { await openHtml('/letters', { method: 'POST', body: { employeeId: id, type: s.querySelector('#l_type').value, lang: s.querySelector('#l_lang').value, addressee: s.querySelector('#l_to').value || undefined, purpose: s.querySelector('#l_purpose').value || undefined } }); toast('Letter issued'); }, 'Issue letter');
}

function addLeave(id, e, done) {
  const sh = sheetForm(`Add leave for ${e.fullName.split(' ')[0]}`, `<div class="form">
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="v_type">Leave type</label><select id="v_type">${['annual', 'sick', 'parental', 'maternity', 'hajj', 'unpaid', 'other'].map((x) => `<option value="${x}">${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="v_s">Start date</label><input id="v_s" type="date" required></div><div class="field"><label class="lbl" for="v_e">End date</label><input id="v_e" type="date" required></div>
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="v_r">Reason</label><input id="v_r"></div></div><div id="v_prev"></div>`,
  async (s) => { const r = await api('/leave', { method: 'POST', body: { employeeId: id, type: s.querySelector('#v_type').value, startDate: s.querySelector('#v_s').value, endDate: s.querySelector('#v_e').value, reason: s.querySelector('#v_r').value || undefined } }); toast(`Leave added (pending approval)${r.warnings?.length ? `: ${r.warnings[0]}` : ''}`); done(); }, 'Add leave');
  const prev = async () => { const s0 = sh.querySelector('#v_s').value, e0 = sh.querySelector('#v_e').value; if (!s0 || !e0) return; try { showLeavePreview(sh.querySelector('#v_prev'), await api('/leave', { method: 'POST', body: { employeeId: id, type: sh.querySelector('#v_type').value, startDate: s0, endDate: e0, preview: true } })); } catch {} };
  ['#v_type', '#v_s', '#v_e'].forEach((q) => sh.querySelector(q).addEventListener('change', prev));
}

views.emp = async () => (EMP_OPEN ? employeeProfile(EMP_OPEN) : employeeDirectory());

// ================= Workspace features: who's away, applicant tracker, wellness, tasks/calendar/hours =================
const TAGS = ['t1', 't2', 't3', 't4', 't5', 't6'];
const deptTag = (name) => { if (!name) return ''; let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `<span class="tag ${TAGS[h % TAGS.length]}">${esc(name)}</span>`; };
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const shiftMonth = (m, n) => { const d = new Date(`${m}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const dueLabel = (d) => { if (!d) return ''; const t = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }), x = new Date(d).toISOString().slice(0, 10); const diff = Math.round((Date.parse(x) - Date.parse(t)) / 864e5); return diff < 0 ? `<span class="due bad">Overdue</span>` : diff === 0 ? `<span class="due bad">Due today</span>` : diff === 1 ? `<span class="due warn">Tomorrow</span>` : `<span class="due">${fmtDate(d)}</span>`; };

// ---- Timeline grid shared by HR and employees ----
function awayGrid(d, { page = 1, perPage = 12, onPage, onBar, mine } = {}) {
  const days = []; for (let x = d.first; x <= d.last; x = new Date(Date.parse(x) + 864e5).toISOString().slice(0, 10)) days.push(x);
  const holi = Object.fromEntries(d.holidays.map((h) => [h.date, h.name]));
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const rows = d.rows.filter((r) => r.leaves.length || mine === String(r.employee._id));
  const pages = Math.max(1, Math.ceil(rows.length / perPage)); const pg = Math.min(page, pages);
  const shown = rows.slice((pg - 1) * perPage, pg * perPage);
  const col = (date) => days.indexOf(date) + 2;
  const html = `<div class="tl-wrap"><div class="tl" style="--days:${days.length}">
    <div class="tl-h tl-name">${esc(monthLabel(d.month).split(' ')[0])}</div>
    ${days.map((x) => { const wd = new Date(`${x}T00:00:00Z`).getUTCDay(); return `<div class="tl-h ${wd === 0 || wd === 6 ? 'we' : ''} ${x === todayStr ? 'today' : ''} ${holi[x] ? 'ho' : ''}" title="${esc(holi[x] || '')}"><small>${new Date(`${x}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' })}</small><b>${Number(x.slice(8))}</b></div>`; }).join('')}
    ${shown.map((r, ri) => `<div class="tl-name tl-row" style="grid-row:${ri + 2}"><span class="av">${esc(ini(r.employee.fullName))}</span><div style="min-width:0"><b>${esc(r.employee.fullName)}</b><small>${esc(r.employee.jobTitle || '')}</small></div></div>
      ${days.map((x, di) => { const wd = new Date(`${x}T00:00:00Z`).getUTCDay(); return `<div class="tl-c ${wd === 0 || wd === 6 ? 'we' : ''} ${holi[x] ? 'ho' : ''}" style="grid-row:${ri + 2};grid-column:${di + 2}"></div>`; }).join('')}
      ${d.holidays.map((h) => `<div class="tl-bar holiday" style="grid-row:${ri + 2};grid-column:${col(h.date)} / span 1" title="${esc(h.name)}"></div>`).join('')}
      ${r.leaves.map((l, li) => { const s = l.start < d.first ? d.first : l.start, e = l.end > d.last ? d.last : l.end; const span = days.indexOf(e) - days.indexOf(s) + 1; return `<button class="tl-bar ${esc(l.type)} ${l.status === 'pending' ? 'pending' : ''}" style="grid-row:${ri + 2};grid-column:${col(s)} / span ${span};--i:${ri}" data-r="${ri}" data-l="${li}" title="${esc(`${r.employee.fullName}: ${l.type} ${l.start} → ${l.end}${l.status === 'pending' ? ' (pending)' : ''}`)}">${span > 1 ? esc(l.type === 'away' ? 'Away' : l.type[0].toUpperCase() + l.type.slice(1)) : ''}</button>`; }).join('')}`).join('')}
    ${shown.length ? '' : `<div class="empty" style="grid-column:1 / -1">Nobody is away in ${esc(monthLabel(d.month))}.</div>`}
  </div></div>
  ${pages > 1 ? `<div class="pager">${pg > 1 ? `<button class="pg" data-pg="${pg - 1}" aria-label="Previous page">${icon('M15 6l-6 6 6 6', 16)}</button>` : ''}${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === pg ? 'on' : ''}" data-pg="${i + 1}">${i + 1}</button>`).join('')}${pg < pages ? `<button class="pg" data-pg="${pg + 1}" aria-label="Next page">${icon('M9 6l6 6-6 6', 16)}</button>` : ''}</div>` : ''}`;
  const wire = (root) => {
    root.querySelectorAll('[data-pg]').forEach((b) => (b.onclick = () => onPage?.(Number(b.dataset.pg))));
    root.querySelectorAll('.tl-bar[data-r]').forEach((b) => (b.onclick = () => onBar?.(shown[Number(b.dataset.r)], shown[Number(b.dataset.r)].leaves[Number(b.dataset.l)], b)));
  };
  return { html, wire };
}
const legend = `<div class="legend"><span><i class="lg annual"></i>Annual</span><span><i class="lg sick"></i>Sick</span><span><i class="lg other"></i>Other leave</span><span><i class="lg pending"></i>Pending</span><span><i class="lg holiday"></i>Public holiday</span></div>`;

async function awayView(self) {
  const month = ls.get('wasl_awaymonth', new Date().toISOString().slice(0, 7));
  const dept = self ? '' : ls.get('wasl_awaydept', '');
  const page = Number(ls.get('wasl_awaypage', '1'));
  const q = self ? '' : `${dept ? `&department=${encodeURIComponent(dept)}` : ''}${currentEst()?._id ? `&establishmentId=${currentEst()._id}` : ''}`;
  const d = await api(`${self ? '/me/away' : '/away'}?month=${month}${q}`);
  const depts = self ? [] : [...new Set((await api('/employees?status=active')).map((e) => e.department).filter(Boolean))].sort();
  const g = awayGrid(d, { page, mine: self ? me.employeeId : null, onPage: (p) => { ls.set('wasl_awaypage', String(p)); awayView(self).catch(fail); },
    onBar: (row, l, el) => {
      const pop = $('#awayPop');
      pop.innerHTML = `<div class="panel pop"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div><b>${esc(row.employee.fullName)}</b><div style="font-size:13px;color:var(--muted)">${esc(l.type === 'away' ? 'Away' : `${l.type} leave`)} · ${fmtDate(l.start)} → ${fmtDate(l.end)}${l.days ? ` · ${l.days} day(s)` : ''}</div>${l.reason ? `<div style="font-size:13px;margin-top:4px">${esc(l.reason)}</div>` : ''}</div>${statusPill(l.status)}</div>
        ${!self && l.status === 'pending' && has('hr_admin', 'manager') ? `<div style="display:flex;gap:8px;margin-top:12px"><button class="btn sm" data-dec="rejected">Reject</button><button class="btn sm pri" data-dec="approved">Approve</button></div>` : ''}</div>`;
      pop.querySelectorAll('[data-dec]').forEach((b) => (b.onclick = async () => { try { await api(`/leave/${l._id}/decision`, { method: 'POST', body: { decision: b.dataset.dec } }); toast(`Leave ${b.dataset.dec}`); awayView(self).catch(fail); } catch (err) { fail(err); } }));
      translateTree(pop, L);
    } });
  V(`<div class="eyebrow">${self ? 'Your team' : esc(currentEst()?.name || '')}</div><h1>Who's <em>away</em></h1>
  <p class="sub">${d.awayCount} ${d.awayCount === 1 ? 'person' : 'people'} away in ${esc(monthLabel(d.month))}${d.holidays.length ? ` · ${d.holidays.length} public holiday${d.holidays.length > 1 ? 's' : ''}` : ''}.${self ? ' You see dates only, not the type of leave.' : ' Click a bar for details; pending requests can be approved here.'}</p>
  <div class="toolbar"><div class="monthnav"><button class="iconbtn" id="mPrev" aria-label="Previous month">${icon('M15 6l-6 6 6 6', 16)}</button><b>${esc(monthLabel(d.month))}</b><button class="iconbtn" id="mNext" aria-label="Next month">${icon('M9 6l6 6-6 6', 16)}</button><button class="btn sm" id="mToday">Today</button></div>
    ${self ? '' : `<label class="sr" for="awDept">Team</label><select id="awDept" class="btn"><option value="">All teams</option>${depts.map((x) => `<option ${x === dept ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`}
    <span style="margin-inline-start:auto">${legend}</span></div>
  <div class="panel" style="padding:12px">${g.html}</div><div id="awayPop"></div>`);
  g.wire($('#view'));
  { const wrap = document.querySelector('.tl-wrap'), td = document.querySelector('.tl-h.today'), nm = document.querySelector('.tl-h.tl-name'); if (wrap && td && nm) wrap.scrollLeft = Math.max(0, td.offsetLeft - nm.offsetWidth - 2 * td.offsetWidth); }
  const setM = (m) => { ls.set('wasl_awaymonth', m); ls.set('wasl_awaypage', '1'); awayView(self).catch(fail); };
  $('#mPrev').onclick = () => setM(shiftMonth(d.month, -1)); $('#mNext').onclick = () => setM(shiftMonth(d.month, 1)); $('#mToday').onclick = () => setM(new Date().toISOString().slice(0, 7));
  const ds = $('#awDept'); if (ds) ds.onchange = () => { ls.set('wasl_awaydept', ds.value); ls.set('wasl_awaypage', '1'); awayView(self).catch(fail); };
}

// ---- Applicant tracker (kanban with drag & drop) ----
const STAGE_LABEL = { applied: 'Applied', screening: 'Screening', interviewed: 'Interviewed', offer: 'Made offer', hired: 'Hired', rejected: 'Not progressing' };
const VISA_LABEL = { visit_visa: 'Visit visa', residence_on_notice: 'Residence visa (on notice)', golden_visa: 'Golden visa', uae_national: 'UAE national', outside_uae: 'Outside UAE', other: 'Other' };
async function atsView() {
  const list = await api('/applicants');
  const showRejected = ls.get('wasl_atsrej', '0') === '1';
  const stages = ['applied', 'screening', 'interviewed', 'offer', 'hired', ...(showRejected ? ['rejected'] : [])];
  const can = has('hr_admin', 'manager');
  V(`<div class="eyebrow">Recruitment</div><h1>Applicant <em>tracker</em></h1>
  <p class="sub">${list.filter((a) => !['hired', 'rejected'].includes(a.stage)).length} people in the pipeline. ${can ? 'Drag a card to move it to the next stage, or use the menu on the card.' : ''}</p>
  <div class="toolbar"><div class="search">${icon('M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3', 18)}<label class="sr" for="atsQ">Search applicants</label><input id="atsQ" type="search" placeholder="Search applicants…"></div>
    <label class="chkline" style="min-height:auto"><input type="checkbox" id="atsRej" ${showRejected ? 'checked' : ''}> Show not progressing</label>
    ${can ? `<button class="btn pri" id="atsAdd" style="margin-inline-start:auto">${icon('M12 5v14M5 12h14', 16)} Add applicant</button>` : ''}</div>
  <div class="kanban" style="--cols:${stages.length}">${stages.map((s) => `<section class="kcol" data-stage="${s}" aria-label="${esc(STAGE_LABEL[s])}"><header><b>${esc(STAGE_LABEL[s])}</b><span class="kcount">${list.filter((a) => a.stage === s).length}</span></header><div class="kcards" data-drop="${s}">${list.filter((a) => a.stage === s).map((a) => `
    <article class="kcard" draggable="${can}" data-id="${a._id}" data-q="${esc(`${a.name} ${a.role} ${a.department} ${a.email || ''} ${(a.tags || []).join(' ')}`.toLowerCase())}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><b>${esc(a.name)}</b><small>${esc(a.email || '')}</small></div>
        ${can ? `<label class="sr" for="mv${a._id}">Move ${esc(a.name)}</label><select class="kmove" id="mv${a._id}" data-id="${a._id}">${['applied', 'screening', 'interviewed', 'offer', 'hired', 'rejected'].map((x) => `<option value="${x}" ${x === a.stage ? 'selected' : ''}>${esc(STAGE_LABEL[x])}</option>`).join('')}</select>` : ''}</div>
      <div class="ktags"><span class="tag t0">${esc(a.role || '')}</span>${deptTag(a.department)}${(a.tags || []).slice(0, 2).map((x) => `<span class="tag tg">${esc(x)}</span>`).join('')}</div>
      <div class="kfoot"><span title="${esc(VISA_LABEL[a.visaStatus] || '')}">${esc(VISA_LABEL[a.visaStatus] || '')}</span><span class="stars" aria-label="Rating ${a.rating} of 5">${'★'.repeat(a.rating || 0)}<span>${'★'.repeat(5 - (a.rating || 0))}</span></span></div>
      ${a.expectedSalaryFils ? `<div class="kfoot"><span>Expects AED ${AED0(a.expectedSalaryFils)}</span><span>${esc(a.source || '')}</span></div>` : ''}
    </article>`).join('') || '<div class="kempty">Drop a card here</div>'}</div></section>`).join('')}</div>`);
  const move = async (id, stage) => {
    const card = document.querySelector(`.kcard[data-id="${id}"]`);
    try { await api(`/applicants/${id}`, { method: 'PATCH', body: { stage } }); toast(`Moved to ${STAGE_LABEL[stage]}`); }
    catch (err) { fail(err); }
    if (card && !REDUCE) { card.classList.add('leaving'); await new Promise((ok) => setTimeout(ok, 180)); }
    atsView().catch(fail);
  };
  document.querySelectorAll('.kmove').forEach((s) => (s.onchange = () => move(s.dataset.id, s.value)));
  document.querySelectorAll('.kcard[draggable="true"]').forEach((c) => {
    c.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', c.dataset.id); c.classList.add('dragging'); });
    c.addEventListener('dragend', () => c.classList.remove('dragging'));
  });
  document.querySelectorAll('[data-drop]').forEach((z2) => {
    z2.addEventListener('dragover', (ev) => { ev.preventDefault(); z2.classList.add('over'); });
    z2.addEventListener('dragleave', () => z2.classList.remove('over'));
    z2.addEventListener('drop', (ev) => { ev.preventDefault(); z2.classList.remove('over'); const id = ev.dataTransfer.getData('text/plain'); if (id) move(id, z2.dataset.drop); });
  });
  $('#atsQ').oninput = () => { const q = $('#atsQ').value.trim().toLowerCase(); document.querySelectorAll('.kcard').forEach((c) => { c.hidden = !!q && !c.dataset.q.includes(q); }); };
  $('#atsRej').onchange = () => { ls.set('wasl_atsrej', $('#atsRej').checked ? '1' : '0'); atsView().catch(fail); };
  const add = $('#atsAdd');
  if (add) add.onclick = () => sheetForm('Add applicant', `<div class="form">
    <div class="field"><label class="lbl" for="a_name">Full name</label><input id="a_name" required></div>
    <div class="field"><label class="lbl" for="a_email">Email</label><input id="a_email" type="email"></div>
    <div class="field"><label class="lbl" for="a_role">Role</label><input id="a_role" required placeholder="e.g. Sales Executive"></div>
    <div class="field"><label class="lbl" for="a_dept">Team</label><input id="a_dept" placeholder="e.g. Sales"></div>
    <div class="field"><label class="lbl" for="a_visa">Visa status</label><select id="a_visa">${Object.entries(VISA_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label class="lbl" for="a_sal">Expected salary (AED / month)</label><input id="a_sal" inputmode="decimal"></div>
    <div class="field"><label class="lbl" for="a_src">Source</label><input id="a_src" placeholder="LinkedIn, Bayt, referral, NAFIS…"></div>
    <div class="field"><label class="lbl" for="a_phone">Phone</label><input id="a_phone"></div>
    <div class="field" style="grid-column:1/-1"><label class="lbl" for="a_notes">Notes</label><textarea id="a_notes"></textarea></div></div>`,
  async (s) => { const g2 = (k) => s.querySelector(`#a_${k}`).value.trim(); await api('/applicants', { method: 'POST', body: { name: g2('name'), email: g2('email'), role: g2('role'), department: g2('dept') || undefined, visaStatus: g2('visa'), expectedSalary: g2('sal') || undefined, source: g2('src') || undefined, phone: g2('phone') || undefined, notes: g2('notes') || undefined } }); toast('Applicant added'); atsView().catch(fail); }, 'Add applicant');
}

// ---- Wellness (HR aggregate) ----
async function reflectView() {
  const days = Number(ls.get('wasl_pulsedays', '30'));
  const s = await api(`/pulse/summary?days=${days}`);
  const bar = (v) => `<div class="hbar"><i style="width:${v ? (v / 5) * 100 : 0}%"></i></div>`;
  V(`<div class="eyebrow">Wellness check-in</div><h1>How the team is <em>feeling</em></h1>
  <p class="sub">Anonymous weekly check-ins from the employee app. HR only sees averages; teams with fewer than 3 answers are hidden.</p>
  <div class="toolbar"><div class="seg" role="group" aria-label="Period">${[30, 60, 90].map((x) => `<button data-d="${x}" class="${x === days ? 'on' : ''}">${x} days</button>`).join('')}</div></div>
  <div class="grid g4">
    <div class="panel stat"><span class="lbl">Average mood</span><div class="v">${s.mood ?? '—'}<span style="font-size:20px;color:inherit;opacity:.7"> / 5</span></div><div class="d">${s.responses} check-ins</div></div>
    <div class="panel stat"><span class="lbl">Participation</span><div class="v">${s.participation}%</div><div class="d">of active employees</div></div>
    <div class="panel stat"><span class="lbl">Energy</span><div class="v">${s.energy ?? '—'}</div><div class="d">out of 5</div></div>
    <div class="panel stat"><span class="lbl">Workload</span><div class="v ${s.workload >= 4 ? 'warn' : ''}">${s.workload ?? '—'}</div><div class="d">5 = overloaded</div></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="panel"><h2>Wellness by team</h2><div class="wtable">${s.byDept.map((d2) => `<div class="wrow"><div><b>${esc(d2.department)}</b><small>${d2.responses} answers</small></div>${d2.hidden ? '<span class="lbl">Too few answers to show</span>' : `<div class="wbars"><div><span class="lbl">Mood</span>${bar(d2.mood)}<b class="num">${d2.mood}</b></div><div><span class="lbl">Energy</span>${bar(d2.energy)}<b class="num">${d2.energy ?? '—'}</b></div><div class="wl"><span class="lbl">Workload</span>${bar(d2.workload)}<b class="num">${d2.workload ?? '—'}</b></div></div>`}</div>`).join('') || '<div class="empty">No check-ins yet.</div>'}</div></div>
    <div class="panel"><h2>Mood trend</h2><div class="wtrend">${s.weeks.map((w) => `<div class="wcol" title="${esc(`${w.from} → ${w.to}: ${w.mood ?? 'no data'} (${w.responses})`)}"><span class="num">${w.mood ?? '—'}</span><i style="height:${w.mood ? (w.mood / 5) * 100 : 4}%"></i><small>${esc(fmtDate(w.from).slice(5))}</small></div>`).join('')}</div>
      <h2 style="margin-top:22px">Recent comments</h2><div class="list">${s.comments.map((c) => `<div class="row"><div class="grow">“${esc(c.comment)}”</div><span class="lbl">${esc(c.date)}</span></div>`).join('') || '<div class="empty">No comments.</div>'}</div></div>
  </div>`);
  document.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { ls.set('wasl_pulsedays', b.dataset.d); reflectView().catch(fail); }));
}

// ---- Wellness (employee check-in) ----
async function ereflectView() {
  const ws = await api('/me/workspace');
  const done = ws.pulseToday;
  const scale = (key, label, lo, hi, cur2) => `<fieldset class="scale"><legend>${esc(label)}</legend><div class="scale-row">${[1, 2, 3, 4, 5].map((n) => `<label class="sc ${cur2 === n ? 'on' : ''}"><input type="radio" name="${key}" value="${n}" ${cur2 === n ? 'checked' : ''}><span class="sc-dot">${n}</span></label>`).join('')}</div><div class="scale-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div></fieldset>`;
  V(`<div class="eyebrow">Weekly check-in · anonymous</div><h1>How are you <em>doing?</em></h1>
  <p class="sub">Takes 20 seconds. HR only sees team averages, never your individual answers.</p>
  <form class="panel checkin" id="pulseForm">
    ${scale('mood', 'How do you feel at work this week?', 'Not good', 'Great', done?.mood)}
    ${scale('energy', 'How is your energy?', 'Drained', 'Full of energy', done?.energy)}
    ${scale('workload', 'How is your workload?', 'Too light', 'Too heavy', done?.workload)}
    <div class="field"><label class="lbl" for="pComment">Anything you'd like HR to know? (optional)</label><textarea id="pComment" maxlength="500">${esc(done?.comment || '')}</textarea></div>
    <button class="btn pri" type="submit">${done ? 'Update check-in' : 'Send check-in'}</button>
    ${done ? '<p class="note" style="margin:0">You already checked in today. You can update your answers.</p>' : ''}
  </form>`);
  document.querySelectorAll('.sc input').forEach((i) => (i.onchange = () => { i.closest('.scale-row').querySelectorAll('.sc').forEach((l) => l.classList.toggle('on', l.contains(i))); }));
  $('#pulseForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const v = (n) => Number(document.querySelector(`input[name="${n}"]:checked`)?.value || 0) || undefined;
    if (!v('mood')) return toast('Choose how you feel first');
    try { const r = await api('/me/pulse', { method: 'POST', body: { mood: v('mood'), energy: v('energy'), workload: v('workload'), comment: $('#pComment').value.trim() || undefined } }); toast(r.message); ereflectView().catch(fail); } catch (err) { fail(err); }
  };
}

// ---- Tasks / calendar / hours widgets (dashboard + employee home) ----
function workspaceHtml(ws, self) {
  const t0 = new Date(`${ws.date}T00:00:00Z`); const dow = t0.getUTCDay();
  const week = Array.from({ length: 7 }, (_, i) => { const x = new Date(t0); x.setUTCDate(t0.getUTCDate() - dow + i); return x.toISOString().slice(0, 10); });
  const maxH = Math.max(9, ...ws.hours.map((h) => h.hours));
  const open = ws.tasks.filter((x) => !x.done).length;
  return `<div class="grid g3 ws" style="margin-top:16px">
    <div class="panel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:0">My tasks</h2><span class="lbl">${open} active</span></div>
      <div class="tasks" style="margin-top:10px">${ws.tasks.map((x) => `<label class="task ${x.done ? 'done' : ''}"><input type="checkbox" data-task="${x._id}" ${x.done ? 'checked' : ''}><span class="tk"></span><span class="tt">${esc(x.title)}</span>${x.done ? '' : dueLabel(x.dueDate)}</label>`).join('') || '<div class="empty">No tasks. Enjoy the calm.</div>'}</div>
      <form class="addtask" id="taskForm"><label class="sr" for="taskIn">New task</label><input id="taskIn" placeholder="Add a task…" maxlength="160"><button class="btn sm" type="submit">Add</button></form></div>
    <div class="panel"><h2>${esc(new Date(`${ws.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</h2>
      <div class="weekstrip">${week.map((x) => `<div class="wd ${x === ws.date ? 'on' : ''}"><small>${new Date(`${x}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</small><b>${Number(x.slice(8))}</b>${ws.events.some((e) => e.date === x) ? '<i></i>' : ''}</div>`).join('')}</div>
      <div class="list" style="margin-top:8px">${ws.events.slice(0, 5).map((e) => `<div class="row evt"><span class="evd"><b>${Number(e.date.slice(8))}</b><small>${new Date(`${e.date}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</small></span><div class="grow"><b style="font-weight:500">${esc(e.title)}</b><div style="font-size:12px;color:var(--muted)">${esc(e.detail || '')}</div></div><span class="num" style="font-size:12.5px;color:var(--muted)">${esc(e.start || '')}${e.end && e.end !== e.start ? `–${esc(e.end)}` : ''}</span></div>`).join('') || '<div class="empty">Nothing scheduled.</div>'}</div></div>
    <div class="panel"><div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:0">${self ? 'My working hours' : 'Average hours per person'}</h2><span class="lbl">Last 7 days</span></div>
      <div class="hours">${ws.hours.map((h) => `<div class="hcol" title="${esc(`${h.date}: ${h.hours} h${self ? '' : ` · ${h.people} people`}`)}"><span class="num">${h.hours ? h.hours : ''}</span><div class="htrack"><i style="height:${(h.hours / maxH) * 100}%"></i></div><small>${esc(h.weekday)}</small></div>`).join('')}</div>
      <div class="hscale"><span>0h</span><span>${Math.round(maxH / 2)}h</span><span>${maxH}h</span></div></div>
  </div>`;
}
function wireWorkspace(self, reload) {
  const base = self ? '/me/tasks' : '/tasks';
  document.querySelectorAll('[data-task]').forEach((c) => (c.onchange = async () => { c.closest('.task').classList.toggle('done', c.checked); try { await api(`${base}/${c.dataset.task}`, { method: 'PATCH', body: { done: c.checked } }); } catch (err) { fail(err); } }));
  const f = $('#taskForm'); if (f) f.onsubmit = async (ev) => { ev.preventDefault(); const v = $('#taskIn').value.trim(); if (!v) return; try { await api(base, { method: 'POST', body: { title: v } }); toast('Task added'); reload(); } catch (err) { fail(err); } };
}

// Hook the widgets into the existing HR dashboard and employee home without changing them
const baseDash = views.dash, baseEhome = views.ehome;
views.dash = async () => {
  await baseDash();
  try {
    const ws = await api('/workspace');
    const box = document.createElement('div'); box.innerHTML = workspaceHtml(ws, false);
    const anchor = document.querySelector('#view .grid.g3'); (anchor ? anchor.parentNode.insertBefore(box, anchor.nextSibling) : $('#view').appendChild(box));
    const tiles = document.createElement('div'); tiles.className = 'qtiles';
    tiles.innerHTML = [['leave', 'Leave requests', `${ws.counts.pendingLeave} waiting`, 'q1'], ['ats', 'Applicant tracker', `${ws.counts.openApplicants} in pipeline`, 'q2'], ['away', "Who's away", 'Team calendar', 'q3'], ['reflect', 'Wellness', 'Team check-ins', 'q4']]
      .map(([m, tl, sub, cls]) => `<button class="qtile ${cls}" data-go="${m}"><span>${icon(ICONS[m], 22)}</span><b>${tl}</b><small>${sub}</small></button>`).join('');
    const sub = document.querySelector('#view .sub'); sub.parentNode.insertBefore(tiles, sub.nextSibling);
    translateTree($('#view'), L); animateView(box); animateView(tiles);
    tiles.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
    wireWorkspace(false, () => views.dash().catch(fail));
  } catch { /* widgets are optional */ }
};
views.ehome = async () => {
  await baseEhome();
  try {
    const ws = await api('/me/workspace');
    const box = document.createElement('div'); box.innerHTML = workspaceHtml(ws, true);
    const stats = document.querySelector('#view .grid.g4'); stats.parentNode.insertBefore(box, stats.nextSibling);
    if (!ws.pulseToday) { const n = document.createElement('div'); n.className = 'panel nudge'; n.innerHTML = `<div><b>Weekly check-in</b><div style="font-size:13px;color:var(--muted)">How are you doing this week? It's anonymous and takes 20 seconds.</div></div><button class="btn pri sm" data-go="ereflect">Check in</button>`; box.prepend(n); n.querySelector('[data-go]').onclick = () => go('ereflect'); }
    translateTree(box, L); animateView(box);
    wireWorkspace(true, () => views.ehome().catch(fail));
  } catch { /* widgets are optional */ }
};
Object.assign(views, { away: () => awayView(false), eaway: () => awayView(true), ats: atsView, reflect: reflectView, ereflect: ereflectView });

const SH = { mods: () => mods(), get cur() { return cur; }, lang: () => L, esc, icon, ICONS, t, ini, me: () => me, api, has, go, sheetForm, isStaff: () => isStaffUser(), estName: () => currentEst()?.name, signOut, toggleLang: () => { L = L === 'en' ? 'ar' : 'en'; localStorage.setItem('wasl_lang', L); shell(); }, rerender: () => shell() };
const tenantId = () => { try { return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).tid; } catch { return ''; } };
window.waslFace?.init({ api, toast, esc });
installExt({ views, STAFF_MODS, EMP_MODS, ICONS, T, api, V, esc, AED, toast, fail, has, pill, sheetForm, icon, fileToBase64, openFile, kv, currentEst, ests: () => ESTS, tenantId, translate: (el) => translateTree(el, L) });

window.addEventListener('hashchange', () => { const m = location.hash.slice(1); if (token && mods().includes(m) && m !== cur) { cur = m; shell(); } });
startBackground();
token ? shell() : loginView();
