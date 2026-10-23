import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { User, Establishment, Employee, ComplianceDocument, LeaveRequest, PayrollRun, PayrollInput, WpsSifBatch, AuditLog, AgentRun } from '../models/index.js';
import { authenticate, requireRole, restrictEmployees, isStaff, signToken, audit, ah } from '../middleware/auth.js';
import { runAsSystem } from '../lib/tenantContext.js';
import { isValidUaeIban, maskIban } from '../lib/iban.js';
import { calculateLine, detectAnomalies } from '../lib/payroll.js';
import { preflight } from '../lib/wps.js';
import { calculateGratuity } from '../lib/eosb.js';
import { assessEmiratisation, nafisScenario } from '../lib/emiratisation.js';
import { getRulePack } from '../lib/rules.js';
import { toFils } from '../lib/money.js';
import { propose, execute } from '../lib/agent.js';
import { evaluateRequest, leaveDeductionDays } from '../lib/leave.js';
import { Tenant } from '../models/index.js';
import { verifyTotp } from '../lib/totp.js';
import { decryptField } from '../lib/fieldcrypt.js';

const r = Router();
const DAY = 86400000;
const daysUntil = (d) => Math.ceil((new Date(d) - Date.now()) / DAY);

// ---------------- Auth ----------------
r.post('/auth/login', ah(async (req, res) => {
  const { email, password, code } = z.object({ email: z.string().email(), password: z.string().min(1), code: z.string().optional() }).parse(req.body);
  const user = await runAsSystem(() => User.findOne({ email: email.toLowerCase(), active: true }).select('+passwordHash +mfaSecret').exec());
  const generic = () => res.status(401).json({ error: 'Email or password is incorrect.' });
  if (!user) { await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuuJ6dU3m3qQ7B6m0Yy6s8rC7mJ9W3pQyO'); return generic(); } // equalise timing
  if (user.lockedUntil && user.lockedUntil > new Date()) return res.status(423).json({ error: `Too many failed attempts. Try again after ${user.lockedUntil.toISOString().slice(11, 16)} UTC, or ask HR to unlock your account.` });
  const save = () => runAsSystem(() => user.save());
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    user.failedLogins = (user.failedLogins || 0) + 1;
    if (user.failedLogins >= 5) { user.lockedUntil = new Date(Date.now() + 15 * 60000); user.failedLogins = 0; }
    await save();
    return generic();
  }
  if (user.mfaEnabled) {
    if (!code) return res.status(401).json({ mfaRequired: true, error: 'Enter the 6-digit code from your authenticator app.' });
    if (!verifyTotp(decryptField(user.mfaSecret), code)) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= 5) { user.lockedUntil = new Date(Date.now() + 15 * 60000); user.failedLogins = 0; }
      await save();
      return res.status(401).json({ mfaRequired: true, error: 'That code is not valid. Codes change every 30 seconds.' });
    }
  }
  user.failedLogins = 0; user.lockedUntil = undefined; user.lastLoginAt = new Date();
  await save();
  const tenant = await runAsSystem(() => Tenant.findById(user.tenantId).lean());
  const staff = user.roles.some((x) => x !== 'employee');
  const mustEnrollMfa = !!tenant?.settings?.requireMfaForStaff && staff && !user.mfaEnabled;
  res.json({ token: signToken(user), user: { name: user.name, email: user.email, roles: user.roles, employeeId: user.employeeId, mfaEnabled: user.mfaEnabled, mustEnrollMfa } });
}));

r.use(authenticate);
r.use(restrictEmployees);

r.get('/me', ah(async (req, res) => res.json(req.user)));

// ---------------- Establishments ----------------
r.get('/establishments', ah(async (req, res) => res.json(await Establishment.find().lean())));

// ---------------- Employees ----------------
const empPublic = (e) => ({ ...e, bank: { bankName: e.bank?.bankName, ibanMasked: e.bank?.ibanLast4 ? `AE•• •••• ${e.bank.ibanLast4}` : null } });

r.get('/employees', ah(async (req, res) => {
  const q = {};
  if (req.query.establishmentId) q.establishmentId = req.query.establishmentId;
  if (req.query.status) q.status = req.query.status;
  const list = await Employee.find(q).select('+bank.iban').sort({ fullName: 1 }).lean();
  res.json(list.map((e) => ({ ...empPublic(e), ibanValid: isValidUaeIban(e.bank?.iban) })));
}));

