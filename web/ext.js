// Wasl HRMS — screens for the extension modules (payroll+, time, people, talent, insights, platform,
// employee services) and the colour-theme switcher. Plain ES module, no build step.
// app.js calls installExt(ctx) once; ctx hands over its helpers so styling and behaviour stay identical.

// ======================================================================= Themes
export const THEMES = [
  ['classic', 'Classic', '#121212', '#ff5b1f'], ['teal', 'Teal', '#0f4c4c', '#ff6a2b'], ['ocean', 'Ocean', '#1e3a8a', '#0ea5e9'], ['emerald', 'Emerald', '#064e3b', '#10b981'],
  ['royal', 'Royal', '#3b0764', '#a855f7'], ['gold', 'Desert', '#3f2d14', '#d4a017'], ['rose', 'Rose', '#4c0519', '#f43f5e'],
];
const store = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const mq = matchMedia('(prefers-color-scheme: dark)');
export function applyTheme() {
  const t = store.get('wasl_theme', 'classic'); const m = store.get('wasl_mode', 'light');
  const el = document.documentElement;
  if (t === 'classic') el.removeAttribute('data-theme'); else el.setAttribute('data-theme', t);
  el.setAttribute('data-mode', m === 'auto' ? (mq.matches ? 'dark' : 'light') : m);
  window.dispatchEvent(new CustomEvent('wasl:theme'));
}
mq.addEventListener?.('change', () => store.get('wasl_mode', 'light') === 'auto' && applyTheme());
applyTheme();
export const accentRgb = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(); const m = v.match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).join(',') : '255,91,31'; };

export function themeButton(icon) {
  return `<div style="position:relative"><button class="iconbtn" id="themeBtn" aria-label="Colours and appearance" title="Colours" aria-haspopup="true" aria-expanded="false">${icon('M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.8-.5-1.1-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.6 17 3 12 3zM7.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM10.5 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM15 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 18)}</button>
  <div id="themePop" class="panel popover themepop" hidden></div></div>`;
}
export function wireThemeButton() {
  const btn = document.getElementById('themeBtn'); const pop = document.getElementById('themePop'); if (!btn) return;
  const paint = () => {
    const t = store.get('wasl_theme', 'classic'), m = store.get('wasl_mode', 'light');
    pop.innerHTML = `<h4>Colour</h4><div class="swatches">${THEMES.map(([k, l, p, a]) => `<button class="swatch ${k === t ? 'on' : ''}" data-t="${k}" aria-pressed="${k === t}"><i style="background:${p};--sw-acc:${a}"></i>${l}</button>`).join('')}</div>
      <h4>Appearance</h4><div class="seg" role="group" aria-label="Appearance">${[['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([k, l]) => `<button data-m="${k}" class="${k === m ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    pop.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { store.set('wasl_theme', b.dataset.t); applyTheme(); paint(); }));
    pop.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { store.set('wasl_mode', b.dataset.m); applyTheme(); paint(); }));
  };
  btn.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) paint(); };
  pop.onclick = (e) => e.stopPropagation();
  document.addEventListener('click', () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') pop.hidden = true; });
}

// ======================================================================= Extension screens
export const EXT_STAFF = ['payplus', 'timeplus', 'people', 'talent', 'insights', 'platform'];
export const EXT_EMP = ['eservices', 'egrowth', 'eshift', 'evoice'];
export const EXT_LABELS = {
  en: { payplus: 'Payroll+', timeplus: 'Time & roster', people: 'People ops', talent: 'Talent', insights: 'Insights', platform: 'Platform', eservices: 'Services', egrowth: 'Growth', eshift: 'My shifts', evoice: 'Voice assistant' },
  ar: { payplus: 'الرواتب+', timeplus: 'الوقت والمناوبات', people: 'عمليات الموظفين', talent: 'المواهب', insights: 'التحليلات', platform: 'المنصة', eservices: 'الخدمات', egrowth: 'التطوير', eshift: 'مناوباتي', evoice: 'المساعد الصوتي' },
};
export const EXT_ICONS = {
  payplus: 'M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5',
  timeplus: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M8 13h3v3H8z',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 11l2 2 4-4',
  talent: 'M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.2 13.9L7 22l5-3 5 3-1.2-8.1',
  insights: 'M3 3v18h18M7 15l4-4 3 3 6-7',
  platform: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v6M14 17h6',
  eservices: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
  egrowth: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  eshift: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4',
  evoice: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
};

let C; // context from app.js
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const H = (s) => C.esc(s);
const AED = (f) => C.AED(f);
const d10 = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
const thisMonth = () => today().slice(0, 7);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tone = (s) => (['approved', 'active', 'done', 'signed', 'paid', 'ok', 'delivered', 'open', 'closed_ok', 'completed', 'clean', 'pass', 'present'].includes(s) ? 'p-ok' : ['rejected', 'failed', 'dead', 'blocked', 'declined', 'withdrawn', 'expired', 'high', 'bad', 'written_off'].includes(s) ? 'p-bad' : ['pending', 'submitted', 'manager_approved', 'in_progress', 'sent', 'viewed', 'queued', 'running', 'draft', 'medium', 'warn', 'scheduled', 'pending_approval', 'queued_for_payroll', 'synced', 'due', 'deferred'].includes(s) ? 'p-warn' : 'p-n');
const st = (s) => C.pill(tone(s), String(s ?? '').replace(/_/g, ' '));
const money = (f) => `<span class="num">${AED(f)}</span>`;
const isHR = () => C.has('hr_admin');
const isPay = () => C.has('hr_admin', 'payroll_maker', 'payroll_checker');
const estId = () => C.currentEst()?._id;