const empInput = z.object({
  establishmentId: z.string(), employeeNo: z.string(), fullName: z.string().min(2), fullNameAr: z.string().optional(), email: z.string().email().optional(), phone: z.string().max(30).optional(),
  nationality: z.string(), isUaeNational: z.boolean().default(false), jobTitle: z.string(), department: z.string().optional(),
  mohreSkillLevel: z.number().int().min(1).max(9).optional(), joinDate: z.string(),
  contractType: z.enum(['full-time', 'part-time', 'temporary', 'flexible']).default('full-time'),
  basic: z.union([z.string(), z.number()]), housing: z.union([z.string(), z.number()]).default(0), transport: z.union([z.string(), z.number()]).default(0),
  iban: z.string().optional(), routingCode: z.string().regex(/^\d{9}$/).optional(), labourCardNo: z.string().regex(/^\d{14}$/).optional(),
});

r.post('/employees', requireRole('hr_admin'), ah(async (req, res) => {
  const b = empInput.parse(req.body);
  if (b.iban && !isValidUaeIban(b.iban)) return res.status(400).json({ error: 'IBAN fails the UAE checksum. Check the 23 characters starting with AE.' });
  const emp = await Employee.create({
    ...b, joinDate: new Date(b.joinDate),
    compensation: { basicFils: toFils(b.basic), housingFils: toFils(b.housing), transportFils: toFils(b.transport), effectiveFrom: new Date(b.joinDate) },
    bank: { iban: b.iban, routingCode: b.routingCode },
  });
  await audit(req, 'employee.create', 'Employee', emp._id, null, { fullName: emp.fullName });
  res.status(201).json(empPublic(emp.toObject()));
}));

r.patch('/employees/:id/bank', requireRole('hr_admin'), ah(async (req, res) => {
  const { iban, routingCode } = z.object({ iban: z.string(), routingCode: z.string().regex(/^\d{9}$/).optional() }).parse(req.body);
  if (!isValidUaeIban(iban)) return res.status(400).json({ error: 'IBAN fails the UAE checksum.' });
  const emp = await Employee.findById(req.params.id).select('+bank.iban +bank.routingCode');
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const before = maskIban(decryptField(emp.bank.iban));
  emp.bank.iban = iban; if (routingCode) emp.bank.routingCode = routingCode;
  await emp.save();
  await audit(req, 'employee.bank.update', 'Employee', emp._id, { iban: before }, { iban: maskIban(iban) });
  res.json({ ok: true, ibanMasked: maskIban(iban) });
}));

// ---------------- Documents ----------------
r.get('/documents/expiring', ah(async (req, res) => {
  const within = Number(req.query.days || 90);
  const docs = await ComplianceDocument.find({ expiryDate: { $lte: new Date(Date.now() + within * DAY) } }).populate('employeeId', 'fullName').populate('establishmentId', 'name').sort({ expiryDate: 1 }).lean();
  res.json(docs.map((d) => ({ ...d, holder: d.employeeId?.fullName || d.establishmentId?.name, daysLeft: daysUntil(d.expiryDate) })));
}));

r.post('/documents/:id/renewal', requireRole('hr_admin'), ah(async (req, res) => {
  const steps = { residence_visa: ['Medical fitness', 'EID biometrics', 'Visa stamping'], emirates_id: ['Typing centre application', 'Biometrics', 'Card collection'] };
  const doc = await ComplianceDocument.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  doc.renewalCase = { status: 'open', ownerUserId: req.user.id, steps: (steps[doc.docType] || ['Collect new copy', 'Verify', 'Upload']).map((name) => ({ name, done: false })) };
  await doc.save();
  await audit(req, 'document.renewal.open', 'ComplianceDocument', doc._id, null, { docType: doc.docType });
  res.json(doc.renewalCase);
}));

// ---------------- Leave ----------------
r.get('/leave', ah(async (req, res) => {
  const q = req.query.status ? { status: req.query.status } : {};
  const list = await LeaveRequest.find(q).populate('employeeId', 'fullName department').sort({ startDate: 1 }).lean();
  // overlap detection within the same department
  const approvedOrPending = list.filter((l) => ['pending', 'approved'].includes(l.status));
  for (const l of list) {
    l.overlaps = approvedOrPending.filter((o) => o._id !== l._id && String(o._id) !== String(l._id) && o.employeeId?.department === l.employeeId?.department && o.startDate <= l.endDate && o.endDate >= l.startDate).map((o) => o.employeeId?.fullName);
  }
  res.json(list);
}));

r.post('/leave', ah(async (req, res) => {
  const b = z.object({ employeeId: z.string().optional(), type: z.enum(['annual', 'sick', 'maternity', 'parental', 'hajj', 'unpaid', 'other']), startDate: z.string(), endDate: z.string(), reason: z.string().optional(), childBirthDate: z.string().optional(), certificateAttached: z.boolean().optional(), preview: z.boolean().optional() }).parse(req.body);
  // Employees can only request leave for themselves
  const selfOnly = !req.user.roles.some((r) => ['owner', 'hr_admin', 'manager'].includes(r));
  const employeeId = selfOnly ? req.user.employeeId : (b.employeeId || req.user.employeeId);
  if (!employeeId) return res.status(400).json({ error: 'Choose an employee.' });
  const employee = await Employee.findById(employeeId).lean();
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  const est = await Establishment.findById(employee.establishmentId).lean();
  const existing = await LeaveRequest.find({ employeeId }).lean();
  const ev = evaluateRequest({ employee, request: b, existing, rulePackId: est?.rulePackId });
  if (b.preview) return res.json(ev);
  if (!ev.ok) return res.status(400).json({ error: ev.errors.join(' '), ...ev });
  const lr = await LeaveRequest.create({ employeeId, type: b.type, startDate: b.startDate, endDate: b.endDate, reason: b.reason, days: ev.days, ...ev.split, childBirthDate: b.childBirthDate, certificateAttached: b.certificateAttached, warnings: ev.warnings, source: req.body.source === 'mobile' ? 'mobile' : 'web' });
  await audit(req, 'leave.create', 'LeaveRequest', lr._id, null, { type: b.type, days: ev.days, split: ev.split });
  res.status(201).json({ ...lr.toObject(), warnings: ev.warnings, balances: ev.balances });
}));

r.post('/leave/:id/decision', requireRole('hr_admin', 'manager'), ah(async (req, res) => {
  const { decision } = z.object({ decision: z.enum(['approved', 'rejected']) }).parse(req.body);
  const lr = await LeaveRequest.findById(req.params.id);
  if (!lr || lr.status !== 'pending') return res.status(400).json({ error: 'Only pending requests can be decided.' });
  lr.status = decision; lr.decidedBy = req.user.id; lr.decidedAt = new Date();
  await lr.save();
  await audit(req, `leave.${decision}`, 'LeaveRequest', lr._id, { status: 'pending' }, { status: decision });
  res.json(lr);
}));