// ---------- downloads (auth header needed, so no plain links) ----------
async function download(path, { method = 'GET', body, filename = 'download' } = {}) {
  try {
    const res = await fetch(`/api${path}`, { method, headers: { Authorization: `Bearer ${store.get('wasl_token', '')}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `Failed (${res.status})`); }
    const cd = res.headers.get('content-disposition') || ''; const name = (cd.match(/filename="([^"]+)"/) || [])[1] || filename;
    const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (e) { C.fail(e); }
}
const openPdf = (path) => C.openFile(path);

// ---------- building blocks ----------
function table(cols, rows, { empty = 'Nothing here yet.', rowAttr } = {}) {
  if (!rows?.length) return `<div class="empty">${H(empty)}</div>`;
  return `<div class="tw"><table><thead><tr>${cols.map(([l, , cls]) => `<th class="${cls || ''}">${H(l)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr ${rowAttr ? rowAttr(r, i) : ''}>${cols.map(([, f, cls]) => `<td class="${cls || ''}">${f(r, i) ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const btn = (label, act, data = '', cls = 'sm') => `<button class="btn ${cls}" data-act="${act}" ${data}>${H(label)}</button>`;
const panel = (title, body, actions = '') => `<div class="panel"><div class="xsec"><h2>${H(title)}</h2><div class="xrow">${actions}</div></div>${body}</div>`;
const kpis = (list) => `<div class="xkpis">${list.map(([v, l]) => `<div class="xkpi"><b>${v}</b><span>${H(l)}</span></div>`).join('')}</div>`;

/** fields: [{k, label, type, options:[[v,l]], req, full, value, ph, help, step}] */
function fieldsHtml(fields) {
  return `<div class="form">${fields.map((f) => {
    const id = `xf_${f.k}`; const v = f.value ?? ''; const full = f.full || f.type === 'textarea' || f.type === 'file' ? ' style="grid-column:1/-1"' : '';
    let input;
    if (f.type === 'select') input = `<select id="${id}" ${f.req ? 'required' : ''}>${(f.options || []).map(([ov, ol]) => `<option value="${H(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${H(ol)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') input = `<textarea id="${id}" rows="${f.rows || 3}" ${f.req ? 'required' : ''} placeholder="${H(f.ph || '')}">${H(v)}</textarea>`;
    else if (f.type === 'check') input = `<label class="chkline"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${H(f.text || '')}</label>`;
    else if (f.type === 'file') input = `<input id="${id}" type="file" accept="${f.accept || 'application/pdf,image/jpeg,image/png,image/webp'}" ${f.req ? 'required' : ''}>`;
    else input = `<input id="${id}" type="${f.type || 'text'}" value="${H(v)}" ${f.req ? 'required' : ''} ${f.step ? `step="${f.step}"` : ''} ${f.min != null ? `min="${f.min}"` : ''} placeholder="${H(f.ph || '')}">`;
    return `<div class="field"${full}><label class="lbl" for="${id}">${H(f.label)}</label>${input}${f.help ? `<small class="xmuted">${H(f.help)}</small>` : ''}</div>`;
  }).join('')}</div>`;
}
async function readFields(root, fields) {
  const out = {};
  for (const f of fields) {
    const el = $(`#xf_${f.k}`, root); if (!el) continue;
    if (f.type === 'check') out[f.k] = el.checked;
    else if (f.type === 'file') { const file = el.files[0]; if (file) { if (file.size > (f.max || 8) * 1048576) throw new Error(`File is larger than ${f.max || 8} MB.`); out[f.k] = { data: await C.fileToBase64(file), type: file.type, name: file.name }; } }
    else if (f.type === 'number') { if (el.value !== '') out[f.k] = Number(el.value); }
    else if (el.value !== '') out[f.k] = el.value;
  }
  return out;
}
function formSheet(title, fields, onSubmit, label = 'Save', extra = '') {
  const sh = C.sheetForm(title, fieldsHtml(fields) + extra, async (s) => { await onSubmit(await readFields(s, fields), s); }, label);
  return sh;
}
const confirmSheet = (title, text, onOk, label = 'Confirm') => C.sheetForm(title, `<p>${H(text)}</p>`, onOk, label);

/** Tabbed screen. tabs: [[key, label, render(el)]] */
function screen(key, title, sub, tabs) {
  const saved = store.get(`wasl_tab_${key}`, tabs[0][0]); const curTab = tabs.find((t) => t[0] === saved) ? saved : tabs[0][0];
  C.V(`<div class="xhead"><div><h1>${H(title)}</h1><p class="sub" style="margin:4px 0 0">${H(sub)}</p></div></div>
    <div class="tabs xtabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${k === curTab ? 'on' : ''}" aria-selected="${k === curTab}">${H(l)}</button>`).join('')}</div><div id="xbody"><div class="loading empty">Loading…</div></div>`);
  const run = async (k) => {
    store.set(`wasl_tab_${key}`, k);
    $$('[data-tab]').forEach((b) => { b.classList.toggle('on', b.dataset.tab === k); b.setAttribute('aria-selected', String(b.dataset.tab === k)); });
    const body = $('#xbody'); body.innerHTML = '<div class="loading empty">Loading…</div>';
    try { await tabs.find((t) => t[0] === k)[2](body, () => run(k)); C.translate(body); } catch (e) { body.innerHTML = `<div class="panel"><div class="err">${H(e.message)}</div></div>`; }
  };
  $$('[data-tab]').forEach((b) => (b.onclick = () => run(b.dataset.tab)));
  return run(curTab);
}
/** Bind data-act buttons inside el to handlers { act: (dataset, button) => … }. Errors toast. */
function on(el, handlers) {
  el.onclick = async (e) => {
    const b = e.target.closest('[data-act]'); if (!b || !el.contains(b)) return;
    const h = handlers[b.dataset.act]; if (!h) return;
    b.disabled = true;
    try { await h(b.dataset, b); } catch (err) { C.fail(err); } finally { b.disabled = false; }
  };
}
const empOpts = async () => (await C.api('/employees?status=active')).map((e) => [e._id, `${e.fullName} · ${e.employeeNo}`]);
const estOpts = () => C.ests().map((e) => [e._id, e.name]);

// ======================================================================= PAYROLL+
async function payplus() {
  return screen('payplus', 'Payroll+', 'Loans, overtime, airfare, journals and reconciliation feeding the WPS payroll.', [
    ['loans', 'Loans & fines', async (el, reload) => {
      const rows = await C.api('/loans');
      el.innerHTML = panel('Loans, advances & fines', table([
        ['Employee', (l) => `${H(l.employeeId?.fullName)}<div class="xmuted">${H(l.reason || '')}</div>`], ['Type', (l) => H(l.kind)],
        ['Principal', (l) => money(l.principalFils), 'r'], ['Instalment', (l) => money(l.installmentFils), 'r'], ['Outstanding', (l) => money(l.outstandingFils), 'r'],
        ['Schedule', (l) => `<span class="xmuted">${l.schedule.filter((s) => s.status === 'deducted').length}/${l.schedule.length} paid · from ${H(l.startPeriod)}</span>`], ['Status', (l) => st(l.status)],
        ['', (l) => (l.status === 'pending' ? btn('Approve', 'dec', `data-id="${l._id}" data-d="approve"`) + ' ' + btn('Reject', 'dec', `data-id="${l._id}" data-d="reject"`) : l.status === 'active' ? btn('Reschedule', 'res', `data-id="${l._id}"`) + (isHR() ? ' ' + btn('Write off', 'wo', `data-id="${l._id}"`) : '') : '')],
      ], rows, { empty: 'No loans, advances or fines yet.' }), btn('New loan / fine', 'new', '', 'pri sm'));
      on(el, {
        new: async () => formSheet('New loan, advance or fine', [
          { k: 'employeeId', label: 'Employee', type: 'select', options: await empOpts(), req: true }, { k: 'kind', label: 'Type', type: 'select', options: [['loan', 'Loan'], ['advance', 'Salary advance'], ['fine', 'Fine']] },
          { k: 'principal', label: 'Amount (AED)', type: 'number', step: '0.01', req: true }, { k: 'installment', label: 'Monthly instalment (AED)', type: 'number', step: '0.01', req: true },
          { k: 'startPeriod', label: 'First deduction month', type: 'month', value: thisMonth(), req: true }, { k: 'reason', label: 'Reason', full: true },
        ], async (v) => { await C.api('/loans', { method: 'POST', body: v }); C.toast('Created. A second person must approve it.'); reload(); }, 'Create'),
        dec: async (d) => { await C.api(`/loans/${d.id}/decision`, { method: 'POST', body: { decision: d.d } }); C.toast(`Loan ${d.d}d`); reload(); },
        res: (d) => formSheet('Reschedule remaining balance', [{ k: 'installment', label: 'New instalment (AED)', type: 'number', step: '0.01', req: true }, { k: 'startPeriod', label: 'Restart from', type: 'month', value: thisMonth(), req: true }], async (v) => { await C.api(`/loans/${d.id}/reschedule`, { method: 'POST', body: v }); reload(); }),
        wo: (d) => formSheet('Write off balance', [{ k: 'note', label: 'Reason (kept in the audit log)', req: true, full: true }], async (v) => { await C.api(`/loans/${d.id}/write-off`, { method: 'POST', body: v }); reload(); }, 'Write off'),
      });
    }],
    ['ot', 'Overtime & sync', async (el, reload) => {
      const est = C.currentEst(); const period = store.get('wasl_ot_period', thisMonth());
      const [rows, pol] = await Promise.all([C.api(`/payroll/overtime?establishmentId=${est._id}&period=${period}`), C.api('/payroll/policy')]);
      el.innerHTML = `${panel(`Overtime from attendance · ${est.name}`, `<div class="xrow" style="margin-bottom:10px"><label class="lbl" for="otp">Month</label><input id="otp" type="month" value="${period}" style="max-width:180px"><span class="xmuted">Rates come from the rule pack (normal ${rows[0]?.trace?.rates?.normal ?? 1.25}× · night/rest day/holiday ${rows[0]?.trace?.rates?.premium ?? 1.5}×). ${pol.overtimeRequiresApproval ? 'Overtime must be approved before it reaches payroll.' : 'Overtime flows to payroll without approval.'}</span></div>` + table([
        ['Employee', (r) => H(r.employeeName)], ['Normal', (r) => `${(r.normalMinutes / 60).toFixed(1)} h`, 'r'], ['Premium', (r) => `${(r.premiumMinutes / 60).toFixed(1)} h`, 'r'], ['Pay', (r) => money(r.totalFils), 'r'],
        ['Approval', (r) => st(r.approval?.status || 'pending')], ['', (r) => (C.has('hr_admin', 'manager') ? btn('Approve', 'ap', `data-id="${r.employeeId}" data-d="approved"`) + ' ' + btn('Time off instead', 'ap', `data-id="${r.employeeId}" data-d="approved" data-rest="1"`) + ' ' + btn('Reject', 'ap', `data-id="${r.employeeId}" data-d="rejected"`) : '')],
      ], rows, { empty: 'No overtime recorded this month.' }))}
      <div style="height:16px"></div>${panel('Sync into payroll inputs', '<p class="xmuted">Collects approved overtime, loan and fine instalments (within the 50% cap) and approved expense claims for this entity and month. You see a preview first; recompute the payroll run after applying.</p><div id="syncOut"></div>', btn('Preview sync', 'prev', '', 'pri sm'))}`;
      $('#otp', el).onchange = (e) => { store.set('wasl_ot_period', e.target.value); reload(); };
      on(el, {
        ap: async (d) => { await C.api(`/payroll/overtime/${d.id}/decision`, { method: 'POST', body: { period, decision: d.d, compensatoryRest: !!d.rest } }); C.toast('Saved'); reload(); },
        prev: async () => {
          const p = await C.api('/payroll/inputs/sync/preview', { method: 'POST', body: { establishmentId: est._id, period } });
          $('#syncOut', el).innerHTML = table([['Employee', (l) => H(l.employeeName)], ['Overtime', (l) => money(l.overtimeFils), 'r'], ['Loans', (l) => money(l.loanInstallmentFils), 'r'], ['Fines', (l) => money(l.fineFils), 'r'], ['Reimbursements', (l) => money(l.expenseReimbursementFils), 'r'], ['Deferred', (l) => (l.loanItems.some((i) => i.deferredFils) ? C.pill('p-warn', 'cap reached') : '')]], p.lines.filter((l) => l.overtimeFils || l.loanInstallmentFils || l.fineFils || l.expenseReimbursementFils), { empty: 'Nothing to sync for this month.' }) + `<div class="xrow" style="margin-top:10px">${btn('Apply to payroll inputs', 'apply', `data-id="${p.syncId}"`, 'pri sm')}<span class="xmuted">${H(p.note)}</span></div>`;
        },
        apply: async (d) => { const r = await C.api(`/payroll/inputs/sync/${d.id}/apply`, { method: 'POST' }); C.toast(r.message); $('#syncOut', el).innerHTML = `<p>${H(r.message)}</p>`; },
      });
    }],
    ['air', 'Airfare', async (el, reload) => {
      const [pols, accs, reqs] = await Promise.all([C.api('/airfare/policies'), C.api('/airfare/accounts'), C.api('/airfare/requests')]);
      el.innerHTML = `<div class="xgrid">${panel('Requests', table([['Employee', (r) => H(r.employeeId?.fullName)], ['Type', (r) => H(r.kind)], ['Amount', (r) => money(r.amountFils), 'r'], ['Travel', (r) => d10(r.travelDate)], ['Status', (r) => st(r.status)], ['', (r) => (r.status === 'pending' && isHR() ? btn('Approve', 'dec', `data-id="${r._id}" data-d="approved"`) + ' ' + btn('Reject', 'dec', `data-id="${r._id}" data-d="rejected"`) : r.offcycleRunId ? '<span class="xmuted">Off-cycle run created</span>' : '')]], reqs, { empty: 'No airfare requests.' }))}
        ${panel('Entitlements', table([['Employee', (a) => H(a.employeeId?.fullName)], ['Policy', (a) => H(a.policyId?.name)], ['Home', (a) => H(a.homeIata)], ['Dependents', (a) => a.dependentsCovered, 'r'], ['Balance', (a) => money(a.balanceFils), 'r'], ['Accrued to', (a) => H(a.lastAccruedPeriod || '—')]], accs, { empty: 'No one has an airfare entitlement yet.' }), (isHR() ? btn('Assign entitlement', 'acc') : '') + (isPay() ? btn('Run monthly accrual', 'accrue', '', 'pri sm') : ''))}
        ${panel('Policies', table([['Name', (p) => H(p.name)], ['Every', (p) => `${p.cycleMonths} months`], ['Class', (p) => H(p.travelClass)], ['Dependents', (p) => (p.includeDependents ? `up to ${p.maxDependents}` : 'no')], ['Destinations', (p) => p.fares.map((f) => `${f.iata} ${AED(f.adultFils)}`).join(' · ')]], pols, { empty: 'Create a policy with reference fares per destination.' }), isHR() ? btn('New policy', 'pol') : '')}</div>`;
      on(el, {
        dec: async (d) => { await C.api(`/airfare/requests/${d.id}/decision`, { method: 'POST', body: { decision: d.d } }); C.toast(d.d === 'approved' ? 'Approved. Encashments go through an off-cycle run for maker-checker approval.' : 'Rejected'); reload(); },
        accrue: () => formSheet('Accrue airfare', [{ k: 'period', label: 'Accrue up to month', type: 'month', value: thisMonth(), req: true }], async (v) => { const r = await C.api('/airfare/accrue', { method: 'POST', body: v }); C.toast(`${r.accounts} accounts · AED ${AED(r.totalFils)}`); reload(); }, 'Accrue'),
        acc: async () => formSheet('Assign airfare entitlement', [{ k: 'employeeId', label: 'Employee', type: 'select', options: await empOpts(), req: true }, { k: 'policyId', label: 'Policy', type: 'select', options: pols.map((p) => [p._id, p.name]), req: true }, { k: 'homeIata', label: 'Home airport (IATA)', ph: 'COK', req: true }, { k: 'dependentsCovered', label: 'Dependents covered', type: 'number', value: 0 }], async (v) => { v.homeIata = v.homeIata.toUpperCase(); await C.api('/airfare/accounts', { method: 'POST', body: v }); reload(); }),
        pol: () => formSheet('New airfare policy', [{ k: 'name', label: 'Name', req: true, value: 'Standard economy' }, { k: 'cycleMonths', label: 'Ticket every (months)', type: 'number', value: 12 }, { k: 'travelClass', label: 'Class', type: 'select', options: [['economy', 'Economy'], ['premium', 'Premium economy'], ['business', 'Business']] }, { k: 'maxDependents', label: 'Dependents covered (0 = none)', type: 'number', value: 0 }, { k: 'fares', label: 'Reference fares, one per line: IATA, adult AED, child AED', type: 'textarea', req: true, ph: 'COK, 1800, 1200\nMNL, 2200, 1500' }],
          async (v) => {
            const fares = v.fares.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0]).map(([iata, adult, child]) => ({ iata: iata.toUpperCase(), adult, child: child || adult }));
            await C.api('/airfare/policies', { method: 'POST', body: { name: v.name, cycleMonths: v.cycleMonths, travelClass: v.travelClass, includeDependents: (v.maxDependents || 0) > 0, maxDependents: v.maxDependents || 0, fares } }); reload();
          }, 'Create'),
      });
    }],
    ['acc', 'Journals & reconciliation', async (el, reload) => {
      const runs = (await C.api('/payroll/runs')).filter((r) => String(r.establishmentId) === String(estId()) || !estId());
      const sel = store.get('wasl_rec_run', runs[0]?._id);
      const run = runs.find((r) => r._id === sel) || runs[0];
      if (!run) { el.innerHTML = panel('Journals & reconciliation', '<div class="empty">Compute a payroll run first.</div>'); return; }
      const [rec, cmp] = await Promise.all([C.api(`/payroll/runs/${run._id}/reconciliation`), C.api(`/payroll/runs/${run._id}/compare`)]);
      const approved = ['approved', 'exported', 'paid'].includes(run.status);
      el.innerHTML = `<div class="xrow" style="margin-bottom:12px"><label class="lbl" for="rsel">Payroll run</label><select id="rsel" style="max-width:340px">${runs.map((r) => `<option value="${r._id}" ${r._id === run._id ? 'selected' : ''}>${H(r.period)} · ${H(r.type)}${r.runNo ? ` #${r.runNo}` : ''} · ${H(r.status.replace('_', ' '))}</option>`).join('')}</select></div>
      ${kpis([[AED(rec.runNetFils), 'Payroll net · AED'], [rec.sifTotalFils == null ? '—' : AED(rec.sifTotalFils), 'SIF total · AED'], [AED(rec.rejectedFils), 'Rejected by bank · AED'], [AED(rec.settledFils), 'Settled · AED']])}
      <div class="xgrid">${panel('Reconciliation checks', table([['Check', (c) => H(c.label)], ['Result', (c) => C.pill(c.ok ? 'p-ok' : 'p-bad', c.ok ? 'OK' : 'Needs attention')], ['Detail', (c) => `<span class="xmuted">${H(c.detail)}</span>`]], rec.checks), btn('Import bank rejections', 'rej', '', 'sm'))}
      ${panel('Bank rejections', table([['Employee', (x) => H(x.employeeName)], ['Amount', (x) => money(x.amountFils), 'r'], ['Reason', (x) => `${H(x.reasonCode || '')} ${H(x.reason || '')}`], ['Status', (x) => st(x.status)], ['', (x) => (x.status === 'open' ? btn('Resolve', 'resolve', `data-id="${x._id}"`) : `<span class="xmuted">${H(x.resolution || '')}</span>`)]], rec.rejections, { empty: 'No rejections imported for this run.' }))}
      ${panel(`Change vs ${cmp.prevPeriod || 'previous month'} (flag over ${cmp.thresholdPct}%)`, `<p class="xmuted">Total net ${AED(cmp.totals.netFils)} vs ${AED(cmp.totals.prevNetFils)} (${cmp.totals.deltaPct ?? '—'}%) · ${cmp.flagged} to review</p>` + table([['Employee', (r) => H(r.employeeName)], ['Now', (r) => money(r.netFils), 'r'], ['Before', (r) => (r.prevNetFils == null ? '—' : money(r.prevNetFils)), 'r'], ['Change', (r) => (r.deltaPct == null ? '—' : `${r.deltaPct}%`), 'r'], ['', (r) => C.pill(r.status === 'ok' ? 'p-ok' : r.status === 'over_threshold' ? 'p-warn' : 'p-n', r.status.replace('_', ' '))]], cmp.rows.filter((r) => r.status !== 'ok'), { empty: 'Every employee is within the variance threshold.' }))}
      ${panel('Accounting journal', `<p class="xmuted">${approved ? 'Balanced journal (debits = credits to the fils), cost centre by department.' : 'Available after the run is approved — preview only for now.'}</p><div class="xrow">${['xero', 'zoho', 'quickbooks', 'erp'].map((f) => btn({ xero: 'Xero CSV', zoho: 'Zoho Books CSV', quickbooks: 'QuickBooks CSV', erp: 'Generic ERP CSV' }[f], 'jr', `data-f="${f}"`, approved ? 'sm' : 'sm')).join('')}${btn('Preview lines', 'jprev')}${btn('Account codes', 'map')}${btn('FX view', 'fx')}</div><div id="jOut"></div>`)}</div>`;
      $('#rsel', el).onchange = (e) => { store.set('wasl_rec_run', e.target.value); reload(); };
      on(el, {
        rej: () => formSheet('Import bank rejection file', [{ k: 'csv', label: 'Paste the CSV (columns: labour card or IBAN, amount, reason code, reason)', type: 'textarea', rows: 8, req: true, ph: 'Labour Card,Amount,Reason Code,Reason\n94821370000001,8350.00,R03,Account closed' }], async (v, s) => {
          const p = await C.api(`/payroll/runs/${run._id}/rejections/import`, { method: 'POST', body: { csv: v.csv } });
          const bad = p.rows.filter((r) => !r.matched || r.problems.length);
          if (bad.length && !s.dataset.confirmed) { s.dataset.confirmed = '1'; throw new Error(`${p.rows.length - bad.length} rows match. Problems: ${bad.map((r) => `row ${r.row}: ${r.problems.join(' ')}`).join(' · ')} — press Import again to import the matched rows only.`); }
          const r = await C.api(`/payroll/runs/${run._id}/rejections/import`, { method: 'POST', body: { csv: v.csv, commit: true } }); C.toast(`${r.imported} rejections imported`); reload();
        }, 'Import'),
        resolve: (d) => formSheet('Resolve rejection', [{ k: 'status', label: 'Outcome', type: 'select', options: [['corrected', 'Bank details corrected'], ['repaid', 'Paid again'], ['written_off', 'Written off']] }, { k: 'resolution', label: 'Note', req: true, full: true }], async (v) => { await C.api(`/payroll/rejections/${d.id}/resolve`, { method: 'POST', body: v }); reload(); }),
        jr: (d) => download(`/payroll/runs/${run._id}/journal?format=${d.f}${approved ? '' : '&preview=1'}`, { filename: `journal-${run.period}.csv` }),
        jprev: async () => { const j = await C.api(`/payroll/runs/${run._id}/journal?json=1&preview=1`); $('#jOut', el).innerHTML = `<p class="xmuted">Debits ${AED(j.debitFils)} · Credits ${AED(j.creditFils)} · ${j.balanced ? 'balanced' : 'NOT balanced'}</p>` + table([['Account', (x) => H(x.account)], ['Cost centre', (x) => H(x.costCentre)], ['Debit', (x) => (x.debitFils ? money(x.debitFils) : ''), 'r'], ['Credit', (x) => (x.creditFils ? money(x.creditFils) : ''), 'r'], ['Memo', (x) => `<span class="xmuted">${H(x.memo)}</span>`]], j.lines.slice(0, 200)); },
        map: async () => { const m = await C.api('/accounting/mapping'); const keys = Object.keys(m.accounts || {}); formSheet('Account codes', [...keys.map((k) => ({ k, label: k.replace(/([A-Z])/g, ' $1').toLowerCase(), value: m.accounts[k] })), { k: 'costCentreBy', label: 'Cost centre', type: 'select', value: m.costCentreBy, options: [['department', 'Department'], ['establishment', 'Establishment'], ['none', 'None']] }], async (v) => { const { costCentreBy, ...accounts } = v; await C.api('/accounting/mapping', { method: 'PUT', body: { accounts, costCentreBy } }); C.toast('Saved'); }); },
        fx: async () => { const f = await C.api(`/payroll/runs/${run._id}/fx`); $('#jOut', el).innerHTML = `<p class="xmuted">${H(f.note)} Rates as of ${H(f.asOf)}.</p>` + table([['Currency', (x) => H(x.currency)], ['Rate (AED per unit)', (x) => (x.missing ? C.pill('p-warn', 'add a rate') : H(x.aedPerUnit)), 'r'], ['Gross', (x) => (x.missing ? '' : (x.gross / 100).toLocaleString('en', { minimumFractionDigits: 2 })), 'r'], ['Net', (x) => (x.missing ? '' : (x.net / 100).toLocaleString('en', { minimumFractionDigits: 2 })), 'r']], f.conversions) + btn('Add rate', 'rate'); },
        rate: () => formSheet('Add FX rate', [{ k: 'currency', label: 'Currency', ph: 'USD', req: true }, { k: 'date', label: 'Date', type: 'date', value: today(), req: true }, { k: 'aedPerUnit', label: 'AED per 1 unit', ph: '3.6725', req: true }], async (v) => { v.currency = v.currency.toUpperCase(); await C.api('/fx', { method: 'POST', body: v }); C.toast('Rate saved'); }),
      });
    }],
    ['pol', 'Policy', async (el, reload) => {
      const p = await C.api('/payroll/policy');
      el.innerHTML = panel('Payroll policy', `${C.kv([['Variance threshold', `${p.varianceThresholdPct}%`], ['Overtime needs approval', p.overtimeRequiresApproval ? 'Yes' : 'No'], ['Weekly rest day(s)', p.restDays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')], ['Standard hours / day', p.standardHoursPerDay], ['Reporting currencies', p.reportingCurrencies.join(', ')], ['FX conversion date', p.conversionDatePolicy.replace('_', ' ')]])}`, isHR() ? btn('Edit', 'edit', '', 'pri sm') : '');
      on(el, { edit: () => formSheet('Payroll policy', [{ k: 'varianceThresholdPct', label: 'Variance threshold %', type: 'number', value: p.varianceThresholdPct }, { k: 'standardHoursPerDay', label: 'Standard hours per day', type: 'number', value: p.standardHoursPerDay }, { k: 'restDays', label: 'Rest day', type: 'select', value: p.restDays[0], options: [[0, 'Sunday'], [5, 'Friday'], [6, 'Saturday']] }, { k: 'reportingCurrencies', label: 'Reporting currencies (comma separated)', value: p.reportingCurrencies.join(', ') }, { k: 'conversionDatePolicy', label: 'FX conversion date', type: 'select', value: p.conversionDatePolicy, options: [['period_end', 'Period end'], ['payment_date', 'Payment date']] }, { k: 'overtimeRequiresApproval', label: 'Overtime', type: 'check', text: 'Overtime must be approved before payroll', value: p.overtimeRequiresApproval }],
        async (v) => { await C.api('/payroll/policy', { method: 'PATCH', body: { ...v, restDays: [Number(v.restDays)], reportingCurrencies: v.reportingCurrencies.split(',').map((x) => x.trim().toUpperCase()).filter(Boolean) } }); reload(); }) });
    }],
  ]);
}

// ======================================================================= TIME & ROSTER
const weekStart = (d) => { const x = new Date(`${d}T00:00:00Z`); const wd = (x.getUTCDay() + 6) % 7; return addDays(d, -wd); };
async function timeplus() {
  return screen('timeplus', 'Time & roster', 'Shift templates, the roster, holidays, corrections, Face ID and attendance devices.', [
    ['roster', 'Roster', async (el, reload) => {
      const from = store.get('wasl_roster_from', weekStart(today())); const to = addDays(from, 13);
      const d = await C.api(`/roster?from=${from}&to=${to}${estId() ? `&establishmentId=${estId()}` : ''}`);
      const days = Array.from({ length: 14 }, (_, i) => addDays(from, i));
      const shifts = Object.fromEntries(d.shifts.map((s) => [s._id, s]));
      const entry = {}; d.entries.forEach((e) => (entry[`${e.employeeId}|${e.date}`] = e));
      const dirty = new Map(); let brush = d.shifts[0]?._id || 'rest';
      const cell = (emp, day) => {
        const k = `${emp}|${day}`; const e = dirty.has(k) ? dirty.get(k) : entry[k]; const lv = d.leave[emp]?.[day]; const hol = d.holidays[day];
        const inner = e?.clear ? '' : e?.restDay ? '<span class="rest">Rest</span>' : e?.shiftId && shifts[e.shiftId] ? `<span class="sh" style="background:${shifts[e.shiftId].color || 'var(--black)'}">${H(shifts[e.shiftId].code)}</span>` : '';
        return `<td class="cell ${lv ? 'lv' : ''} ${hol ? 'hol' : ''} ${dirty.has(k) ? 'dirty' : ''}" data-k="${k}" title="${H([hol, lv && `On ${lv} leave`].filter(Boolean).join(' · '))}">${inner || (lv ? 'Leave' : '')}</td>`;
      };
      const paint = () => {
        $('#rgrid', el).innerHTML = `<table class="roster"><thead><tr><th>Employee</th>${days.map((x) => `<th class="${d.holidays[x] ? 'hol' : ''}">${new Date(`${x}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}</th>`).join('')}</tr></thead><tbody>${d.employees.map((e) => `<tr><td>${H(e.fullName)}<div class="xmuted">${H(e.department || '')}${d.warnings[e._id]?.length ? ` · <span style="color:var(--warn)" title="${H(d.warnings[e._id].map((w) => w.msg).join(' · '))}">⚠ ${d.warnings[e._id].length}</span>` : ''}</div></td>${days.map((x) => cell(e._id, x)).join('')}</tr>`).join('')}</tbody></table>`;
        $('#rsave', el).disabled = !dirty.size; $('#rsave', el).textContent = dirty.size ? `Save ${dirty.size} change${dirty.size > 1 ? 's' : ''}` : 'Saved';
      };
      el.innerHTML = panel(`Roster · ${from} → ${to}`, `<div class="xrow" style="margin-bottom:10px"><button class="iconbtn" data-act="prev" aria-label="Previous two weeks">‹</button><button class="iconbtn" data-act="next" aria-label="Next two weeks">›</button><span class="xmuted">Paint:</span>
        <div class="brush" id="brush">${d.shifts.map((s) => `<button data-b="${s._id}" style="background:${s.color};color:#fff" title="${H(s.name)} · ${s.segments.map((g) => `${g.start}–${g.end}`).join(', ')}">${H(s.code)}</button>`).join('')}<button data-b="rest">Rest</button><button data-b="clear">Clear</button></div></div>
        <div class="tw" id="rgrid"></div><p class="xmuted">Click or drag across cells to paint the selected shift. Orange cells are public holidays, amber cells are approved leave.</p>`,
      `<button class="btn sm" data-act="copy">Copy last week here</button><button class="btn sm" id="rsave" data-act="save" disabled>Saved</button><button class="btn pri sm" data-act="pub">Publish</button>`);
      if (!d.shifts.length) $('#rgrid', el).insertAdjacentHTML('beforebegin', '<p class="err">Create a shift template first (Shifts tab).</p>');
      const setBrush = (b) => { brush = b; $$('#brush button', el).forEach((x) => x.classList.toggle('on', x.dataset.b === b)); };
      setBrush(brush); $('#brush', el).onclick = (e) => { const b = e.target.closest('[data-b]'); if (b) setBrush(b.dataset.b); };
      let painting = false;
      const paintCell = (td) => { if (!td?.dataset.k) return; const [emp, date] = td.dataset.k.split('|'); dirty.set(td.dataset.k, brush === 'rest' ? { employeeId: emp, date, restDay: true } : brush === 'clear' ? { employeeId: emp, date, clear: true } : { employeeId: emp, date, shiftId: brush, restDay: false }); };
      $('#rgrid', el).onpointerdown = (e) => { const td = e.target.closest('td.cell'); if (!td) return; painting = true; paintCell(td); paint(); };
      $('#rgrid', el).onpointerover = (e) => { if (!painting) return; const td = e.target.closest('td.cell'); if (td && !dirty.has(td.dataset.k)) { paintCell(td); paint(); } };
      window.addEventListener('pointerup', () => (painting = false), { once: false });
      paint();
      on(el, {
        prev: () => { store.set('wasl_roster_from', addDays(from, -14)); reload(); }, next: () => { store.set('wasl_roster_from', addDays(from, 14)); reload(); },
        save: async () => { await C.api('/roster', { method: 'PUT', body: { entries: [...dirty.values()] } }); C.toast('Roster saved (not yet visible to staff)'); reload(); },
        pub: async () => { if (dirty.size) await C.api('/roster', { method: 'PUT', body: { entries: [...dirty.values()] } }); const r = await C.api('/roster/publish', { method: 'POST', body: { from, to } }); C.toast(`Published · ${r.published} shifts sent to staff`); reload(); },
        copy: async () => { await C.api('/roster/copy-week', { method: 'POST', body: { fromWeekStart: addDays(from, -7), toWeekStart: from } }); reload(); },
      });
    }],
    ['shifts', 'Shifts', async (el, reload) => {
      const rows = await C.api('/shifts');
      el.innerHTML = panel('Shift templates', table([['Code', (s) => `<span class="pill" style="background:${s.color};color:#fff">${H(s.code)}</span>`], ['Name', (s) => H(s.name)], ['Times', (s) => s.segments.map((g) => `${g.start}–${g.end}`).join(' + ')], ['Break', (s) => `${s.breakMin} min${s.paidBreak ? ' (paid)' : ''}`], ['Hours', (s) => (s.minutes / 60).toFixed(1), 'r'], ['', (s) => (s.night ? C.pill('p-n', 'night') : '') + (s.segments.length > 1 ? C.pill('p-n', 'split') : '')], ['', (s) => (isHR() ? btn('Delete', 'del', `data-id="${s._id}"`) : '')]], rows, { empty: 'No shift templates yet.' }), isHR() ? btn('New shift', 'new', '', 'pri sm') : '');
      on(el, {
        new: () => formSheet('New shift', [{ k: 'name', label: 'Name', req: true, ph: 'Morning' }, { k: 'code', label: 'Short code', req: true, ph: 'M' }, { k: 's1', label: 'Start', type: 'time', value: '08:00', req: true }, { k: 'e1', label: 'End', type: 'time', value: '17:00', req: true }, { k: 's2', label: 'Split: second start (optional)', type: 'time' }, { k: 'e2', label: 'Split: second end', type: 'time' }, { k: 'breakMin', label: 'Unpaid break (min)', type: 'number', value: 60 }, { k: 'graceMin', label: 'Grace (min)', type: 'number', value: 15 }, { k: 'color', label: 'Colour', type: 'color', value: '#3b82f6' }],
          async (v) => { const segments = [{ start: v.s1, end: v.e1 }, ...(v.s2 && v.e2 ? [{ start: v.s2, end: v.e2 }] : [])]; await C.api('/shifts', { method: 'POST', body: { name: v.name, code: v.code, segments, breakMin: v.breakMin, graceMin: v.graceMin, color: v.color } }); reload(); }, 'Create', '<p class="xmuted">An end time earlier than the start means the shift runs past midnight.</p>'),
        del: (d) => confirmSheet('Delete shift', 'Delete this shift template?', async () => { await C.api(`/shifts/${d.id}`, { method: 'DELETE' }); reload(); }, 'Delete'),
      });
    }],
    ['hol', 'Holidays & Ramadan', async (el, reload) => {
      const year = new Date().getFullYear(); const [h, r] = await Promise.all([C.api(`/holidays?year=${year}`), C.api('/ramadan')]);
      el.innerHTML = `<div class="xgrid">${panel(`Public holidays ${year}`, table([['Date', (x) => H(x.date)], ['Holiday', (x) => `${H(x.name)} ${x.nameAr ? `<span class="xmuted">${H(x.nameAr)}</span>` : ''}`], ['', (x) => (x.estimated ? C.pill('p-warn', 'estimated') : '') + (x.builtIn ? C.pill('p-n', 'UAE default') : '')], ['', (x) => (!x.builtIn && isHR() ? btn('Remove', 'del', `data-id="${x._id}"`) : '')]], h), isHR() ? btn('Add holiday', 'add', '', 'pri sm') : '')}
        ${panel('Ramadan working hours', `<p>${r.activeToday ? C.pill('p-ok', 'Ramadan hours active today') : C.pill('p-n', 'Normal hours today')}</p><p class="xmuted">The working day shortens by 2 hours automatically on Ramadan dates (estimated, moon-sighting dependent). Your administrator can override this.</p>` + table([['Year', (p) => p.year], ['From', (p) => H(p.start)], ['To', (p) => H(p.end)], ['Reduction', (p) => `${p.reduceMin} min`]], r.periods, { empty: 'Using built-in dates.' }), isHR() ? btn('Add dates', 'ram') : '')}</div>`;
      on(el, {
        add: () => formSheet('Add public holiday', [{ k: 'date', label: 'Date', type: 'date', req: true }, { k: 'name', label: 'Name', req: true }, { k: 'nameAr', label: 'Name (Arabic)' }, { k: 'estimated', label: 'Estimated', type: 'check', text: 'Date depends on moon sighting' }], async (v) => { await C.api('/holidays', { method: 'POST', body: v }); reload(); }),
        del: async (d) => { await C.api(`/holidays/${d.id}`, { method: 'DELETE' }); reload(); },
        ram: () => formSheet('Ramadan dates', [{ k: 'year', label: 'Year', type: 'number', value: year + 1, req: true }, { k: 'start', label: 'First day', type: 'date', req: true }, { k: 'end', label: 'Last day', type: 'date', req: true }], async (v) => { await C.api('/ramadan', { method: 'POST', body: v }); reload(); }),
      });
    }],
    ['corr', 'Corrections', async (el, reload) => {
      const [disp, missed] = await Promise.all([C.api('/attendance/disputes'), C.api('/attendance/missed-punches')]);
      el.innerHTML = `<div class="xgrid">${panel('Correction requests', table([['Employee', (x) => H(x.employeeId?.fullName)], ['Date', (x) => H(x.date)], ['Request', (x) => `${H(x.kind.replace(/_/g, ' '))}${x.requestedIn ? ` · in ${H(x.requestedIn)}` : ''}${x.requestedOut ? ` · out ${H(x.requestedOut)}` : ''}<div class="xmuted">${H(x.reason)}</div>`], ['', (x) => btn('Approve', 'dec', `data-id="${x._id}" data-d="approved"`) + ' ' + btn('Reject', 'dec', `data-id="${x._id}" data-d="rejected"`)]], disp, { empty: 'No open correction requests.' }))}
        ${panel('Missed clock-outs (last 14 days)', table([['Employee', (x) => H(x.employee?.fullName)], ['Date', (x) => H(x.date)], ['Clocked in', (x) => (x.clockIn ? new Date(x.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '')]], missed, { empty: 'No missed punches.' }))}</div>`;
      on(el, { dec: (d) => formSheet(d.d === 'approved' ? 'Approve correction' : 'Reject correction', [...(d.d === 'approved' ? [{ k: 'clockIn', label: 'Clock in (optional override)', type: 'time' }, { k: 'clockOut', label: 'Clock out (optional override)', type: 'time' }] : []), { k: 'note', label: 'Note to the employee', full: true }], async (v) => { await C.api(`/attendance/disputes/${d.id}/decision`, { method: 'POST', body: { decision: d.d, ...v } }); C.toast('Done. The employee can see the change.'); reload(); }, d.d === 'approved' ? 'Approve' : 'Reject') });
    }],
    ['face', 'Face ID', async (el, reload) => {
      if (!isHR()) { el.innerHTML = panel('Face ID', '<p class="xmuted">Only HR can manage Face ID.</p>'); return; }
      const [d, kiosks, emps] = await Promise.all([C.api('/attendance/face', { fresh: true }), C.api('/attendance/kiosks', { fresh: true }), C.api('/employees')]);
      const enrolledIds = new Set(d.profiles.map((p) => String(p.employeeId?._id || p.employeeId)));
      const notEnrolled = emps.filter((e) => !enrolledIds.has(String(e._id)) && ['active', 'onboarding', 'notice'].includes(e.status || 'active'));
      const pass = d.recent.filter((x) => x.passed).length, failed = d.recent.length - pass;
      const buddy = d.recent.filter((x) => x.otherEmployeeId).length;
      el.innerHTML = `<div class="xkpis"><div class="xkpi"><b>${d.profiles.length}<small style="font-size:13px;color:var(--muted)"> / ${d.activeEmployees}</small></b><span>Employees enrolled</span></div>
        <div class="xkpi"><b>${pass}</b><span>Verified punches (latest 200)</span></div><div class="xkpi"><b>${failed}</b><span>Failed scans</span></div><div class="xkpi"><b style="color:${buddy ? 'var(--bad)' : 'inherit'}">${buddy}</b><span>Possible buddy punching</span></div></div>
        <div class="xgrid">${panel('Settings', `<div class="xrow"><label class="xrow" style="gap:8px"><input type="checkbox" id="fReq" ${d.settings.required ? 'checked' : ''}> Require Face ID for every clock-in and clock-out</label></div>
          <div class="xrow" style="margin-top:10px"><span class="xmuted">Match strictness</span><select id="fThr">${[[0.42, 'Strict'], [0.5, 'Balanced (recommended)'], [0.56, 'Lenient']].map(([v, l]) => `<option value="${v}" ${Math.abs(d.settings.threshold - v) < 0.01 ? 'selected' : ''}>${l}</option>`).join('')}</select>${btn('Save', 'save', '', 'pri sm')}</div>
          <p class="xmuted" style="margin:10px 0 0">Employees enroll from their own login (Attendance → Set up Face ID), or HR enrolls them in person below, with a 360° scan on any phone or laptop camera. Only a numeric face signature is stored, never images. When required, employees who have not enrolled are asked to do it at their next clock-in.</p>`)}
        ${panel('Shared tablet link · Look & Verify', `<p class="xmuted" style="margin:0 0 10px">For shops and sites where staff keep phones in lockers: open the link once on a tablet at the entrance. Staff just look at it, get a green tick, and their clock-in or clock-out lands in Attendance and the roster immediately. No login needed.</p>
          ${table([['Tablet', (x) => `<b>${H(x.name)}</b>${x.establishmentId?.name ? ` <span class="xmuted">${H(x.establishmentId.name)}</span>` : ''}`], ['Last seen', (x) => (x.lastSeenAt ? new Date(x.lastSeenAt).toLocaleString('en-GB') : 'never')], ['Status', (x) => st(x.active ? 'active' : 'disabled')], ['', (x) => btn(x.active ? 'Turn off' : 'Turn on', 'ktog', `data-id="${x._id}" data-on="${x.active ? '' : '1'}"`)]], kiosks, { empty: 'No tablet linked yet.' })}
          <div class="xrow" style="margin-top:10px">${btn('Create tablet link', 'knew', '', 'pri sm')}</div>`)}
        ${panel('Enroll an employee in person', `<p class="xmuted" style="margin:0 0 10px">For staff without a login or phone. Have them stand in front of this device's camera for a 20-second scan.</p>
          <div class="xrow"><select id="fEnrollEmp">${notEnrolled.length ? notEnrolled.map((e) => `<option value="${e._id}" data-name="${H(e.fullName)}">${H(e.fullName)} · ${H(e.employeeNo || '')}</option>`).join('') : '<option value="">Everyone is enrolled</option>'}</select>${btn('Scan face', 'enroll', '', 'pri sm')}</div>`)}
        ${panel('Enrolled employees', table([['Employee', (x) => `${H(x.employeeId?.fullName || '')} <span class="xmuted">${H(x.employeeId?.employeeNo || '')}</span>`], ['Enrolled', (x) => (x.enrolledAt ? new Date(x.enrolledAt).toLocaleDateString('en-GB') : '')], ['Angles', (x) => H((x.angles || []).join(', '))], ['Verified', (x) => H(x.verifications || 0)], ['Failed', (x) => H(x.failures || 0)], ['Last used', (x) => (x.lastVerifiedAt ? new Date(x.lastVerifiedAt).toLocaleString('en-GB') : '—')], ['', (x) => btn('Reset', 'reset', `data-id="${x.employeeId?._id || x.employeeId}"`)]], d.profiles, { empty: 'Nobody has enrolled yet.' }))}
        ${panel('Recent scans', table([['Employee', (x) => H(x.employeeId?.fullName || '')], ['When', (x) => new Date(x.createdAt).toLocaleString('en-GB')], ['Punch', (x) => H(x.direction === 'out' ? 'Clock out' : 'Clock in')], ['Result', (x) => st(x.passed ? 'pass' : 'failed')], ['Match', (x) => `${H(x.confidence ?? '')}%`], ['Detail', (x) => `<span class="xmuted">${H(x.otherEmployeeId ? `Matched ${x.otherEmployeeId.fullName}` : (x.reasons || []).join(' '))}${x.passed && !x.usedAt ? ' · not used' : ''}</span>`]], d.recent, { empty: 'No scans yet.' }))}</div>`;
      on(el, {
        save: async () => { await C.api('/attendance/face/settings', { method: 'PUT', body: { required: el.querySelector('#fReq').checked, threshold: Number(el.querySelector('#fThr').value) } }); C.toast('Face ID settings saved'); reload(); },
        reset: async (x) => { await C.api(`/attendance/face/${x.id}`, { method: 'DELETE' }); C.toast('Face ID reset. The employee will rescan.'); reload(); },
        enroll: async () => { const sel = el.querySelector('#fEnrollEmp'); if (!sel.value) return; if (await window.waslFace.hrEnroll(sel.value, sel.selectedOptions[0].dataset.name)) reload(); },
        ktog: async (x) => { await C.api(`/attendance/kiosks/${x.id}`, { method: 'PATCH', body: { active: !!x.on } }); reload(); },
        knew: () => formSheet('Create tablet link', [{ k: 'name', label: 'Tablet name', req: true, ph: 'Dubai Mall store entrance' }, { k: 'establishmentId', label: 'Site (only its staff can clock in here)', type: 'select', options: [['', 'All sites'], ...estOpts()] }], async (v) => {
          const r = await C.api('/attendance/kiosks', { method: 'POST', body: { name: v.name, ...(v.establishmentId ? { establishmentId: v.establishmentId } : {}) } });
          let qr = ''; try { const { default: qrcode } = await import('./vendor/qrcode.mjs'); const q = qrcode(0, 'M'); q.addData(r.url); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 2 }); } catch { /* QR optional */ }
          C.sheetForm('Tablet link ready', `<p>Open this link once on the tablet (or scan the QR with it). The tablet remembers it.</p><div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap"><div style="background:#fff;padding:6px;border-radius:10px;line-height:0">${qr}</div><div style="flex:1;min-width:220px"><input readonly value="${H(r.url)}" style="width:100%;font:inherit;font-size:12px;padding:8px;border-radius:8px;border:1px solid var(--line-2);background:var(--surface-2);color:var(--ink)" onclick="this.select()"><p class="xmuted" style="margin:8px 0 0">${H(r.note)}</p></div></div>`, async () => { try { await navigator.clipboard.writeText(r.url); C.toast('Link copied'); } catch { /* ignore */ } reload(); }, 'Copy link');
        }, 'Create link'),
      });
    }],
    ['dev', 'Devices', async (el, reload) => {
      const [devs, live] = await Promise.all([isHR() ? C.api('/attendance/devices') : [], isHR() ? C.api('/attendance/liveness') : []]);
      el.innerHTML = `<div class="xgrid">${panel('Biometric devices', table([['Name', (x) => H(x.name)], ['Vendor', (x) => H(x.vendor)], ['Key', (x) => `<code>${H(x.keyId)}</code>`], ['Last seen', (x) => (x.lastSeenAt ? new Date(x.lastSeenAt).toLocaleString('en-GB') : 'never')], ['Status', (x) => st(x.active ? 'active' : 'disabled')], ['', (x) => btn(x.active ? 'Disable' : 'Enable', 'tog', `data-id="${x._id}" data-on="${x.active ? '' : '1'}"`)]], devs, { empty: 'No devices registered. ZKTeco (ADMS) and Hikvision terminals can push punches here.' }), isHR() ? btn('Register device', 'new', '', 'pri sm') : '')}
        ${panel('Selfie liveness checks', table([['Employee', (x) => H(x.employeeId?.fullName)], ['When', (x) => new Date(x.createdAt).toLocaleString('en-GB')], ['Challenge', (x) => H(x.challenge)], ['Result', (x) => st(x.passed === true ? 'pass' : x.passed === false ? 'failed' : 'review')], ['Detail', (x) => `<span class="xmuted">${H(x.detail || '')}</span>`]], live, { empty: 'No liveness checks yet.' }))}</div>`;
      on(el, {
        new: () => formSheet('Register device', [{ k: 'name', label: 'Name', req: true, ph: 'Warehouse gate' }, { k: 'vendor', label: 'Vendor', type: 'select', options: [['zkteco', 'ZKTeco'], ['hikvision', 'Hikvision'], ['generic', 'Other / custom']] }, { k: 'serial', label: 'Serial number' }, { k: 'establishmentId', label: 'Site', type: 'select', options: estOpts() }], async (v) => {
          const r = await C.api('/attendance/devices', { method: 'POST', body: v });
          C.sheetForm('Device credentials', `<p>${H(r.note)}</p>${C.kv([['Push URL', `<code>${H(location.origin + r.pushUrl)}</code>`], ['Key (X-Wasl-Key)', `<code>${H(r.keyId)}</code>`], ['Secret', `<code>${H(r.secret)}</code>`]])}`, async () => reload(), 'Done');
        }, 'Register'),
        tog: async (d) => { await C.api(`/attendance/devices/${d.id}`, { method: 'PATCH', body: { active: !!d.on } }); reload(); },
      });
    }],
  ]);
}

// ======================================================================= PEOPLE OPS
async function people() {
  return screen('people', 'People operations', 'Expenses, visas and government processes, insurance, assets and dependents.', [
    ['exp', 'Expenses', async (el, reload) => {
      const rows = await C.api('/expenses');
      const pend = rows.filter((r) => ['submitted', 'manager_approved'].includes(r.status));
      el.innerHTML = kpis([[pend.length, 'Waiting for approval'], [AED(rows.filter((r) => r.status === 'approved').reduce((a, r) => a + r.totalFils, 0)), 'Approved, not yet paid · AED'], [rows.filter((r) => r.flags?.length).length, 'Flagged claims']]) + panel('Expense claims', table([
        ['Employee', (r) => `${H(r.employeeId?.fullName)}<div class="xmuted">${H(r.employeeId?.department || '')}</div>`], ['Merchant', (r) => `${H(r.merchant)}<div class="xmuted">${H(r.category)} · ${d10(r.receiptDate)}</div>`],
        ['Total', (r) => money(r.totalFils), 'r'], ['VAT', (r) => money(r.vatFils), 'r'], ['Flags', (r) => (r.flags || []).map((f) => C.pill('p-warn', f.replace(/_/g, ' ').toLowerCase())).join(' ')], ['Status', (r) => st(r.status)],
        ['', (r) => (r.receipt?.storageKey ? btn('Receipt', 'rec', `data-id="${r._id}"`) : '') + (['submitted', 'manager_approved'].includes(r.status) ? ` ${btn('Approve', 'dec', `data-id="${r._id}" data-d="approve"`)} ${btn('Reject', 'dec', `data-id="${r._id}" data-d="reject"`)}` : '')],
      ], rows, { empty: 'No expense claims yet. Employees submit them from Services.' }));
      on(el, { rec: (d) => openPdf(`/expenses/${d.id}/receipt`), dec: (d) => formSheet(d.d === 'approve' ? 'Approve claim' : 'Reject claim', [{ k: 'note', label: 'Note (optional)', full: true }], async (v) => { const r = await C.api(`/expenses/${d.id}/decision`, { method: 'POST', body: { decision: d.d, ...v } }); C.toast(`Claim ${r.status.replace(/_/g, ' ')}`); reload(); }, d.d === 'approve' ? 'Approve' : 'Reject') });
    }],
    ['visa', 'Visas & PRO', async (el, reload) => {
      const cases = await C.api('/immigration/cases');
      const steps = (c) => `<div class="steps" style="flex-wrap:wrap">${c.steps.map((s) => { const ready = c.readiness.find((x) => x.key === s.key)?.ready; return `<span class="${s.status === 'done' || s.status === 'skipped' ? 'done' : ready ? 'on' : ''}" title="${H(`${s.name} · ${s.owner}${s.dueDate ? ` · due ${d10(s.dueDate)}` : ''}${s.rejectionReason ? ` · ${s.rejectionReason}` : ''}`)}" ${isHR() ? `data-act="step" data-id="${c._id}" data-k="${s.key}" data-n="${H(s.name)}" style="cursor:pointer"` : ''}>${s.status === 'rejected' ? '✖ ' : ''}${H(s.name)}</span>`; }).join('')}</div>`;
      el.innerHTML = kpis([[cases.length, 'Open cases'], [cases.reduce((a, c) => a + c.overdue, 0), 'Overdue steps'], [AED(cases.reduce((a, c) => a + c.costFils, 0)), 'Fees logged · AED']]) +
        panel('Visa & government cases', cases.length ? cases.map((c) => `<div style="padding:12px 0;border-bottom:1px solid var(--line)"><div class="xsec"><div><b>${H(c.subjectName || c.employeeId?.fullName)}</b> <span class="xmuted">${H(c.kind.replace(/_/g, ' '))} · ${H(c.jurisdiction)}</span> ${st(c.status)} ${c.overdue ? C.pill('p-bad', `${c.overdue} overdue`) : ''}</div><div class="xrow">${isHR() ? btn('Cancel case', 'cancel', `data-id="${c._id}"`) : ''}</div></div>${steps(c)}</div>`).join('') : '<div class="empty">No open cases. New hires from signed offers open one automatically.</div>', isHR() ? btn('New case', 'new', '', 'pri sm') : '');
      on(el, {
        new: async () => formSheet('New visa / PRO case', [{ k: 'kind', label: 'Process', type: 'select', options: [['renewal', 'Residence visa renewal'], ['cancellation', 'Visa cancellation'], ['transfer', 'Transfer'], ['dependent_new', 'Dependent visa (new)'], ['dependent_renewal', 'Dependent visa renewal'], ['golden_visa', 'Golden visa'], ['new_hire', 'New hire']] }, { k: 'employeeId', label: 'Employee', type: 'select', options: await empOpts() }, { k: 'startDate', label: 'Start date (new hires)', type: 'date' }, { k: 'graceUntil', label: 'Grace period ends (cancellations)', type: 'date' }], async (v) => { await C.api('/immigration/cases', { method: 'POST', body: v }); reload(); }, 'Open case'),
        step: (d) => formSheet(d.n, [{ k: 'status', label: 'Status', type: 'select', options: [['in_progress', 'In progress'], ['submitted', 'Submitted'], ['done', 'Done'], ['rejected', 'Rejected'], ['skipped', 'Not needed']] }, { k: 'dueDate', label: 'Due date', type: 'date' }, { k: 'cost', label: 'Fee paid (AED)', type: 'number', step: '0.01' }, { k: 'reference', label: 'Application / receipt no.' }, { k: 'rejectionReason', label: 'Rejection reason (if rejected)', full: true }], async (v) => { await C.api(`/immigration/cases/${d.id}/steps/${d.k}`, { method: 'PATCH', body: v }); reload(); }, 'Update'),
        cancel: (d) => confirmSheet('Cancel case', 'Cancel this case? Steps stay in the history.', async () => { await C.api(`/immigration/cases/${d.id}/cancel`, { method: 'POST' }); reload(); }, 'Cancel case'),
      });
    }],
    ['ins', 'Insurance & perks', async (el, reload) => {
      const [pols, mem, reqs, perks] = await Promise.all([C.api('/insurance/policies'), C.api('/insurance/members'), isHR() ? C.api('/benefits/requests') : [], C.api('/perks')]);
      el.innerHTML = `<div class="xgrid">${panel('Requests from employees', table([['Employee', (r) => H(r.employeeId?.fullName)], ['Request', (r) => `${H(r.kind.replace(/_/g, ' '))}${r.dependent?.name ? ` · ${H(r.dependent.name)} (${H(r.dependent.relation)})` : ''}<div class="xmuted">${H(r.notes || '')}</div>`], ['Status', (r) => st(r.status)], ['', (r) => btn('Sent to broker', 'rs', `data-id="${r._id}" data-s="sent_to_broker"`) + ' ' + btn('Done', 'rs', `data-id="${r._id}" data-s="done"`) + ' ' + btn('Reject', 'rs', `data-id="${r._id}" data-s="rejected"`)]], reqs, { empty: 'No open insurance requests.' }))}
        ${panel('Policies', table([['Insurer', (p) => `${H(p.insurer)}<div class="xmuted">${H(p.plan || '')} ${H(p.tpa ? `· TPA ${p.tpa}` : '')}</div>`], ['Policy no.', (p) => H(p.policyNo || '')], ['Valid', (p) => `${d10(p.startDate)} → ${d10(p.endDate)}`], ['Network', (p) => `${p.network?.length || 0} providers`, 'r'], ['Members', (p) => mem.filter((m) => m.policyId === p._id && m.status !== 'removed').length, 'r'], ['', (p) => (isHR() ? btn('Add member', 'mem', `data-id="${p._id}"`) + ' ' + btn('Upload network', 'net', `data-id="${p._id}"`) : '')]], pols, { empty: 'Add your group medical policy.' }), isHR() ? btn('New policy', 'pol', '', 'pri sm') : '')}
        ${panel('Perks directory', table([['Perk', (p) => `<b>${H(p.title)}</b><div class="xmuted">${H(p.description || '')}</div>`], ['Provider', (p) => H(p.provider || '')], ['Category', (p) => H(p.category || '')], ['Code', (p) => (p.code ? `<code>${H(p.code)}</code>` : '')]], perks, { empty: 'No perks yet.' }), isHR() ? btn('Add perk', 'perk') : '')}</div>`;
      on(el, {
        rs: async (d) => { await C.api(`/benefits/requests/${d.id}/status`, { method: 'POST', body: { status: d.s } }); reload(); },
        pol: () => formSheet('New insurance policy', [{ k: 'insurer', label: 'Insurer', req: true }, { k: 'tpa', label: 'TPA' }, { k: 'plan', label: 'Plan' }, { k: 'policyNo', label: 'Policy no.' }, { k: 'startDate', label: 'Start', type: 'date' }, { k: 'endDate', label: 'End', type: 'date' }, { k: 'premiumPerMember', label: 'Premium per member (AED)', type: 'number', step: '0.01' }, { k: 'brokerContact', label: 'Broker contact' }], async (v) => { await C.api('/insurance/policies', { method: 'POST', body: v }); reload(); }, 'Create'),
        mem: async (d) => formSheet('Add member', [{ k: 'employeeId', label: 'Employee', type: 'select', options: await empOpts(), req: true }, { k: 'relation', label: 'Member', type: 'select', options: [['self', 'Employee'], ['spouse', 'Spouse'], ['child', 'Child'], ['parent', 'Parent']] }, { k: 'memberName', label: 'Member name (dependents)' }, { k: 'cardNo', label: 'Card number' }, { k: 'validTo', label: 'Valid to', type: 'date' }], async (v) => { await C.api('/insurance/members', { method: 'POST', body: { ...v, policyId: d.id } }); reload(); }),
        net: (d) => formSheet('Upload provider network', [{ k: 'csv', label: 'CSV: name, type (hospital/clinic/pharmacy/lab), emirate, area, phone, direct billing (yes/no)', type: 'textarea', rows: 8, req: true }], async (v) => { const network = v.csv.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((x) => x[0] && x[1]).map(([name, type, emirate, area, phone, db]) => ({ name, type: type.toLowerCase(), emirate, area, phone, directBilling: !/^n/i.test(db || 'yes') })); await C.api(`/insurance/policies/${d.id}/network`, { method: 'POST', body: { network } }); C.toast(`${network.length} providers saved`); reload(); }, 'Upload'),
        perk: () => formSheet('Add perk', [{ k: 'title', label: 'Title', req: true }, { k: 'provider', label: 'Provider' }, { k: 'category', label: 'Category', ph: 'Dining, fitness…' }, { k: 'code', label: 'Discount code' }, { k: 'url', label: 'Link', type: 'url' }, { k: 'validTo', label: 'Valid to', type: 'date' }, { k: 'description', label: 'Description', type: 'textarea' }], async (v) => { await C.api('/perks', { method: 'POST', body: v }); reload(); }),
      });
    }],
    ['assets', 'Assets', async (el, reload) => {
      const [assets, reqs] = await Promise.all([C.api('/assets'), isHR() ? C.api('/asset-requests') : []]);
      el.innerHTML = `<div class="xgrid">${panel('Requests', table([['Employee', (r) => H(r.employeeId?.fullName)], ['Needs', (r) => H(r.kind)], ['By', (r) => d10(r.neededBy)], ['Why', (r) => `<span class="xmuted">${H(r.reason)}</span>`]], reqs, { empty: 'No open asset requests.' }))}
        ${panel('Company assets', table([['Tag', (a) => `<b>${H(a.tag)}</b>`], ['Item', (a) => `${H(a.kind)} <span class="xmuted">${H(a.model || '')}</span>`], ['Serial', (a) => H(a.serial || '')], ['Holder', (a) => H(a.assignedTo?.fullName || '—')], ['Status', (a) => st(a.status === 'assigned' ? 'active' : a.status)], ['', (a) => (isHR() ? (a.status === 'assigned' ? btn('Return', 'ret', `data-id="${a._id}"`) : btn('Assign', 'asg', `data-id="${a._id}"`)) : '')]], assets, { empty: 'No assets registered.' }), isHR() ? btn('Add asset', 'new', '', 'pri sm') : '')}</div>`;
      on(el, {
        new: () => formSheet('Add asset', [{ k: 'tag', label: 'Asset tag', req: true }, { k: 'kind', label: 'Type', type: 'select', options: ['laptop', 'phone', 'sim', 'vehicle', 'access_card', 'tools', 'uniform', 'other'].map((x) => [x, x.replace('_', ' ')]) }, { k: 'model', label: 'Model' }, { k: 'serial', label: 'Serial' }, { k: 'value', label: 'Value (AED)', type: 'number', step: '0.01' }, { k: 'purchasedAt', label: 'Purchased', type: 'date' }], async (v) => { await C.api('/assets', { method: 'POST', body: v }); reload(); }, 'Add'),
        asg: async (d) => formSheet('Assign asset', [{ k: 'employeeId', label: 'Employee', type: 'select', options: await empOpts(), req: true }, { k: 'note', label: 'Note' }], async (v) => { await C.api(`/assets/${d.id}/assign`, { method: 'POST', body: v }); reload(); }, 'Assign'),
        ret: (d) => formSheet('Return asset', [{ k: 'condition', label: 'Condition', type: 'select', options: [['in_stock', 'Back in stock'], ['repair', 'Needs repair'], ['lost', 'Lost'], ['retired', 'Retire']] }, { k: 'note', label: 'Note' }], async (v) => { await C.api(`/assets/${d.id}/return`, { method: 'POST', body: v }); reload(); }, 'Return'),
      });
    }],
    ['deps', 'Dependents', async (el) => {
      const rows = isHR() ? await C.api('/dependents/expiring?days=120') : [];
      el.innerHTML = panel('Dependent documents expiring in 120 days', table([['Employee', (x) => H(x.employeeId?.fullName)], ['Dependent', (x) => `${H(x.name)} <span class="xmuted">${H(x.relation)}</span>`], ['Residence', (x) => d10(x.residenceExpiry)], ['Emirates ID', (x) => d10(x.emiratesIdExpiry)], ['Passport', (x) => d10(x.passportExpiry)], ['Sponsor', (x) => H(x.sponsor)]], rows, { empty: 'Nothing expiring soon. Add dependents from an employee profile or the Dependents API.' }));
    }],
  ]);
}

// ======================================================================= TALENT
async function talent() {
  return screen('talent', 'Talent', 'AI hiring agent, requisitions, offers, performance and engagement.', [
    ['agent', 'AI hiring agent', async (el, reload) => {
      const runs = isHR() ? await C.api('/agent2/runs') : [];
      el.innerHTML = `${panel('Describe the hire', `<form id="agf" class="xrow"><input id="agq" style="flex:1;min-width:260px" placeholder="Hire Omar Al-Maktoum as Senior Frontend Engineer starting 1 Dec, AED 22,000 (60% basic, 30% housing, 10% transport), omar@example.com" required><button class="btn pri" ${isHR() ? '' : 'disabled'}>Plan</button></form><p class="xmuted">The agent plans the whole workflow (package check, offer letter, e-signature link, visa tracker, IT assets, probation reviews). Nothing happens until you approve.</p><div id="agOut"></div>`)}
        <div style="height:16px"></div>${panel('Recent agent runs', table([['When', (r) => new Date(r.createdAt).toLocaleString('en-GB')], ['Command', (r) => `<span class="xmuted">${H(r.command)}</span>`], ['Status', (r) => st(r.status)]], runs, { empty: 'No runs yet.' }))}`;
      const show = (p) => {
        const icon = { ok: '✓', done: '✓', blocked: '!', pending: '·', scheduled: '◷', skipped: '–' };
        $('#agOut', el).innerHTML = `<div class="panel" style="margin-top:12px;background:var(--surface-2)">
          <div class="xrow" style="margin-bottom:8px"><b>${H(p.params.candidateName || '?')}</b> · ${H(p.params.jobTitle || '?')} · ${p.validation.comp ? `AED ${AED(p.validation.comp.totalFils)}${p.validation.comp.grade ? ` · grade ${H(p.validation.comp.grade)}` : ''}` : ''} · start ${H(p.params.startDate || '?')} · ${H(p.establishment?.name || 'no establishment')} <span class="xmuted">(${p.engine === 'claude' ? 'AI' : 'rules'} parser)</span></div>
          ${p.plan.steps.map((s) => `<div class="planstep ${s.status}"><span class="dot">${icon[s.status] || '·'}</span><div><b>${H(s.label)}</b>${s.detail ? `<div class="xmuted">${H(s.detail)}</div>` : ''}</div></div>`).join('')}
          ${p.validation.comp ? `<p class="xmuted">Basic ${AED(p.validation.comp.basicFils)} · Housing ${AED(p.validation.comp.housingFils)} · Transport ${AED(p.validation.comp.transportFils)}</p>` : ''}
          <div class="xrow">${p.validation.ok ? `<input id="agEmail" type="email" placeholder="Candidate email" value="${H(p.params.candidateEmail || '')}" style="max-width:260px">${btn('Approve & run', 'exec', `data-id="${p.id}"`, 'pri sm')}` : `<span class="err">${H(p.validation.issues.join(' '))}</span>`}${btn('Discard', 'disc', `data-id="${p.id}"`)}</div></div>`;
      };
      $('#agf', el).onsubmit = async (e) => { e.preventDefault(); try { $('#agOut', el).innerHTML = '<p class="xmuted">Planning…</p>'; show(await C.api('/agent2/propose', { method: 'POST', body: { command: $('#agq', el).value, establishmentId: estId() } })); } catch (err) { $('#agOut', el).innerHTML = `<p class="err">${H(err.message)}</p>`; } };
      on(el, {
        exec: async (d) => { const r = await C.api(`/agent2/${d.id}/execute`, { method: 'POST', body: { candidateEmail: $('#agEmail', el)?.value || undefined, sendNow: true } }); C.toast(r.message); $('#agOut', el).innerHTML = `<div class="panel" style="margin-top:12px">${r.steps.map((s) => `<div class="planstep ${s.status}"><span class="dot">${s.status === 'done' ? '✓' : '◷'}</span><div><b>${H(s.label)}</b><div class="xmuted">${H(s.detail || '')}</div></div></div>`).join('')}</div>`; },
        disc: async (d) => { await C.api(`/agent2/${d.id}/discard`, { method: 'POST' }); reload(); },
      });
    }],
    ['req', 'Requisitions', async (el, reload) => {
      const [reqs, bands] = await Promise.all([C.api('/requisitions'), C.api('/grade-bands')]);
      el.innerHTML = `<div class="xgrid">${panel('Job requisitions', table([['Role', (r) => `<b>${H(r.title)}</b><div class="xmuted">${H(r.department || '')} · ${r.headcount} position${r.headcount > 1 ? 's' : ''}${r.grade ? ` · ${H(r.grade)}` : ''}</div>`], ['Candidates', (r) => r.candidates, 'r'], ['Status', (r) => st(r.status)],
        ['', (r) => (r.status === 'pending_approval' && isHR() ? btn('Approve', 'dec', `data-id="${r._id}" data-d="approve"`) + ' ' + btn('Reject', 'dec', `data-id="${r._id}" data-d="reject"`) : ['approved', 'on_hold'].includes(r.status) && isHR() ? btn('Publish to careers page', 'pub', `data-id="${r._id}" data-o="1"`) : r.status === 'open' && isHR() ? btn('Unpublish', 'pub', `data-id="${r._id}"`) + ' ' + btn('Close', 'close', `data-id="${r._id}"`) : '') + (r.candidates ? ' ' + btn('Pipeline', 'pipe', `data-id="${r._id}" data-t="${H(r.title)}"`) : '')]], reqs, { empty: 'No requisitions.' }), btn('Careers page', 'careers') + btn('New requisition', 'new', '', 'pri sm'))}
        <div id="pipe"></div>
        ${panel('Grade bands', table([['Grade', (b) => `<b>${H(b.grade)}</b> <span class="xmuted">${H(b.title || '')}</span>`], ['Monthly package', (b) => `${AED(b.minFils)} – ${AED(b.maxFils)}`, 'r'], ['Min basic', (b) => `${b.basicPctMin}%`, 'r']], bands, { empty: 'Add grade bands so the agent and offers can check packages.' }), isHR() ? btn('Add / edit band', 'band') : '')}</div>`;
      on(el, {
        new: () => formSheet('New requisition', [{ k: 'title', label: 'Job title', req: true }, { k: 'department', label: 'Department' }, { k: 'establishmentId', label: 'Establishment', type: 'select', options: estOpts() }, { k: 'headcount', label: 'Positions', type: 'number', value: 1 }, { k: 'grade', label: 'Grade', type: 'select', options: [['', '—'], ...bands.map((b) => [b.grade, b.grade])] }, { k: 'location', label: 'Location' }, { k: 'requirements', label: 'Key skills (comma separated, used for CV matching)', full: true }, { k: 'description', label: 'Description', type: 'textarea', rows: 5 }], async (v) => { await C.api('/requisitions', { method: 'POST', body: { ...v, requirements: (v.requirements || '').split(',').map((x) => x.trim()).filter(Boolean) } }); C.toast('Sent for approval'); reload(); }, 'Submit for approval'),
        dec: async (d) => { await C.api(`/requisitions/${d.id}/decision`, { method: 'POST', body: { decision: d.d } }); reload(); },
        pub: async (d) => { const r = await C.api(`/requisitions/${d.id}/publish`, { method: 'POST', body: { open: !!d.o } }); if (d.o) C.toast('Published on your careers page'); reload(); return r; },
        close: async (d) => { await C.api(`/requisitions/${d.id}/close`, { method: 'POST' }); reload(); },
        careers: () => { const tid = C.tenantId(); C.sheetForm('Your careers page', `<p>Share this link. Candidates apply there and appear in the pipeline with a CV match score.</p><p><code style="word-break:break-all">${H(`${location.origin}/careers.html#${tid}`)}</code></p>`, async () => {}, 'Close'); },
        band: () => formSheet('Grade band', [{ k: 'grade', label: 'Grade', req: true, ph: 'G5' }, { k: 'title', label: 'Title', ph: 'Senior' }, { k: 'min', label: 'Minimum package (AED / month)', type: 'number', req: true }, { k: 'max', label: 'Maximum package (AED / month)', type: 'number', req: true }, { k: 'basicPctMin', label: 'Minimum basic %', type: 'number', value: 50 }], async (v) => { await C.api('/grade-bands', { method: 'POST', body: v }); reload(); }),
        pipe: async (d) => {
          const p = await C.api(`/requisitions/${d.id}/pipeline`);
          $('#pipe', el).innerHTML = panel(`Pipeline · ${d.t}`, `<div class="kanban">${Object.entries(p).map(([stage, list]) => `<div class="kcol"><header><b>${H(stage)}</b><span class="kcount">${list.length}</span></header><div class="kcards">${list.map((a) => `<div class="kcard"><b>${H(a.name)}</b><div class="xmuted">${H(a.email || '')}</div>${a.profile?.match ? `<div class="xrow" style="margin-top:6px"><div class="xprog" style="flex:1"><i style="width:${a.profile.match.score}%"></i></div><small>${a.profile.match.score}</small></div><div class="xmuted" style="font-size:11px">${H((a.profile.match.reasons || []).slice(0, 3).join(' · '))}</div>` : ''}${stage === 'offer' || stage === 'interviewed' ? btn('Make offer', 'offerFor', `data-name="${H(a.name)}" data-email="${H(a.email || '')}" data-ap="${a._id}" data-req="${d.id}"`) : ''}</div>`).join('') || '<div class="kempty">—</div>'}</div></div>`).join('')}</div><p class="xmuted">Move candidates between stages from the Applicant tracker.</p>`);
        },
        offerFor: (d) => offerForm({ candidateName: d.name, candidateEmail: d.email, applicantId: d.ap, requisitionId: d.req }, () => { C.toast('Offer drafted — see the Offers tab'); }),
      });
    }],
    ['offers', 'Offers', async (el, reload) => {
      const rows = await C.api('/offers');
      el.innerHTML = panel('Offer letters', table([['Candidate', (o) => `<b>${H(o.candidateName)}</b><div class="xmuted">${H(o.candidateEmail || '')}</div>`], ['Role', (o) => `${H(o.jobTitle)}${o.grade ? ` · ${H(o.grade)}` : ''}`], ['Start', (o) => d10(o.startDate)], ['Monthly', (o) => money(o.basicFils + o.housingFils + o.transportFils + (o.otherFils || 0)), 'r'], ['Status', (o) => st(o.status) + (o.validation?.issues?.length ? ` ${C.pill('p-bad', 'fix needed')}` : '') + (o.documents?.length ? ` <span class="xmuted">${o.documents.length} docs</span>` : '')],
        ['', (o) => btn('PDF', 'pdf', `data-id="${o._id}"`) + (['draft', 'expired'].includes(o.status) && isHR() ? ' ' + btn('Send for signature', 'send', `data-id="${o._id}"`, 'pri sm') : '') + (o.status === 'signed' && !o.employeeId && isHR() ? ' ' + btn('Start onboarding', 'conv', `data-id="${o._id}"`, 'pri sm') : '') + (['sent', 'viewed', 'draft'].includes(o.status) && isHR() ? ' ' + btn('Withdraw', 'wd', `data-id="${o._id}"`) : '')]], rows, { empty: 'No offers yet.' }), isHR() ? btn('New offer', 'new', '', 'pri sm') : '');
      on(el, {
        new: () => offerForm({}, reload), pdf: (d) => openPdf(`/offers/${d.id}/pdf`),
        send: async (d) => { const r = await C.api(`/offers/${d.id}/send`, { method: 'POST' }); const link = r.link; C.sheetForm('Offer sent', `<p>${H(r.note)}</p><p><code style="word-break:break-all">${H(link)}</code></p>`, async () => reload(), 'Done'); },
        wd: (d) => confirmSheet('Withdraw offer', 'The signing link will stop working.', async () => { await C.api(`/offers/${d.id}/withdraw`, { method: 'POST' }); reload(); }, 'Withdraw'),
        conv: async (d) => { const r = await C.api(`/offers/${d.id}/convert`, { method: 'POST' }); C.toast(`${r.employee.fullName} added in Onboarding · visa tracker opened · ${r.reviews.length} probation reviews scheduled`); reload(); },
      });
    }],
    ['perf', 'Performance', async (el, reload) => {
      const [rev, goals] = await Promise.all([C.api('/reviews'), C.api('/goals')]);
      const goalRow = (g, depth = 0) => `<div style="padding:8px 0 8px ${depth * 22}px;border-bottom:1px solid var(--line)"><div class="xrow"><b style="flex:1">${depth ? '↳ ' : ''}${H(g.title)}</b><span class="xmuted">${H(g.ownerType === 'employee' ? g.employeeId?.fullName || '' : g.department || g.ownerType)}</span>${st(g.status)}<div class="xprog" style="width:120px"><i style="width:${g.progress}%"></i></div><small>${g.progress}%</small></div></div>${(g.children || []).map((c) => goalRow(c, depth + 1)).join('')}`;
      el.innerHTML = `<div class="xgrid">${panel('Reviews', table([['Employee', (r) => H(r.employeeId?.fullName)], ['Review', (r) => H(r.kind.replace(/_/g, ' '))], ['Due', (r) => d10(r.dueDate)], ['Feedback', (r) => `${r.submitted}/${r.reviewers.length}`, 'r'], ['Avg', (r) => (r.avgRating ?? '—'), 'r'], ['Status', (r) => st(r.status)], ['', (r) => (r.status !== 'completed' ? btn('Record outcome', 'out', `data-id="${r._id}"`) : `<span class="xmuted">${H(r.outcome?.recommendation || '')}</span>`)]], rev, { empty: 'No reviews scheduled.' }), btn('Start 360 review', 'r360', '', 'pri sm'))}
        ${panel('Goals & OKRs', goals.tree.length ? goals.tree.map((g) => goalRow(g)).join('') : '<div class="empty">No goals yet. Start with a company goal, then cascade.</div>', btn('New goal', 'goal', '', 'pri sm'))}</div>`;
      on(el, {
        out: (d) => formSheet('Review outcome', [{ k: 'rating', label: 'Overall rating (1–5)', type: 'number', min: 1, req: true }, { k: 'recommendation', label: 'Recommendation', type: 'select', options: [['confirm', 'Confirm (probation)'], ['extend', 'Extend probation'], ['promote', 'Promote'], ['pip', 'Improvement plan'], ['terminate', 'End employment'], ['none', 'No action']] }, { k: 'note', label: 'Note', type: 'textarea' }], async (v) => { await C.api(`/reviews/${d.id}/outcome`, { method: 'POST', body: v }); reload(); }),
        r360: async () => { const o = await empOpts(); formSheet('Start 360 review', [{ k: 'employeeId', label: 'Employee', type: 'select', options: o, req: true }, { k: 'cycle', label: 'Cycle', value: `${new Date().getFullYear()}-H2`, req: true }, { k: 'dueDate', label: 'Due', type: 'date', value: addDays(today(), 14), req: true }], async (v, s) => { const peers = $$('#peerSel option:checked', s).map((x) => x.value); await C.api('/reviews/360', { method: 'POST', body: { ...v, peerIds: peers } }); C.toast('Invitations sent'); reload(); }, 'Send invitations', `<div class="field"><label class="lbl" for="peerSel">Peers (hold Ctrl/⌘ to pick several)</label><select id="peerSel" multiple size="6">${o.map(([v, l]) => `<option value="${v}">${H(l)}</option>`).join('')}</select></div>`); },
        goal: async () => formSheet('New goal', [{ k: 'title', label: 'Objective', req: true, full: true }, { k: 'ownerType', label: 'Level', type: 'select', options: [['company', 'Company'], ['department', 'Department'], ['employee', 'Employee']] }, { k: 'department', label: 'Department (if department level)' }, { k: 'employeeId', label: 'Employee (if employee level)', type: 'select', options: [['', '—'], ...(await empOpts())] }, { k: 'parentId', label: 'Supports', type: 'select', options: [['', '— top level —'], ...goals.goals.map((g) => [g._id, g.title])] }, { k: 'cycle', label: 'Cycle', value: `${new Date().getFullYear()}-H2`, req: true }, { k: 'krs', label: 'Key results, one per line: title, target', type: 'textarea', ph: 'Reduce payroll errors to 0, 0\nOnboard 12 hires, 12' }],
          async (v) => { const keyResults = (v.krs || '').split('\n').map((l) => l.split(',')).filter((x) => x[0]?.trim()).map(([t, target]) => ({ title: t.trim(), target: Number(target) || 100, start: 0, current: 0 })); delete v.krs; Object.keys(v).forEach((k) => v[k] === '' && delete v[k]); await C.api('/goals', { method: 'POST', body: { ...v, keyResults } }); reload(); }, 'Create'),
      });
    }],
    ['eng', 'Engagement', async (el, reload) => {
      const [surveys, feed] = await Promise.all([C.api('/surveys'), C.api('/engagement/feed')]);
      const BADGE = { team_player: '🤝', customer_hero: '⭐', innovator: '💡', above_and_beyond: '🚀', mentor: '🎓', safety_star: '🦺' };
      el.innerHTML = `<div class="xgrid g2" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">${panel('Surveys (eNPS & pulse)', table([['Survey', (s) => `<b>${H(s.title)}</b><div class="xmuted">${H(s.kind)}</div>`], ['Status', (s) => st(s.status)], ['', (s) => btn('Results', 'res', `data-id="${s._id}"`) + (s.status === 'open' && isHR() ? ' ' + btn('Close', 'close', `data-id="${s._id}"`) : '')]], surveys, { empty: 'No surveys yet.' }) + '<div id="sres"></div>', isHR() ? btn('New eNPS survey', 'survey', '', 'pri sm') : '')}
        ${panel('Announcements & recognition', [...feed.announcements.map((a) => `<div class="feeditem"><div class="badge">📣</div><div><b>${H(a.title)}</b> ${a.kind === 'townhall' ? C.pill('p-g', 'town hall') : ''}<div class="xmuted">${H(a.body || '')}</div>${a.eventAt ? `<small>${new Date(a.eventAt).toLocaleString('en-GB')}</small>` : ''}</div></div>`), ...feed.recognition.slice(0, 10).map((r) => `<div class="feeditem"><div class="badge">${BADGE[r.badge] || '🏅'}</div><div><b>${H(r.toEmployeeId?.fullName)}</b> <span class="xmuted">from ${H(r.fromEmployeeId?.fullName || 'HR')}</span><div>${H(r.message)}</div></div></div>`)].join('') || '<div class="empty">Nothing posted yet.</div>', isHR() ? btn('Post announcement', 'ann', '', 'pri sm') : '')}</div>`;
      on(el, {
        res: async (d) => { const r = await C.api(`/surveys/${d.id}/results`); $('#sres', el).innerHTML = r.suppressed ? `<p class="xmuted">${H(r.note)} (${r.responses} so far)</p>` : `${kpis([[r.enps ?? '—', 'eNPS (−100 to +100)'], [r.responses, 'Responses']])}${table([['Department', (x) => H(x.department)], ['Responses', (x) => x.responses, 'r'], ['eNPS', (x) => (x.suppressed ? '<span class="xmuted">hidden (small group)</span>' : x.enps ?? '—'), 'r']], r.departments)}${r.comments.length ? `<h3 style="font-size:14px">Comments</h3>${r.comments.map((c) => `<p class="xmuted">“${H(c)}”</p>`).join('')}` : ''}`; },
        close: async (d) => { await C.api(`/surveys/${d.id}/close`, { method: 'POST' }); reload(); },
        survey: () => formSheet('New eNPS survey', [{ k: 'title', label: 'Title', value: `Quarterly eNPS ${new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`, req: true }, { k: 'closesAt', label: 'Closes', type: 'date', value: addDays(today(), 14) }, { k: 'minGroupSize', label: 'Hide results for groups smaller than', type: 'number', value: 5 }], async (v) => { await C.api('/surveys', { method: 'POST', body: v }); C.toast('Survey is open for employees'); reload(); }, 'Open survey'),
        ann: () => formSheet('Post announcement', [{ k: 'title', label: 'Title', req: true, full: true }, { k: 'titleAr', label: 'Title (Arabic)', full: true }, { k: 'kind', label: 'Type', type: 'select', options: [['news', 'News'], ['townhall', 'Town hall'], ['policy', 'Policy'], ['event', 'Event']] }, { k: 'eventAt', label: 'Event time', type: 'datetime-local' }, { k: 'body', label: 'Message', type: 'textarea', rows: 5 }, { k: 'pinned', label: 'Pin', type: 'check', text: 'Pin to the top' }], async (v) => { if (v.eventAt) v.eventAt = new Date(v.eventAt).toISOString(); await C.api('/announcements', { method: 'POST', body: v }); reload(); }, 'Post'),
      });
    }],
  ]);
}
function offerForm(pre, done) {
  return formSheet('New offer', [
    { k: 'candidateName', label: 'Candidate name', value: pre.candidateName, req: true }, { k: 'candidateEmail', label: 'Candidate email', type: 'email', value: pre.candidateEmail }, { k: 'jobTitle', label: 'Job title', req: true }, { k: 'grade', label: 'Grade' },
    { k: 'establishmentId', label: 'Establishment', type: 'select', options: estOpts(), value: estId(), req: true }, { k: 'startDate', label: 'Start date', type: 'date', req: true },
    { k: 'basic', label: 'Basic (AED / month)', type: 'number', step: '0.01', req: true }, { k: 'housing', label: 'Housing', type: 'number', step: '0.01', value: 0 }, { k: 'transport', label: 'Transport', type: 'number', step: '0.01', value: 0 }, { k: 'other', label: 'Other allowances', type: 'number', step: '0.01', value: 0 },
    { k: 'probationMonths', label: 'Probation (months)', type: 'number', value: 6 }, { k: 'noticeDays', label: 'Notice (days)', type: 'number', value: 30 }, { k: 'visaType', label: 'Visa', type: 'select', options: [['Mainland employment visa', 'Mainland employment visa'], ['Free-zone employment visa', 'Free-zone employment visa'], ['UAE National (no visa)', 'UAE National'], ['Golden visa holder', 'Golden visa holder']] }, { k: 'lang', label: 'Language', type: 'select', options: [['dual', 'English + Arabic'], ['en', 'English'], ['ar', 'Arabic']] },
  ], async (v) => { const o = await C.api('/offers', { method: 'POST', body: { ...v, ...(pre.applicantId ? { applicantId: pre.applicantId, requisitionId: pre.requisitionId } : {}) } }); if (o.validation?.issues?.length) C.toast(`Draft saved. Fix: ${o.validation.issues.join(' ')}`); else if (o.validation?.warnings?.length) C.toast(`Draft saved. Note: ${o.validation.warnings.join(' ')}`); else C.toast('Offer drafted'); done(); }, 'Create draft');
}

// ======================================================================= INSIGHTS
async function insights() {
  return screen('insights', 'Insights', 'Visa & insurance cash-flow, wellbeing and retention signals, Emiratisation ROI.', [
    ['fc', 'Renewal cash-flow', async (el) => {
      const f = await C.api('/insights/forecast?months=12');
      const max = Math.max(1, ...f.months.map((m) => m.totalFils));
      el.innerHTML = kpis([[AED(f.totalFils), 'Next 12 months · AED'], [f.peak ? `${f.peak.month}` : '—', `Peak month${f.peak ? ` · AED ${AED(f.peak.totalFils)}` : ''}`], [AED(f.overdue.totalFils), `Already expired (${f.overdue.items.length}) · AED`]]) +
        panel('Government & insurance renewals by month', `<div class="xbars" role="img" aria-label="Monthly renewal cost">${f.months.map((m) => `<div title="${H(m.month)}: AED ${AED(m.totalFils)} · ${m.items.length} renewals"><small>${m.totalFils ? Math.round(m.totalFils / 100000) + 'k' : ''}</small><i style="height:${Math.round((m.totalFils / max) * 120)}px"></i><small>${new Date(`${m.month}-01`).toLocaleDateString('en-GB', { month: 'short' })}</small></div>`).join('')}</div><p class="xmuted">Planning estimates from your documents' expiry dates. Leavers are excluded. Adjust the fee assumptions in Platform → Settings.</p>`) +
        '<div style="height:16px"></div>' + panel('Upcoming renewals', table([['Month', (x) => H(x.month)], ['Holder', (x) => H(x.holder)], ['Item', (x) => H(x.label)], ['Expiry', (x) => H(x.expiry)], ['Estimate', (x) => money(x.amountFils), 'r']], f.months.flatMap((m) => m.items.map((i) => ({ ...i, month: m.month }))).slice(0, 80), { empty: 'No renewals in the next 12 months.' }));
    }],
    ['attr', 'Retention signals', async (el, reload) => {
      const a = await C.api('/insights/attrition');
      if (!a.enabled) { el.innerHTML = panel('Retention signals are switched off', `<p>${H(a.note)}</p><p class="xmuted">Signals used (transparent rules, operational data only):</p>${table([['Signal', (s) => H(s.label)], ['Weight', (s) => s.weight, 'r']], a.signals)}`, isHR() ? btn('Enable team-level insights', 'en', '', 'pri sm') : ''); on(el, { en: async () => { await C.api('/settings/features', { method: 'PATCH', body: { attritionInsights: { enabled: true } } }); reload(); } }); return; }
      el.innerHTML = `<p class="xmuted">${H(a.note)}</p>` + panel('By department', table([['Department', (d) => H(d.department)], ['People', (d) => d.headcount, 'r'], ['Avg score', (d) => (d.suppressed ? '<span class="xmuted">hidden · small group</span>' : `<div class="xrow"><div class="xprog" style="width:100px"><i style="width:${d.avgScore}%"></i></div>${d.avgScore}</div>`)], ['High', (d) => (d.suppressed ? '' : d.high), 'r'], ['Wellbeing', (d) => (d.pulseAvg == null ? '—' : `${d.pulseAvg}/5`), 'r'], ['Top reasons', (d) => (d.topReasons || []).map((r) => `<div class="xmuted">${H(r.reason)} (${r.count})</div>`).join('')]], a.departments)) +
        (a.individuals ? '<div style="height:16px"></div>' + panel('Individuals to check in with', table([['Employee', (x) => H(x.name)], ['Department', (x) => H(x.department || '')], ['Score', (x) => st(x.band) + ` ${x.score}`], ['Why', (x) => x.reasons.map((r) => `<div class="xmuted">${H(r)}</div>`).join('')], ['Suggested', (x) => x.suggestions.map((r) => `<div>${H(r)}</div>`).join('')]], a.individuals, { empty: 'No one above the medium band.' })) : '');
    }],
    ['nafis', 'Emiratisation ROI', async (el) => {
      el.innerHTML = panel('Hire a UAE National vs. pay the fine', `<form id="nf" class="xrow"><label class="lbl" for="ng">Monthly gross (AED)</label><input id="ng" type="number" value="8000" min="6000" step="100" style="max-width:160px"><label class="lbl" for="nm">Months</label><input id="nm" type="number" value="12" min="1" max="36" style="max-width:90px"><button class="btn pri sm">Compare</button></form><div id="nOut"></div>`);
      const run = async () => {
        const r = await C.api(`/insights/nafis-roi?establishmentId=${estId()}&gross=${$('#ng', el).value}&months=${$('#nm', el).value}`);
        const c = r.comparison;
        $('#nOut', el).innerHTML = kpis([[AED(c.hireNetCostFils), `Net cost of hiring over ${c.months} months · AED`], [AED(c.fineCostFils), 'Fines for one unfilled slot · AED'], [`${c.cheaper === 'hire' ? 'Hire' : 'Fine'} saves ${AED(Math.abs(c.differenceFils))}`, 'Cheaper option · AED'], [r.assessment.gap ?? 0, 'Current quota gap']]) + `<p class="xmuted">${H(r.nafis.note)} Modelled NAFIS support AED ${AED(r.nafis.modelledSubsidyFils)}/month.</p>`;
      };
      $('#nf', el).onsubmit = (e) => { e.preventDefault(); run().catch(C.fail); }; await run();
    }],
  ]);
}

// ======================================================================= PLATFORM
async function platform() {
  const tabs = [
    ['rep', 'Reports', async (el, reload) => {
      const [ents, saved] = await Promise.all([C.api('/reports/entities'), C.api('/reports/saved')]);
      let entity = store.get('wasl_rep_entity', 'employees'); if (!ents[entity]) entity = 'employees';
      const cols = Object.entries(ents[entity].columns);
      el.innerHTML = `<div class="xgrid">${panel('Report builder', `<div class="xrow" style="margin-bottom:10px"><label class="lbl" for="rent">Data</label><select id="rent" style="max-width:220px">${Object.entries(ents).map(([k, v]) => `<option value="${k}" ${k === entity ? 'selected' : ''}>${H(v.label)}</option>`).join('')}</select><label class="lbl" for="rfrom">From</label><input id="rfrom" type="date" style="max-width:160px"><label class="lbl" for="rto">To</label><input id="rto" type="date" style="max-width:160px"><input id="rstatus" placeholder="Status filter" style="max-width:150px"></div>
        <div class="xrow" style="margin-bottom:10px">${cols.map(([k, c]) => `<label class="chkline"><input type="checkbox" value="${k}" checked> ${H(c.label)}${c.sensitive ? ' 🔒' : ''}</label>`).join('')}</div>
        <div class="xrow">${btn('Run', 'run', '', 'pri sm')}${btn('Export CSV', 'csv')}${btn('Save report', 'save')}<span class="xmuted">🔒 columns are masked for roles without payroll access. Every export is logged.</span></div><div id="rout" style="margin-top:12px"></div>`)}
        ${panel('Saved & scheduled reports', table([['Name', (s) => `<b>${H(s.name)}</b>`], ['Data', (s) => H(ents[s.entity]?.label || s.entity)], ['Schedule', (s) => (s.schedule === 'none' ? '—' : `${H(s.schedule)}${s.recipients?.length ? ` → ${H(s.recipients.join(', '))}` : ''}`)], ['Last run', (s) => (s.lastRunAt ? new Date(s.lastRunAt).toLocaleString('en-GB') : '—')], ['', (s) => btn('Open', 'open', `data-id="${s._id}"`) + ' ' + btn('Delete', 'del', `data-id="${s._id}"`)]], saved, { empty: 'Save a report to rerun or schedule it.' }))}</div>`;
      const spec = () => ({ entity: $('#rent', el).value, columns: $$('.chkline input:checked', el).map((x) => x.value), filters: Object.fromEntries([['from', $('#rfrom', el).value], ['to', $('#rto', el).value], ['status', $('#rstatus', el).value]].filter(([, v]) => v)) });
      $('#rent', el).onchange = (e) => { store.set('wasl_rep_entity', e.target.value); reload(); };
      on(el, {
        run: async () => { const r = await C.api('/reports/run', { method: 'POST', body: spec() }); $('#rout', el).innerHTML = `<p class="xmuted">${r.total} rows${r.total > 500 ? ' (showing 500; export for all)' : ''}</p>` + table(r.columns.map((c, i) => [c.label + (c.masked ? ' (masked)' : ''), (row) => H(row[i])]), r.rows, { empty: 'No rows match.' }); },
        csv: () => download('/reports/export', { method: 'POST', body: spec(), filename: 'report.csv' }),
        save: () => formSheet('Save report', [{ k: 'name', label: 'Name', req: true }, { k: 'schedule', label: 'Email it', type: 'select', options: [['none', 'Never'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] }, { k: 'recipients', label: 'Recipients (comma separated emails)', full: true }, { k: 'shared', label: 'Share', type: 'check', text: 'Visible to other HR users' }], async (v) => { await C.api('/reports/saved', { method: 'POST', body: { ...spec(), ...v, recipients: (v.recipients || '').split(',').map((x) => x.trim()).filter(Boolean) } }); reload(); }),
        open: (d) => { const s = saved.find((x) => x._id === d.id); store.set('wasl_rep_entity', s.entity); reload().then(() => { $$('.chkline input', el).forEach((x) => (x.checked = !s.columns?.length || s.columns.includes(x.value))); Object.entries(s.filters || {}).forEach(([k, v]) => { const i = $(`#r${k}`, el); if (i) i.value = v; }); }); },
        del: async (d) => { await C.api(`/reports/saved/${d.id}`, { method: 'DELETE' }); reload(); },
      });
    }],
  ];
  if (isHR()) tabs.push(
    ['api', 'API & webhooks', async (el, reload) => {
      const [keys, wh] = await Promise.all([C.api('/api-keys'), C.api('/webhooks')]);
      el.innerHTML = `<div class="xgrid">${panel('API keys', table([['Name', (k) => `<b>${H(k.name)}</b><div class="xmuted"><code>wsl_${H(k.prefix)}_…</code></div>`], ['Scopes', (k) => k.scopes.map((s) => C.pill('p-n', s)).join(' ')], ['Last used', (k) => (k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('en-GB') : 'never')], ['Status', (k) => st(k.revokedAt ? 'revoked' : 'active')], ['', (k) => (k.revokedAt ? '' : btn('Revoke', 'rev', `data-id="${k._id}"`))]], keys, { empty: 'No API keys. Integrations call /api/v1 with an X-API-Key header.' }), btn('New API key', 'key', '', 'pri sm'))}
        ${panel('Webhooks', table([['Endpoint', (w) => `<code style="word-break:break-all">${H(w.url)}</code>`], ['Events', (w) => w.events.map((e) => C.pill('p-n', e)).join(' ')], ['Last delivery', (w) => (w.lastDeliveryAt ? `${w.lastStatus} · ${new Date(w.lastDeliveryAt).toLocaleString('en-GB')}` : '—')], ['Status', (w) => st(w.active ? 'active' : 'disabled') + (w.failures ? ` ${C.pill('p-warn', `${w.failures} failures`)}` : '')], ['', (w) => btn('Test', 'test', `data-id="${w._id}"`) + ' ' + btn('Deliveries', 'dl', `data-id="${w._id}"`) + ' ' + btn(w.active ? 'Pause' : 'Resume', 'tog', `data-id="${w._id}" data-on="${w.active ? '' : '1'}"`) + ' ' + btn('Delete', 'del', `data-id="${w._id}"`)]], wh.webhooks, { empty: 'No webhooks.' }) + '<div id="dlOut"></div>', btn('Add webhook', 'wh', '', 'pri sm'))}</div>`;
      const secretSheet = (title, rows) => C.sheetForm(title, `<p>Copy this now. It is not shown again.</p>${C.kv(rows.map(([k, v]) => [k, `<code style="word-break:break-all">${H(v)}</code>`]))}`, async () => reload(), 'Done');
      on(el, {
        key: () => formSheet('New API key', [{ k: 'name', label: 'Name', req: true, ph: 'ERP integration' }], async (v, s) => { const scopes = $$('.scope:checked', s).map((x) => x.value); const r = await C.api('/api-keys', { method: 'POST', body: { name: v.name, scopes } }); secretSheet('API key created', [['Key', r.key]]); }, 'Create', `<div class="xrow">${['employees:read', 'leave:read', 'leave:write', 'attendance:read', 'attendance:write', 'payroll:read'].map((s) => `<label class="chkline"><input type="checkbox" class="scope" value="${s}" ${s.endsWith('read') ? 'checked' : ''}> ${s}</label>`).join('')}</div>`),
        rev: (d) => confirmSheet('Revoke key', 'Integrations using this key stop working immediately.', async () => { await C.api(`/api-keys/${d.id}/revoke`, { method: 'POST' }); reload(); }, 'Revoke'),
        wh: () => formSheet('Add webhook', [{ k: 'url', label: 'HTTPS endpoint', type: 'url', req: true, full: true }, { k: 'description', label: 'Description', full: true }], async (v, s) => { const events = $$('.ev:checked', s).map((x) => x.value); const r = await C.api('/webhooks', { method: 'POST', body: { ...v, events } }); secretSheet('Webhook signing secret', [['Secret', r.secret], ['Verify', r.note]]); }, 'Add', `<div class="xrow">${wh.events.map((e) => `<label class="chkline"><input type="checkbox" class="ev" value="${e}"> ${e}</label>`).join('')}</div>`),
        test: async (d) => { await C.api(`/webhooks/${d.id}/test`, { method: 'POST' }); C.toast('Test event queued'); },
        tog: async (d) => { await C.api(`/webhooks/${d.id}`, { method: 'PATCH', body: { active: !!d.on } }); reload(); },
        del: (d) => confirmSheet('Delete webhook', 'Stop sending events to this endpoint?', async () => { await C.api(`/webhooks/${d.id}`, { method: 'DELETE' }); reload(); }, 'Delete'),
        dl: async (d) => { const rows = await C.api(`/webhooks/${d.id}/deliveries`); $('#dlOut', el).innerHTML = table([['Event', (x) => H(x.event)], ['When', (x) => new Date(x.createdAt).toLocaleString('en-GB')], ['Attempts', (x) => x.attempts.map((a) => a.status || 'err').join(' → ')], ['State', (x) => st(x.state)], ['', (x) => (x.state !== 'delivered' ? btn('Replay', 'rp', `data-id="${x._id}"`) : '')]], rows, { empty: 'No deliveries yet.' }); },
        rp: async (d) => { await C.api(`/webhooks/deliveries/${d.id}/replay`, { method: 'POST' }); C.toast('Re-queued'); },
      });
    }],
    ['con', 'Connectors', async (el, reload) => {
      const c = await C.api('/connectors');
      const by = (k, p) => c.connectors.find((x) => x.kind === k && x.provider === p);
      el.innerHTML = panel('Connectors', `<p class="xmuted">Each connector can be switched off instantly with its kill switch. Secrets are encrypted and never shown again.</p>` + table([['Kind', (r) => `<b>${H(r.kind.replace(/_/g, ' '))}</b>`], ['Provider', (r) => H(r.provider.replace(/_/g, ' '))], ['Status', (r) => (r.c ? st(r.c.killSwitch ? 'blocked' : r.c.enabled ? 'active' : 'draft') + (r.c.health?.status ? ` <span class="xmuted">health: ${H(r.c.health.status)}</span>` : '') : '<span class="xmuted">not set up</span>')], ['', (r) => btn(r.c ? 'Edit' : 'Set up', 'cfg', `data-k="${r.kind}" data-p="${r.provider}"`) + (r.c ? ` ${btn(r.c.killSwitch ? 'Release kill switch' : 'Kill switch', 'kill', `data-id="${r.c._id}" data-on="${r.c.killSwitch ? '' : '1'}"`)} ${btn('Check', 'health', `data-id="${r.c._id}"`)}` : '')]], Object.entries(c.catalog).flatMap(([kind, ps]) => ps.map((provider) => ({ kind, provider, c: by(kind, provider) })))));
      on(el, {
        cfg: (d) => { const cur = by(d.k, d.p); const sso = d.k === 'sso'; formSheet(`${d.k.replace(/_/g, ' ')} · ${d.p.replace(/_/g, ' ')}`, sso ? [{ k: 'issuer', label: 'Issuer URL', type: 'url', value: cur?.config?.issuer, req: true, full: true, help: 'e.g. https://login.microsoftonline.com/<tenant>/v2.0 or https://accounts.google.com' }, { k: 'clientId', label: 'Client ID', value: cur?.config?.clientId, req: true }, { k: 'emailDomain', label: 'Allowed email domain', value: cur?.config?.emailDomain }, { k: 'secret', label: 'Client secret (leave blank to keep)', type: 'password' }, { k: 'enabled', label: 'Enabled', type: 'check', text: 'Show “Sign in with SSO”', value: cur?.enabled }] : [{ k: 'config', label: 'Settings (JSON)', type: 'textarea', value: JSON.stringify(cur?.config || {}, null, 2), rows: 6 }, { k: 'secret', label: 'Secret / API token (leave blank to keep)', type: 'password', full: true }, { k: 'enabled', label: 'Enabled', type: 'check', text: 'Use this connector', value: cur?.enabled }],
          async (v) => { const config = sso ? { issuer: v.issuer, clientId: v.clientId, emailDomain: v.emailDomain } : JSON.parse(v.config || '{}'); await C.api('/connectors', { method: 'PUT', body: { kind: d.k, provider: d.p, config, secret: v.secret, enabled: !!v.enabled } }); reload(); }, 'Save', sso ? `<p class="xmuted">Redirect URI: <code>${H(location.origin)}/api/public/sso/callback</code> · Sign-in link: <code>${H(location.origin)}/api/public/sso/${H(C.tenantId())}/start</code></p>` : ''); },
        kill: async (d) => { await C.api(`/connectors/${d.id}/kill`, { method: 'POST', body: { on: !!d.on } }); reload(); },
        health: async (d) => { const h = await C.api(`/connectors/${d.id}/health`, { method: 'POST' }); C.toast(`${h.status}: ${h.detail}`); reload(); },
      });
    }],
    ['rules', 'Rules registry', async (el, reload) => {
      const r = await C.api('/rules/registry');
      el.innerHTML = `<div class="xgrid">${panel('Tenant rule versions', `<p class="xmuted">Change a statutory value for your organisation with an effective date. Drafts never affect payroll; a version must pass its tests and be approved by a second HR admin, then you apply it to an establishment.</p>` + table([['Pack', (v) => `<b>${H(v.packId)}</b> v${H(v.version)}`], ['Effective', (v) => `${H(v.effectiveFrom)}${v.effectiveTo ? ` → ${H(v.effectiveTo)}` : ''}`], ['Changes', (v) => `<code style="font-size:11px">${H(JSON.stringify(v.overrides))}</code>`], ['Tests', (v) => (v.lastTest ? st(v.lastTest.passed ? 'pass' : 'failed') : '<span class="xmuted">not run</span>')], ['Status', (v) => st(v.status)], ['', (v) => (v.status === 'draft' ? btn('Run tests', 'test', `data-id="${v._id}"`) + ' ' + btn('Preview impact', 'prev', `data-id="${v._id}"`) + ' ' + btn('Approve', 'ap', `data-id="${v._id}"`) : btn('Apply to establishment', 'apply', `data-p="${v.packId}::${C.tenantId()}"`))]], r.versions, { empty: 'No tenant versions; the code rule packs below apply.' }) + '<div id="rout"></div>', btn('New version', 'new', '', 'pri sm'))}
        ${panel('Rule packs in code', table([['Pack', (p) => `<b>${H(p.id)}</b> v${H(p.version)}`], ['Status', (p) => st(p.status)], ['Source', (p) => `<span class="xmuted">${H(p.source)}</span>`], ['Gratuity', (p) => (p.gratuity ? `${p.gratuity.daysPerYearFirst5 ?? '—'}/${p.gratuity.daysPerYearAfter5 ?? '—'} days` : '')], ['Annual leave', (p) => (p.leave ? `${p.leave.annualDays} ${p.leave.annualDaysUnit || 'calendar'}` : '')]], r.codePacks))}</div>`;
      on(el, {
        new: () => formSheet('New rule version', [{ k: 'packId', label: 'Base pack', type: 'select', options: r.codePacks.map((p) => [p.id, p.id]) }, { k: 'version', label: 'Version', value: `${new Date().getFullYear() + 1}.1`, req: true }, { k: 'effectiveFrom', label: 'Effective from', type: 'date', req: true }, { k: 'overrides', label: 'Changes (JSON)', type: 'textarea', rows: 5, req: true, value: '{\n  "leave": { "annualDays": 30 }\n}' }, { k: 'tests', label: 'Tests (JSON array)', type: 'textarea', rows: 4, value: '[{ "name": "annual leave", "input": { "path": "leave.annualDays" }, "expect": { "value": 30 } }]' }, { k: 'sourceRef', label: 'Legal source / reference', full: true }, { k: 'changeNote', label: 'Why', full: true }],
          async (v) => { await C.api('/rules/registry', { method: 'POST', body: { packId: v.packId, version: v.version, effectiveFrom: v.effectiveFrom, overrides: JSON.parse(v.overrides), testCases: JSON.parse(v.tests || '[]'), sourceRef: v.sourceRef, changeNote: v.changeNote } }); reload(); }, 'Save draft'),
        test: async (d) => { const t = await C.api(`/rules/registry/${d.id}/test`, { method: 'POST' }); C.toast(t.passed ? 'All tests passed' : 'Some tests failed'); reload(); },
        prev: async (d) => { const p = await C.api(`/rules/registry/${d.id}/preview`); $('#rout', el).innerHTML = `<p class="xmuted">${H(p.note)} ${p.changed} employees' gratuity would change.</p>` + table([['Employee', (x) => H(x.employeeName)], ['Current', (x) => (x.currentFils == null ? '—' : money(x.currentFils)), 'r'], ['With this version', (x) => (x.proposedFils == null ? '—' : money(x.proposedFils)), 'r'], ['Change', (x) => (x.deltaFils ? money(x.deltaFils) : ''), 'r']], p.rows.filter((x) => x.deltaFils).slice(0, 100), { empty: 'No gratuity changes.' }); },
        ap: async (d) => { await C.api(`/rules/registry/${d.id}/approve`, { method: 'POST' }); C.toast('Approved'); reload(); },
        apply: (d) => formSheet('Apply to establishment', [{ k: 'establishmentId', label: 'Establishment', type: 'select', options: estOpts(), req: true }], async (v) => { await C.api('/rules/registry/apply', { method: 'POST', body: { ...v, packId: d.p } }); C.toast('Establishment now uses your rule pack'); }, 'Apply'),
      });
    }],
    ['jobs', 'Background jobs', async (el, reload) => {
      const j = await C.api('/jobs');
      el.innerHTML = kpis(['queued', 'running', 'done', 'dead'].map((k) => [j.counts[k] || 0, k])) + panel('Recent jobs', table([['Queue', (x) => H(x.queue)], ['State', (x) => st(x.state)], ['Attempts', (x) => `${x.attempts}/${x.maxAttempts}`, 'r'], ['Updated', (x) => new Date(x.updatedAt).toLocaleString('en-GB')], ['Error', (x) => `<span class="xmuted">${H(x.lastError || '')}</span>`], ['', (x) => (['dead', 'failed'].includes(x.state) ? btn('Replay', 'rp', `data-id="${x._id}"`) : '')]], j.jobs, { empty: 'No background jobs yet.' }), btn('Refresh', 'ref'));
      on(el, { rp: async (d) => { await C.api(`/jobs/${d.id}/replay`, { method: 'POST' }); reload(); }, ref: () => reload() });
    }],
    ['set', 'AI & privacy', async (el, reload) => {
      const s = await C.api('/settings/features');
      el.innerHTML = panel('AI & privacy controls', C.kv([['AI agent', s.agentKillSwitch ? C.pill('p-bad', 'switched off') : C.pill('p-ok', 'on — every action needs approval')], ['Retention signals', s.attritionInsights?.enabled ? (s.attritionInsights.individualScores ? 'Team + individual' : 'Team level only') : 'Off'], ['Bias / privacy review recorded', s.attritionInsights?.reviewedForBias ? 'Yes' : 'No'], ['Minimum group size', s.attritionInsights?.minGroupSize ?? 5]]), btn(s.agentKillSwitch ? 'Turn AI agent on' : 'AI kill switch', 'kill', `data-on="${s.agentKillSwitch ? '' : '1'}"`) + btn('Retention settings', 'attr', '', 'pri sm'));
      on(el, {
        kill: async (d) => { await C.api('/settings/features', { method: 'PATCH', body: { agentKillSwitch: !!d.on } }); reload(); },
        attr: () => formSheet('Retention signals', [{ k: 'enabled', label: 'Team-level insights', type: 'check', text: 'Show department aggregates', value: s.attritionInsights?.enabled }, { k: 'reviewedForBias', label: 'Review', type: 'check', text: 'A privacy and bias review has been completed', value: s.attritionInsights?.reviewedForBias }, { k: 'individualScores', label: 'Individuals', type: 'check', text: 'Show individual indicators to HR admins', value: s.attritionInsights?.individualScores }, { k: 'minGroupSize', label: 'Hide groups smaller than', type: 'number', value: s.attritionInsights?.minGroupSize ?? 5 }], async (v) => { await C.api('/settings/features', { method: 'PATCH', body: { attritionInsights: v } }); reload(); }),
      });
    }],
  );
  return screen('platform', 'Platform', 'Reports, integrations, rules and controls.', tabs);
}

// ======================================================================= EMPLOYEE: SERVICES
async function eservices() {
  return screen('eservices', 'Services', 'Expenses, loans, airfare, insurance, perks and company items.', [
    ['exp', 'Expenses', async (el, reload) => {
      const rows = await C.api('/me/expenses');
      el.innerHTML = panel('My expense claims', table([['Merchant', (r) => `${H(r.merchant)}<div class="xmuted">${H(r.category)} · ${d10(r.receiptDate)}</div>`], ['Total', (r) => money(r.totalFils), 'r'], ['Status', (r) => st(r.status)]], rows, { empty: 'No claims yet.' }), btn('New claim', 'new', '', 'pri sm'));
      on(el, {
        new: () => {
          const fields = [{ k: 'file', label: 'Receipt photo or PDF', type: 'file', accept: 'image/*,application/pdf' }, { k: 'merchant', label: 'Merchant', req: true }, { k: 'receiptDate', label: 'Receipt date', type: 'date', value: today(), req: true }, { k: 'total', label: 'Total incl. VAT (AED)', type: 'number', step: '0.01', req: true }, { k: 'vat', label: 'VAT (AED)', type: 'number', step: '0.01', value: 0 }, { k: 'trn', label: 'Merchant TRN (15 digits)' }, { k: 'category', label: 'Category', type: 'select', options: ['meals', 'travel', 'fuel', 'client', 'office', 'training', 'telecom', 'medical', 'other'].map((x) => [x, x]) }, { k: 'description', label: 'What was it for?', full: true }];
          let ocr;
          const sh = formSheet('New expense claim', fields, async (v) => { const f = v.file; delete v.file; await C.api('/me/expenses', { method: 'POST', body: { ...v, ...(f ? { file: f.data, contentType: f.type } : {}), ocr } }); C.toast('Submitted to your manager'); reload(); }, 'Submit', '<div class="xrow"><button type="button" class="btn sm" id="scanR">Read receipt with AI</button><span class="xmuted" id="scanMsg">Fills the amounts for you to check.</span></div>');
          $('#scanR', sh).onclick = async () => {
            const f = $('#xf_file', sh).files[0]; if (!f) return C.toast('Choose the receipt first'); $('#scanMsg', sh).textContent = 'Reading…';
            try { const r = await C.api('/me/expenses/scan', { method: 'POST', body: { file: await C.fileToBase64(f), contentType: f.type } }); const x = r.suggested; ocr = x; if (!x || x.error) { $('#scanMsg', sh).textContent = r.note || x?.error; return; } if (x.merchant) $('#xf_merchant', sh).value = x.merchant; if (x.date) $('#xf_receiptDate', sh).value = x.date; if (x.totalAed != null) $('#xf_total', sh).value = x.totalAed; if (x.vatAed != null) $('#xf_vat', sh).value = x.vatAed; if (x.trn) $('#xf_trn', sh).value = x.trn; $('#scanMsg', sh).textContent = r.note; } catch (e) { $('#scanMsg', sh).textContent = e.message; }
          };
        },
      });
    }],
    ['money', 'Loans & airfare', async (el, reload) => {
      const [loans, air] = await Promise.all([C.api('/me/loans'), C.api('/me/airfare')]);
      const acc = air.account;
      el.innerHTML = `<div class="xgrid">${acc ? kpis([[AED(acc.balanceFils), `Airfare balance · AED (${H(acc.homeIata)})`], [acc.policyId?.allowEncashment ? 'Cash or ticket' : 'Ticket only', 'How you can use it']]) : ''}
        ${panel('Airfare', acc ? table([['Request', (r) => H(r.kind)], ['Amount', (r) => money(r.amountFils), 'r'], ['Travel', (r) => d10(r.travelDate)], ['Status', (r) => st(r.status)]], air.requests, { empty: 'No airfare requests yet.' }) : '<div class="empty">You have no airfare entitlement. Ask HR if your contract includes one.</div>', acc ? btn('Request ticket / cash', 'air', '', 'pri sm') : '')}
        ${panel('Loans & salary advances', table([['Type', (l) => H(l.kind)], ['Amount', (l) => money(l.principalFils), 'r'], ['Monthly', (l) => money(l.installmentFils), 'r'], ['Left to repay', (l) => money(l.outstandingFils), 'r'], ['Status', (l) => st(l.status)]], loans, { empty: 'No loans or advances.' }), btn('Request advance', 'loan', '', 'pri sm'))}</div>`;
      on(el, {
        air: () => formSheet('Airfare request', [{ k: 'kind', label: 'I want', type: 'select', options: [['booking', 'A ticket booked'], ...(acc.policyId?.allowEncashment ? [['encash', 'Cash instead of a ticket']] : [])] }, { k: 'amount', label: `Amount (AED, up to ${AED(acc.balanceFils)})`, type: 'number', step: '0.01', value: (acc.balanceFils / 100).toFixed(2) }, { k: 'travelDate', label: 'Travel date', type: 'date' }, { k: 'returnDate', label: 'Return date', type: 'date' }, { k: 'travellers', label: 'Travellers', type: 'number', value: 1 }, { k: 'notes', label: 'Notes', full: true }], async (v) => { await C.api('/me/airfare/requests', { method: 'POST', body: v }); C.toast('Sent to HR'); reload(); }, 'Send'),
        loan: () => formSheet('Request a salary advance or loan', [{ k: 'kind', label: 'Type', type: 'select', options: [['advance', 'Salary advance'], ['loan', 'Loan']] }, { k: 'principal', label: 'Amount (AED)', type: 'number', step: '0.01', req: true }, { k: 'installment', label: 'Monthly repayment (AED)', type: 'number', step: '0.01', req: true }, { k: 'startPeriod', label: 'Start repaying from', type: 'month', value: thisMonth(), req: true }, { k: 'reason', label: 'Reason', req: true, full: true }], async (v) => { await C.api('/me/loans', { method: 'POST', body: v }); C.toast('Sent to HR for approval'); reload(); }, 'Send request', '<p class="xmuted">Repayments come out of your salary and never take more than half of it.</p>'),
      });
    }],
    ['ins', 'Insurance & perks', async (el, reload) => {
      const [ins, perks] = await Promise.all([C.api('/me/insurance'), C.api('/me/perks')]);
      el.innerHTML = `<div class="xgrid">${ins.cards.length ? `<div class="grid g3">${ins.cards.map((c) => `<div class="inscard"><div><small>${H(c.policy?.insurer || '')} ${H(c.policy?.plan ? `· ${c.policy.plan}` : '')}</small><div style="font-size:18px;font-weight:600;margin-top:4px">${H(c.memberName)}</div><small>${H(c.relation)}</small></div><div><div style="font-family:var(--f-mono);letter-spacing:.08em">${H(c.cardNo || '—')}</div><small>Valid to ${d10(c.validTo) || d10(c.policy?.endDate)}</small></div></div>`).join('')}</div>` : '<div class="panel"><div class="empty">No insurance card on file yet.</div></div>'}
        ${panel('Find a hospital or clinic', '<form id="nf" class="xrow"><input id="nq" placeholder="Name or area" style="flex:1;min-width:160px"><select id="ne" style="max-width:150px"><option value="">All emirates</option>' + ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'].map((x) => `<option>${x}</option>`).join('') + '</select><select id="nt" style="max-width:140px"><option value="">Any type</option><option value="hospital">Hospital</option><option value="clinic">Clinic</option><option value="pharmacy">Pharmacy</option><option value="lab">Lab</option></select><button class="btn sm">Search</button><button type="button" class="btn sm" id="near">Near me</button></form><div id="nOut"></div>')}
        ${panel('Requests', table([['Request', (r) => `${H(r.kind.replace(/_/g, ' '))}${r.dependent?.name ? ` · ${H(r.dependent.name)}` : ''}`], ['Status', (r) => st(r.status)]], ins.requests, { empty: 'No requests.' }), btn('Add / remove dependent', 'dep') + btn('Replace card', 'card'))}
        ${panel('Perks', table([['', (p) => `<b>${H(p.title)}</b> <span class="xmuted">${H(p.provider || '')}</span><div class="xmuted">${H(p.description || '')}</div>`], ['Code', (p) => (p.code ? `<code>${H(p.code)}</code>` : '')], ['', (p) => (p.url ? `<a href="${H(p.url)}" target="_blank" rel="noopener">Open</a>` : '')]], perks, { empty: 'No perks yet.' }))}</div>`;
      const search = async (pos) => { const q = new URLSearchParams({ q: $('#nq', el).value, emirate: $('#ne', el).value, type: $('#nt', el).value, ...(pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {}) }); const rows = await C.api(`/me/insurance/network?${q}`); $('#nOut', el).innerHTML = table([['Provider', (x) => `<b>${H(x.name)}</b><div class="xmuted">${H(x.type)} · ${H(x.area || '')} ${H(x.emirate)}</div>`], ['Distance', (x) => (x.km != null ? `${x.km} km` : ''), 'r'], ['Direct billing', (x) => (x.directBilling ? C.pill('p-ok', 'yes') : C.pill('p-n', 'pay & claim'))], ['', (x) => (x.phone ? `<a href="tel:${H(x.phone)}">${H(x.phone)}</a>` : '')]], rows, { empty: 'No providers match.' }); };
      $('#nf', el).onsubmit = (e) => { e.preventDefault(); search().catch(C.fail); };
      $('#near', el).onclick = () => navigator.geolocation?.getCurrentPosition((p) => search(p).catch(C.fail), () => C.toast('Location not available'));
      on(el, {
        dep: () => formSheet('Dependent request', [{ k: 'kind', label: 'Request', type: 'select', options: [['dependent_add', 'Add a dependent'], ['dependent_remove', 'Remove a dependent']] }, { k: 'name', label: 'Dependent name', req: true }, { k: 'relation', label: 'Relation', type: 'select', options: [['spouse', 'Spouse'], ['son', 'Son'], ['daughter', 'Daughter'], ['father', 'Father'], ['mother', 'Mother']] }, { k: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { k: 'notes', label: 'Notes', full: true }], async (v) => { await C.api('/me/benefits/requests', { method: 'POST', body: { kind: v.kind, dependent: { name: v.name, relation: v.relation, dateOfBirth: v.dateOfBirth }, notes: v.notes } }); C.toast('Sent to HR'); reload(); }, 'Send'),
        card: () => formSheet('Replace insurance card', [{ k: 'notes', label: 'What happened?', full: true, req: true }], async (v) => { await C.api('/me/benefits/requests', { method: 'POST', body: { kind: 'card_replacement', ...v } }); C.toast('Sent to HR'); reload(); }, 'Send'),
      });
    }],
    ['things', 'My items & visa', async (el, reload) => {
      const [a, imm, deps] = await Promise.all([C.api('/me/assets'), C.api('/me/immigration'), C.api('/me/dependents')]);
      el.innerHTML = `<div class="xgrid">${imm.map((c) => panel(`Visa process · ${c.kind.replace(/_/g, ' ')}`, `<div class="steps" style="flex-wrap:wrap">${c.steps.map((s) => `<span class="${['done', 'skipped'].includes(s.status) ? 'done' : s.status === 'in_progress' || s.status === 'submitted' ? 'on' : ''}" title="${H(`${s.owner}${s.dueDate ? ` · by ${d10(s.dueDate)}` : ''}`)}">${H(s.name)}${s.owner === 'employee' && !['done', 'skipped'].includes(s.status) ? ' · your step' : ''}</span>`).join('')}</div>`)).join('')}
        ${panel('Company items with me', table([['Item', (x) => `${H(x.kind)} <span class="xmuted">${H(x.model || '')}</span>`], ['Tag', (x) => H(x.tag)], ['Since', (x) => d10(x.assignedAt)]], a.assets, { empty: 'Nothing assigned to you.' }) + table([['Requested', (r) => H(r.kind)], ['Status', (r) => st(r.status)]], a.requests, { empty: '' }), btn('Request an item', 'req'))}
        ${panel('My dependents', table([['Name', (d) => H(d.name)], ['Relation', (d) => H(d.relation)], ['Residence visa', (d) => d10(d.residenceExpiry)]], deps, { empty: 'No dependents on file.' }))}</div>`;
      on(el, { req: () => formSheet('Request an item', [{ k: 'kind', label: 'Item', type: 'select', options: [['laptop', 'Laptop'], ['phone', 'Phone'], ['sim', 'SIM'], ['access_card', 'Access card'], ['tools', 'Tools'], ['uniform', 'Uniform'], ['other', 'Other']] }, { k: 'neededBy', label: 'Needed by', type: 'date' }, { k: 'reason', label: 'Reason', req: true, full: true }], async (v) => { await C.api('/me/asset-requests', { method: 'POST', body: v }); C.toast('Sent to HR'); reload(); }, 'Send') });
    }],
  ]);
}

// ======================================================================= EMPLOYEE: GROWTH
async function egrowth() {
  return screen('egrowth', 'Growth', 'Your goals, feedback, recognition and surveys.', [
    ['goals', 'My goals', async (el, reload) => {
      const goals = await C.api('/me/goals');
      el.innerHTML = goals.length ? goals.map((g) => panel(g.title, `<div class="xrow" style="margin-bottom:8px"><div class="xprog" style="flex:1"><i style="width:${g.progress}%"></i></div><b>${g.progress}%</b></div>${(g.keyResults || []).map((k, i) => `<div class="xrow" style="padding:6px 0;border-top:1px solid var(--line)"><span style="flex:1">${H(k.title)}</span><input type="number" value="${k.current}" data-g="${g._id}" data-i="${i}" class="krIn" style="max-width:100px" aria-label="Progress for ${H(k.title)}"><span class="xmuted">/ ${k.target}</span></div>`).join('')}`, st(g.status))).join('<div style="height:12px"></div>') : '<div class="panel"><div class="empty">No goals assigned yet.</div></div>';
      $$('.krIn', el).forEach((i) => (i.onchange = async () => { try { await C.api(`/me/goals/${i.dataset.g}/kr/${i.dataset.i}`, { method: 'PATCH', body: { current: Number(i.value) } }); C.toast('Progress saved'); reload(); } catch (e) { C.fail(e); } }));
    }],
    ['fb', 'Feedback to give', async (el, reload) => {
      const rows = await C.api('/me/reviews');
      el.innerHTML = panel('Reviews', table([['About', (r) => `${H(r.subject?.fullName)}<div class="xmuted">${H(r.subject?.jobTitle || '')}</div>`], ['Review', (r) => `${H(r.kind.replace(/_/g, ' '))} · ${H(r.myRelation)}`], ['Due', (r) => d10(r.dueDate)], ['', (r) => (r.submitted ? C.pill('p-ok', 'sent') : btn('Give feedback', 'give', `data-id="${r._id}"`, 'pri sm'))]], rows, { empty: 'No feedback requested from you.' }));
      on(el, {
        give: (d) => {
          const r = rows.find((x) => x._id === d.id);
          const scale = r.competencies.map((c, i) => `<fieldset class="scale"><legend>${H(c)}</legend><div class="scale-row">${[1, 2, 3, 4, 5].map((n) => `<label class="sc"><input type="radio" name="c${i}" value="${n}" required><span class="sc-dot">${n}</span></label>`).join('')}</div></fieldset>`).join('');
          C.sheetForm(`Feedback · ${r.subject?.fullName}`, `${scale}<div class="field"><label class="lbl" for="fs">Strengths</label><textarea id="fs" rows="3"></textarea></div><div class="field"><label class="lbl" for="fi">What could be better</label><textarea id="fi" rows="3"></textarea></div><p class="xmuted">${r.myRelation === 'peer' || r.myRelation === 'report' ? 'Your name is not shown with peer feedback.' : ''}</p>`,
            async (s) => { const ratings = r.competencies.map((_, i) => Number($(`input[name="c${i}"]:checked`, s)?.value)); if (ratings.some((x) => !x)) throw new Error('Rate every item.'); await C.api(`/me/reviews/${r._id}`, { method: 'POST', body: { ratings, strengths: $('#fs', s).value, improvements: $('#fi', s).value } }); C.toast('Thank you'); reload(); }, 'Send feedback');
        },
      });
    }],
    ['rec', 'Recognition', async (el, reload) => {
      const feed = await C.api('/me/feed');
      const BADGE = { team_player: '🤝 Team player', customer_hero: '⭐ Customer hero', innovator: '💡 Innovator', above_and_beyond: '🚀 Above & beyond', mentor: '🎓 Mentor', safety_star: '🦺 Safety star' };
      el.innerHTML = panel('Wall of thanks', [...feed.announcements.slice(0, 5).map((a) => `<div class="feeditem"><div class="badge">📣</div><div><b>${H(a.title)}</b><div class="xmuted">${H(a.body || '')}</div></div></div>`), ...feed.recognition.map((r) => `<div class="feeditem"><div class="badge">${H((BADGE[r.badge] || '🏅').split(' ')[0])}</div><div><b>${H(r.toEmployeeId?.fullName)}</b> · ${H((BADGE[r.badge] || '').split(' ').slice(1).join(' '))} <span class="xmuted">from ${H(r.fromEmployeeId?.fullName || 'HR')}</span><div>${H(r.message)}</div></div></div>`)].join('') || '<div class="empty">Be the first to thank a colleague.</div>', btn('Thank a colleague', 'give', '', 'pri sm'));
      on(el, { give: async () => { const people = await C.api('/me/colleagues'); formSheet('Thank a colleague', [{ k: 'toEmployeeId', label: 'Colleague', type: 'select', options: people.map((p) => [p._id, `${p.fullName}${p.department ? ` · ${p.department}` : ''}`]), req: true }, { k: 'badge', label: 'Badge', type: 'select', options: Object.entries(BADGE) }, { k: 'message', label: 'Message', type: 'textarea', req: true }], async (v) => { await C.api('/me/recognition', { method: 'POST', body: v }); C.toast('Sent 🎉'); reload(); }, 'Send'); } });
    }],
    ['surv', 'Surveys', async (el, reload) => {
      const rows = await C.api('/me/surveys');
      el.innerHTML = rows.length ? rows.map((s) => panel(s.title, s.answered ? '<p>✓ Thanks, you have answered this survey.</p>' : `<form data-s="${s._id}">${s.questions.map((q) => (q.type === 'text' ? `<div class="field"><label class="lbl" for="${s._id}${q.id}">${H(q.text)}</label><textarea id="${s._id}${q.id}" name="${q.id}" rows="2"></textarea></div>` : `<fieldset class="scale"><legend>${H(q.text)}</legend><div class="scale-row">${Array.from({ length: q.type === 'scale10' ? 11 : 5 }, (_, i) => (q.type === 'scale10' ? i : i + 1)).map((n) => `<label class="sc"><input type="radio" name="${q.id}" value="${n}"><span class="sc-dot">${n}</span></label>`).join('')}</div></fieldset>`)).join('')}<p class="xmuted">Anonymous: results are only shown for groups of ${s.minGroupSize}+ people.</p><button class="btn pri">Submit</button></form>`)).join('<div style="height:12px"></div>') : '<div class="panel"><div class="empty">No open surveys.</div></div>';
      $$('form[data-s]', el).forEach((f) => (f.onsubmit = async (e) => { e.preventDefault(); const answers = {}; new FormData(f).forEach((v, k) => { if (v !== '') answers[k] = /^\d+$/.test(v) ? Number(v) : v; }); try { await C.api(`/me/surveys/${f.dataset.s}`, { method: 'POST', body: { answers } }); C.toast('Thank you'); reload(); } catch (err) { C.fail(err); } }));
    }],
  ]);
}

// ======================================================================= EMPLOYEE: SHIFTS
async function eshift() {
  return screen('eshift', 'My shifts', 'Your published roster and attendance corrections.', [
    ['ros', 'Roster', async (el) => {
      const rows = await C.api('/me/roster');
      el.innerHTML = panel('Next 4 weeks', rows.length ? `<div class="grid g4">${rows.map((r) => `<div class="xkpi" style="${r.shift ? `border-inline-start:4px solid ${r.shift.color}` : ''}"><span>${new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span><b style="font-size:16px">${r.restDay ? 'Rest day' : r.shift ? H(r.shift.name) : '—'}</b><span>${r.shift ? r.shift.segments.map((s) => `${s.start}–${s.end}`).join(' + ') : ''}</span></div>`).join('')}</div>` : '<div class="empty">No published shifts yet. Your manager publishes the roster.</div>');
    }],
    ['cor', 'Corrections', async (el, reload) => {
      const rows = await C.api('/me/attendance/disputes');
      el.innerHTML = panel('Attendance corrections', table([['Date', (r) => H(r.date)], ['Request', (r) => `${H(r.kind.replace(/_/g, ' '))}<div class="xmuted">${H(r.reason)}</div>`], ['Status', (r) => st(r.status)], ['Change made', (r) => (r.edit ? `<span class="xmuted">${r.edit.before?.clockIn ? new Date(r.edit.before.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—'} → ${r.edit.after?.clockIn ? new Date(r.edit.after.clockIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '—'} in · by ${H(r.edit.by || '')}</span>` : `<span class="xmuted">${H(r.decisionNote || '')}</span>`)]], rows, { empty: 'No corrections requested.' }), btn('Request a correction', 'new', '', 'pri sm'));
      on(el, { new: () => formSheet('Request a correction', [{ k: 'date', label: 'Date', type: 'date', value: addDays(today(), -1), req: true }, { k: 'kind', label: 'What happened', type: 'select', options: [['missed_punch', 'I forgot to clock in/out'], ['wrong_time', 'The time is wrong'], ['not_late', 'I was not late'], ['overtime_claim', 'Overtime not counted'], ['other', 'Other']] }, { k: 'requestedIn', label: 'Actual clock-in', type: 'time' }, { k: 'requestedOut', label: 'Actual clock-out', type: 'time' }, { k: 'reason', label: 'Explain', type: 'textarea', req: true }], async (v) => { await C.api('/me/attendance/disputes', { method: 'POST', body: v }); C.toast('Sent to your manager'); reload(); }, 'Send') });
    }],
  ]);
}

// ======================================================================= EMPLOYEE: VOICE ASSISTANT
async function evoice() {
  C.V(`<div class="xhead"><div><h1>Voice assistant</h1><p class="sub" style="margin:4px 0 0">Speak or type in English, العربية, हिन्दी, മലയാളം, اردو or Tagalog. Try “3 days annual leave from next Monday” or “salary certificate for Emirates NBD”.</p></div></div>
    <div class="grid g2" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))"><div class="panel" style="text-align:center"><button class="mic" id="mic" aria-label="Hold to talk">${C.icon(EXT_ICONS.evoice, 34)}</button><div class="xmuted" id="micMsg">Tap to start talking, tap again to send.</div>
      <form id="cpf" class="xrow" style="margin-top:16px"><input id="cpq" style="flex:1" placeholder="Or type your request…"><button class="btn pri">Send</button></form></div>
    <div class="panel"><div class="xsec"><h2>Conversation</h2></div><div id="cpLog" class="chat-log" aria-live="polite"></div></div></div>`);
  const log = $('#cpLog');
  const add = (who, html) => { log.insertAdjacentHTML('beforeend', `<div class="msg ${who === 'me' ? 'me' : ''}"><div class="bubble">${html}</div></div>`); log.scrollTop = log.scrollHeight; };
  const answer = (r) => add('ai', `${H(r.reply)}${r.pdfUrl ? `<div style="margin-top:8px"><button class="btn sm" data-pdf="${H(r.pdfUrl.replace('/api', ''))}">Download PDF</button></div>` : ''}`);
  log.onclick = (e) => { const b = e.target.closest('[data-pdf]'); if (b) C.openFile(b.dataset.pdf); };
  try { (await C.api('/me/copilot/history')).slice(0, 6).reverse().forEach((m) => { add('me', H(m.text)); add('ai', H(m.reply || '')); }); } catch { /* optional */ }
  $('#cpf').onsubmit = async (e) => { e.preventDefault(); const q = $('#cpq').value.trim(); if (!q) return; $('#cpq').value = ''; add('me', H(q)); try { answer(await C.api('/me/copilot', { method: 'POST', body: { text: q } })); } catch (err) { add('ai', `<span class="err">${H(err.message)}</span>`); } };
  let rec, chunks = [];
  $('#mic').onclick = async () => {
    const mic = $('#mic'), msg = $('#micMsg');
    if (rec?.state === 'recording') { rec.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { msg.textContent = 'Voice is not supported in this browser. Type instead.'; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); chunks = [];
      rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); mic.classList.remove('rec'); msg.textContent = 'Listening to your note…';
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        try { const r = await C.api('/me/copilot/voice', { method: 'POST', body: { audio: b64, mime: (blob.type || 'audio/webm').split(';')[0] } }); add('me', `🎙 ${H(r.transcript)}`); answer(r); msg.textContent = 'Tap to talk again.'; } catch (err) { msg.textContent = err.message; }
      };
      rec.start(); mic.classList.add('rec'); msg.textContent = 'Recording… tap to send.';
      setTimeout(() => rec?.state === 'recording' && rec.stop(), 60000);
    } catch { msg.textContent = 'Microphone permission was denied.'; }
  };
}

// ======================================================================= install
export function installExt(ctx) {
  C = ctx;
  Object.assign(ctx.views, { payplus, timeplus, people, talent, insights, platform, eservices, egrowth, eshift, evoice });
  ctx.STAFF_MODS.splice(ctx.STAFF_MODS.indexOf('audit') >= 0 ? ctx.STAFF_MODS.indexOf('audit') : ctx.STAFF_MODS.length, 0, ...EXT_STAFF);
  ctx.EMP_MODS.splice(ctx.EMP_MODS.indexOf('eai') >= 0 ? ctx.EMP_MODS.indexOf('eai') : ctx.EMP_MODS.length, 0, ...EXT_EMP);
  Object.assign(ctx.ICONS, EXT_ICONS);
  Object.assign(ctx.T.en, EXT_LABELS.en); Object.assign(ctx.T.ar, EXT_LABELS.ar);
}