// ---------------- Payroll ----------------
const prevPeriod = (p) => { const [y, m] = p.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

async function computeRun(establishment, period) {
  const pack = getRulePack(establishment.rulePackId, `${period}-01`);
  const emps = await Employee.find({ establishmentId: establishment._id, status: { $in: ['active', 'notice'] } }).select('+bank.iban').lean();
  const inputs = await PayrollInput.find({ period, employeeId: { $in: emps.map((e) => e._id) } }).lean();
  const prev = await PayrollRun.findOne({ establishmentId: establishment._id, period: prevPeriod(period), type: 'regular' }).lean();
  // Approved unpaid / half-pay leave flows into payroll automatically
  const [py, pm] = period.split('-').map(Number);
  const pStart = new Date(Date.UTC(py, pm - 1, 1)), pEnd = new Date(Date.UTC(py, pm, 0));
  const leaves = await LeaveRequest.find({ employeeId: { $in: emps.map((e) => e._id) }, status: 'approved', startDate: { $lte: pEnd }, endDate: { $gte: pStart } }).lean();
  const lines = emps.map((e) => {
    const inp = { ...(inputs.find((i) => String(i.employeeId) === String(e._id)) || {}) };
    const leaveDays = leaveDeductionDays(leaves.filter((l) => String(l.employeeId) === String(e._id)), pStart, pEnd);
    inp.unpaidLeaveDays = (inp.unpaidLeaveDays || 0) + leaveDays;
    const line = calculateLine(e, inp, { jurisdiction: establishment.rulePackId, onDate: `${period}-01` });
    if (leaveDays) line.flags.push({ code: 'LEAVE_DEDUCTION', severity: 'info', msg: `${leaveDays} day(s) of unpaid/half-pay leave from approved requests` });
    const p = prev?.lines.find((l) => String(l.employeeId) === String(e._id));
    line.flags.push(...detectAnomalies(line, p, e, pack));
    if (!isValidUaeIban(e.bank?.iban)) line.flags.push({ code: 'IBAN_INVALID', severity: 'block', msg: 'Invalid IBAN: salary held from WPS file' });
    line.held = line.flags.some((f) => f.severity === 'block');
    line.employeeName = e.fullName;
    return line;
  });
  const sum = (k, f = () => true) => lines.filter(f).reduce((a, l) => a + l[k], 0);
  const inputsHash = createHash('sha256').update(JSON.stringify({ emps: emps.map((e) => [e._id, e.compensation, e.bank?.iban]), inputs, leaves: leaves.map((l) => [l._id, l.unpaidDays, l.halfDays]) })).digest('hex');
  return { lines, totals: { grossFils: sum('grossFils'), netFils: sum('netFils'), heldFils: sum('netFils', (l) => l.held) }, rulePack: `${pack.id}@${pack.version}`, inputsHash };
}

r.post('/payroll/runs', requireRole('payroll_maker', 'hr_admin'), ah(async (req, res) => {
  const { establishmentId, period } = z.object({ establishmentId: z.string(), period: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.body);
  const est = await Establishment.findById(establishmentId);
  if (!est) return res.status(404).json({ error: 'Establishment not found' });
  const existing = await PayrollRun.findOne({ establishmentId, period, type: 'regular' });
  if (existing?.locked) return res.status(409).json({ error: 'This payroll is approved and locked. Use an off-cycle run for corrections.' });
  const calc = await computeRun(est, period);
  const run = existing || new PayrollRun({ establishmentId, period, type: 'regular', runNo: 0 });
  Object.assign(run, calc, { status: 'draft', makerId: req.user.id });
  await run.save();
  await audit(req, 'payroll.compute', 'PayrollRun', run._id, null, { period, totals: run.totals });
  res.json(run);
}));

r.get('/payroll/runs', ah(async (req, res) => res.json(await PayrollRun.find(req.query.type ? { type: req.query.type } : {}).select('-lines').sort({ period: -1, runNo: 1 }).lean())));
r.get('/payroll/runs/:id', ah(async (req, res) => res.json(await PayrollRun.findById(req.params.id).lean())));

async function buildPreflight(run) {
  const est = await Establishment.findById(run.establishmentId).lean();
  const emps = await Employee.find({ _id: { $in: run.lines.map((l) => l.employeeId) } }).select('+bank.iban +bank.routingCode +labourCardNo').lean();
  const [y, m] = run.period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const rows = run.lines.map((l) => {
    const e = emps.find((x) => String(x._id) === String(l.employeeId));
    return { name: e.fullName, labourCardNo: e.labourCardNo, routingCode: e.bank?.routingCode, iban: e.bank?.iban, periodStart: `${run.period}-01`, periodEnd: `${run.period}-${last}`, days: last, fixedFils: l.fixedFils, variableFils: l.variableFils, leaveDays: Math.ceil(l.unpaidLeaveDays || 0) };
  });
  const pf = preflight({ establishment: { mohreId: est.mohreId, agentRoutingCode: est.wps?.agentRoutingCode }, salaryMonth: run.period, createdAt: new Date(), rows });
  const warnings = run.lines.flatMap((l) => l.flags.filter((f) => f.severity !== 'block').map((f) => ({ id: f.code, status: 'warn', label: f.msg, detail: l.employeeName })));
  return { ...pf, checks: [...pf.checks, ...warnings] };
}

r.get('/payroll/runs/:id/preflight', ah(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id).lean();
  if (!run) return res.status(404).json({ error: 'Payroll run not found' });
  const pf = await buildPreflight(run);
  delete pf.content;
  res.json(pf);
}));

r.post('/payroll/runs/:id/submit', requireRole('payroll_maker', 'hr_admin'), ah(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  const pf = await buildPreflight(run.toObject());
  run.status = pf.blocking ? 'preflight_failed' : 'pending_approval';
  await run.save();
  await audit(req, 'payroll.submit', 'PayrollRun', run._id, null, { status: run.status, blocking: pf.blocking });
  res.json({ status: run.status, blocking: pf.blocking });
}));

r.post('/payroll/runs/:id/approve', requireRole('payroll_checker'), ah(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (run.status !== 'pending_approval') return res.status(400).json({ error: 'Run is not waiting for approval.' });
  if (String(run.makerId) === req.user.id) return res.status(403).json({ error: 'Maker and checker must be different people.' });
  const est = await Establishment.findById(run.establishmentId);
  if (run.type === 'regular') {
    const fresh = await computeRun(est, run.period);
    if (fresh.inputsHash !== run.inputsHash) return res.status(409).json({ error: 'Inputs changed since this run was computed. Recompute before approving.' });
  }
  if (run.type === 'final' && run.settlement?.employeeId) {
    await Employee.updateOne({ _id: run.settlement.employeeId }, { status: 'exited', exitDate: new Date(run.settlement.lastWorkingDate) });
  }
  Object.assign(run, { status: 'approved', checkerId: req.user.id, approvedAt: new Date(), locked: true });
  await run.save();
  await audit(req, 'payroll.approve', 'PayrollRun', run._id, { status: 'pending_approval' }, { status: 'approved' });
  res.json(run);
}));

r.post('/payroll/runs/:id/sif', requireRole('payroll_maker', 'payroll_checker', 'hr_admin'), ah(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!['approved', 'exported'].includes(run.status)) return res.status(400).json({ error: 'Payroll must be approved by a checker before the SIF file can be exported.' });
  const pf = await buildPreflight(run.toObject());
  if (pf.blocking) return res.status(400).json({ error: 'Pre-flight has blocking errors.', checks: pf.checks });
  const batch = await WpsSifBatch.create({ payrollRunId: run._id, filename: pf.filename, content: pf.content, checks: pf.checks, totalFils: pf.totalFils, recordCount: pf.recordCount, generatedBy: req.user.id });
  run.status = 'exported'; await run.save();
  await audit(req, 'wps.sif.export', 'WpsSifBatch', batch._id, null, { filename: pf.filename, totalFils: pf.totalFils });
  res.json({ filename: pf.filename, content: pf.content });
}));

// ---------------- Compliance ----------------
r.get('/compliance/emiratisation', ah(async (req, res) => {
  const ests = await Establishment.find().lean();
  const out = [];
  for (const est of ests) {
    const emps = await Employee.find({ establishmentId: est._id }).lean();
    out.push({ establishment: { id: est._id, name: est.name }, ...assessEmiratisation({ employees: emps, establishment: est }) });
  }
  res.json(out);
}));

r.get('/compliance/nafis', ah(async (req, res) => res.json(nafisScenario({ grossWageFils: toFils(req.query.wage || '6500') }))));

r.post('/compliance/gratuity', ah(async (req, res) => {
  const b = z.object({ employeeId: z.string(), lastWorkingDate: z.string(), unpaidLeaveDays: z.number().int().min(0).default(0), scheme: z.string().optional() }).parse(req.body);
  const emp = await Employee.findById(b.employeeId).lean();
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const est = await Establishment.findById(emp.establishmentId).lean();
  const tenant = await runAsSystem(() => Tenant.findById(req.user.tenantId).lean());
  const c = emp.compensation;
  const totalMonthlyFils = c.basicFils + c.housingFils + c.transportFils + (c.allowances || []).reduce((a, x) => a + x.amountFils, 0);
  res.json(calculateGratuity({ basicMonthlyFils: c.basicFils, totalMonthlyFils, joinDate: emp.joinDate, lastWorkingDate: b.lastWorkingDate, unpaidLeaveDays: b.unpaidLeaveDays, jurisdiction: est.rulePackId, scheme: b.scheme, capBasis: tenant?.settings?.gratuityCapBasis }));
}));

// ---------------- Dashboard ----------------
r.get('/dashboard', ah(async (req, res) => {
  const [headcount, nationals, expiring, pendingLeave, lastRun, emi] = await Promise.all([
    Employee.countDocuments({ status: 'active' }),
    Employee.countDocuments({ status: 'active', isUaeNational: true }),
    ComplianceDocument.find({ expiryDate: { $lte: new Date(Date.now() + 30 * DAY) } }).populate('employeeId', 'fullName').populate('establishmentId', 'name').sort({ expiryDate: 1 }).lean(),
    LeaveRequest.countDocuments({ status: 'pending' }),
    PayrollRun.findOne({ type: { $in: ['regular', null] } }).sort({ period: -1 }).lean(),
    (async () => { const ests = await Establishment.find().lean(); let ex = 0; const items = []; for (const est of ests) { const a = assessEmiratisation({ employees: await Employee.find({ establishmentId: est._id }).lean(), establishment: est }); if (a.applicable) { ex += a.monthlyExposureFils; items.push(a); } } return { exposureFils: ex, items }; })(),
  ]);
  const actions = [];
  const held = lastRun?.lines.filter((l) => l.held) || [];
  if (held.length) actions.push({ severity: 'bad', text: `WPS file blocked: ${held.length} salary line(s) held (${held.map((l) => l.employeeName).join(', ')})`, go: 'pay' });
  for (const d of expiring.slice(0, 3)) actions.push({ severity: daysUntil(d.expiryDate) <= 14 ? 'bad' : 'warn', text: `${d.employeeId?.fullName || d.establishmentId?.name}: ${d.docType.replace(/_/g, ' ')} expires in ${daysUntil(d.expiryDate)} days`, go: 'docs' });
  for (const a of emi.items.filter((x) => x.gap > 0)) actions.push({ severity: 'warn', text: `Emiratisation: ${a.qualifyingCount} of ${a.required} qualifying UAE nationals`, go: 'emi' });
  const spikes = lastRun?.lines.filter((l) => l.flags.some((f) => f.code === 'VARIABLE_SPIKE' || f.code === 'VARIABLE_HIGH')) || [];
  for (const s of spikes) actions.push({ severity: 'warn', text: `${s.employeeName}: unusual variable pay this month. Confirm before payroll.`, go: 'pay' });
  if (pendingLeave) actions.push({ severity: 'info', text: `${pendingLeave} leave request(s) waiting for a decision`, go: 'leave' });
  res.json({ headcount, nationals, expiringCount: expiring.length, exposureFils: emi.exposureFils, lastRun: lastRun && { id: lastRun._id, period: lastRun.period, status: lastRun.status, totals: lastRun.totals }, actions });
}));

// ---------------- Audit ----------------
r.get('/audit', requireRole('hr_admin'), ah(async (req, res) => res.json(await AuditLog.find().sort({ createdAt: -1 }).limit(100).lean())));

// ---------------- AI agent (propose → approve → execute) ----------------
r.post('/agent/propose', ah(async (req, res) => {
  const { command } = z.object({ command: z.string().min(3).max(500) }).parse(req.body);
  const proposal = await propose(command, req.user);
  const run = await AgentRun.create({ userId: req.user.id, command, intent: proposal.intent, proposal });
  res.json({ id: run._id, ...proposal });
}));

r.post('/agent/:id/execute', ah(async (req, res) => {
  const run = await AgentRun.findById(req.params.id);
  if (!run || run.status !== 'proposed') return res.status(400).json({ error: 'This proposal was already handled or has expired.' });
  if (String(run.userId) !== req.user.id) return res.status(403).json({ error: 'Only the person who issued the command can approve it.' });
  if (!isStaff(req.user)) {
    if (run.intent === 'hire') return res.status(403).json({ error: 'Only HR can hire.' });
    if (run.proposal?.params?.employeeId && String(run.proposal.params.employeeId) !== String(req.user.employeeId)) return res.status(403).json({ error: 'You can only make requests for yourself.' });
  }
  try {
    const result = await execute(run.proposal, req);
    Object.assign(run, { status: 'executed', result });
    await run.save();
    await audit(req, `agent.${run.intent}`, 'AgentRun', run._id, null, result, 'agent');
    res.json(result);
  } catch (e) {
    run.status = 'failed'; run.result = { error: e.message }; await run.save();
    res.status(400).json({ error: e.message });
  }
}));

r.post('/agent/:id/discard', ah(async (req, res) => { await AgentRun.updateOne({ _id: req.params.id, status: 'proposed' }, { status: 'discarded' }); res.json({ ok: true }); }));

export default r;
