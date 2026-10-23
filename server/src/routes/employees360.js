// Employee 360: everything HR needs about one employee on a single page, plus editing and login management.
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes, createHmac } from 'node:crypto';
import { Employee, Establishment, LeaveRequest, PayrollRun, ComplianceDocument, ServiceRequest, Attendance, User, AuditLog } from '../models/index.js';
import { authenticate, requireRole, restrictEmployees, audit, ah } from '../middleware/auth.js';
import { leaveBalances } from '../lib/leave.js';
import { summarize } from '../lib/attendance.js';
import { toFils } from '../lib/money.js';
import { isValidUaeIban } from '../lib/iban.js';
import { runAsSystem } from '../lib/tenantContext.js';
import { config } from '../config.js';

const r = Router();
r.use(authenticate, restrictEmployees);
const STAFF = requireRole('hr_admin', 'manager', 'payroll_maker', 'payroll_checker');
const DAY = 864e5;
const tagSig = (tid, eid) => createHmac('sha256', config.jwtSecret).update(`wasl-tag:${tid}:${eid}`).digest('base64url').slice(0, 22);

r.get('/employees/:id/full', STAFF, ah(async (req, res) => {
  const e = await Employee.findById(req.params.id).select('+labourCardNo').lean();
  if (!e) return res.status(404).json({ error: 'Employee not found' });
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  const [est, leaves, docs, requests, runs, att, login, activity] = await Promise.all([
    Establishment.findById(e.establishmentId).select('name nameAr jurisdiction freeZone rulePackId geo shift').lean(),
    LeaveRequest.find({ employeeId: e._id }).sort({ startDate: -1 }).lean(),
    ComplianceDocument.find({ employeeId: e._id }).sort({ expiryDate: 1 }).lean(),
    ServiceRequest.find({ employeeId: e._id }).sort({ createdAt: -1 }).limit(30).lean(),
    PayrollRun.find({ 'lines.employeeId': e._id }).select('period type status lines.$ establishmentId').sort({ period: -1 }).limit(24).lean(),
    Attendance.find({ employeeId: e._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } }).sort({ date: -1, seq: 1 }).lean(),
    runAsSystem(() => User.findOne({ tenantId: req.user.tenantId, employeeId: e._id }).select('email roles active lastLoginAt mfaEnabled').lean()).catch(() => null),
    AuditLog.find({ entityId: String(e._id) }).sort({ createdAt: -1 }).limit(25).lean(),
  ]);
  const { labourCardNo, bank, ...rest } = e;
  res.json({
    employee: { ...rest, labourCardLast4: labourCardNo ? String(labourCardNo).slice(-4) : null, bank: { bankName: bank?.bankName, ibanMasked: bank?.ibanLast4 ? `AE•• •••• ${bank.ibanLast4}` : null } },
    establishment: est,
    balances: leaveBalances({ employee: e, requests: leaves, rulePackId: est?.rulePackId }),
    leaves,
    documents: docs.map((d) => ({ _id: d._id, docType: d.docType, number: d.number ? `•••• ${String(d.number).slice(-4)}` : null, issueDate: d.issueDate, expiryDate: d.expiryDate, daysLeft: Math.ceil((new Date(d.expiryDate) - Date.now()) / DAY), hasFile: !!d.storageKey, renewalCase: d.renewalCase })),
    requests,
    payslips: runs.map((run) => ({ runId: run._id, period: run.period, type: run.type || 'regular', status: run.status, netFils: run.lines[0]?.netFils || 0, grossFils: run.lines[0]?.grossFils || 0 })),
    attendance: { month, records: att.map(({ photo, ...a }) => a), summary: summarize(att) },
    login: login ? { email: login.email, roles: login.roles, active: login.active !== false, lastLoginAt: login.lastLoginAt, mfaEnabled: !!login.mfaEnabled } : null,
    tagToken: `WASL1.${req.user.tenantId}.${e._id}.${tagSig(req.user.tenantId, e._id)}`,
    activity: activity.map((a) => ({ action: a.action, actorType: a.actorType, at: a.createdAt, after: a.after })),
  });
}));

const money = z.union([z.string(), z.number()]);
const editSchema = z.object({
  fullName: z.string().min(2).max(120), fullNameAr: z.string().max(120).nullable(), email: z.string().email().nullable().or(z.literal('')), phone: z.string().max(30).nullable(),
  nationality: z.string().max(60), isUaeNational: z.boolean(), gender: z.enum(['M', 'F']).nullable(), dateOfBirth: z.string().nullable(),
  jobTitle: z.string().max(120), department: z.string().max(80), mohreSkillLevel: z.number().int().min(1).max(9).nullable(),
  contractType: z.enum(['full-time', 'part-time', 'temporary', 'flexible']), joinDate: z.string(), probationEndDate: z.string().nullable(),
  status: z.enum(['onboarding', 'active', 'notice', 'exited']), exitDate: z.string().nullable(), pensionRegistered: z.boolean(), paidViaWps: z.boolean(),
  establishmentId: z.string(), emiratesIdLast4: z.string().regex(/^\d{4}$/).nullable().or(z.literal('')), labourCardNo: z.string().regex(/^\d{14}$/).or(z.literal('')),
  basic: money, housing: money, transport: money,
  iban: z.string(), routingCode: z.string().regex(/^\d{9}$/).or(z.literal('')), bankName: z.string().max(80),
  emergencyContacts: z.array(z.object({ name: z.string().max(80), relation: z.string().max(40), phone: z.string().max(30) })).max(5),
}).partial();

r.patch('/employees/:id', requireRole('hr_admin'), ah(async (req, res) => {
  const b = editSchema.parse(req.body);
  const emp = await Employee.findById(req.params.id).select('+bank.iban +bank.routingCode +labourCardNo');
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const before = {}, after = {};
  const set = (key, val) => { const old = emp.get(key); if (String(old ?? '') !== String(val ?? '')) { before[key] = old instanceof Date ? old.toISOString().slice(0, 10) : old; after[key] = val; emp.set(key, val); } };
  for (const k of ['fullName', 'fullNameAr', 'email', 'phone', 'nationality', 'isUaeNational', 'gender', 'jobTitle', 'department', 'mohreSkillLevel', 'contractType', 'status', 'pensionRegistered', 'paidViaWps', 'emiratesIdLast4']) if (k in b) set(k, b[k] === '' ? null : b[k]);
  for (const k of ['dateOfBirth', 'joinDate', 'probationEndDate', 'exitDate']) if (k in b) set(k, b[k] ? new Date(b[k]) : null);
  if ('establishmentId' in b) { if (!(await Establishment.exists({ _id: b.establishmentId }))) return res.status(400).json({ error: 'Unknown establishment.' }); set('establishmentId', b.establishmentId); }
  if ('labourCardNo' in b && b.labourCardNo) { emp.labourCardNo = b.labourCardNo; after.labourCardNo = `•••• ${b.labourCardNo.slice(-4)}`; }
  if ('iban' in b && b.iban) {
    const iban = b.iban.replace(/\s/g, '').toUpperCase();
    if (!isValidUaeIban(iban)) return res.status(400).json({ error: 'IBAN fails the UAE checksum. Check the 23 characters starting with AE.' });
    emp.bank.iban = iban; after.iban = `•••• ${iban.slice(-4)}`;
  }
  if ('routingCode' in b && b.routingCode) { emp.bank.routingCode = b.routingCode; after.routingCode = b.routingCode; }
  if ('bankName' in b) set('bank.bankName', b.bankName);
  if (['basic', 'housing', 'transport'].some((k) => k in b)) {
    const c = emp.compensation;
    const next = { basicFils: 'basic' in b ? toFils(b.basic) : c.basicFils, housingFils: 'housing' in b ? toFils(b.housing) : c.housingFils, transportFils: 'transport' in b ? toFils(b.transport) : c.transportFils };
    if (next.basicFils !== c.basicFils || next.housingFils !== c.housingFils || next.transportFils !== c.transportFils) {
      emp.compensationHistory.push({ effectiveFrom: c.effectiveFrom || emp.joinDate, basicFils: c.basicFils, housingFils: c.housingFils, transportFils: c.transportFils, changedBy: req.user.id });
      before.compensation = { basicFils: c.basicFils, housingFils: c.housingFils, transportFils: c.transportFils }; after.compensation = next;
      Object.assign(emp.compensation, next, { effectiveFrom: new Date() });
    }
  }
  if ('emergencyContacts' in b) { emp.emergencyContacts = b.emergencyContacts; after.emergencyContacts = b.emergencyContacts.length; }
  if (!Object.keys(after).length) return res.json({ ok: true, changed: [] });
  await emp.save();
  await audit(req, 'employee.update', 'Employee', emp._id, before, after);
  res.json({ ok: true, changed: Object.keys(after) });
}));

// Employee login account: create, reset password, enable/disable
r.post('/employees/:id/login', requireRole('hr_admin'), ah(async (req, res) => {
  const b = z.object({ action: z.enum(['create', 'reset', 'disable', 'enable']), email: z.string().email().optional(), password: z.string().min(8, 'Password must be at least 8 characters.').max(72).optional() }).parse(req.body);
  const emp = await Employee.findById(req.params.id).lean();
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  const tempPassword = () => `Wasl-${randomBytes(4).toString('hex')}`;
  const user = await runAsSystem(() => User.findOne({ tenantId: req.user.tenantId, employeeId: emp._id }));
  if (b.action === 'create') {
    if (user) return res.status(409).json({ error: 'This employee already has a login.' });
    const email = (b.email || emp.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'Add an email for this employee first.' });
    if (await runAsSystem(() => User.exists({ email }))) return res.status(409).json({ error: 'That email is already used by another login.' });
    const pw = b.password || tempPassword(); // HR may set it, otherwise a temporary one is generated
    await User.create({ email, name: emp.fullName, passwordHash: await bcrypt.hash(pw, 10), roles: ['employee'], employeeId: emp._id });
    if (!emp.email) await Employee.updateOne({ _id: emp._id }, { $set: { email } });
    await audit(req, 'employee.login.create', 'Employee', emp._id, null, { email });
    return res.status(201).json({ email, tempPassword: pw, message: 'Login created. Share the temporary password privately; the employee should change it after signing in.' });
  }
  if (!user) return res.status(404).json({ error: 'This employee has no login yet.' });
  if (b.action === 'reset') {
    const pw = b.password || tempPassword();
    user.passwordHash = await bcrypt.hash(pw, 10); await runAsSystem(() => user.save());
    await audit(req, 'employee.login.reset', 'Employee', emp._id);
    return res.json({ email: user.email, tempPassword: pw, message: 'Password reset.' });
  }
  user.active = b.action === 'enable'; await runAsSystem(() => user.save());
  await audit(req, `employee.login.${b.action}`, 'Employee', emp._id);
  res.json({ email: user.email, active: user.active, message: b.action === 'enable' ? 'Login enabled.' : 'Login disabled. The employee can no longer sign in.' });
}));

export default r;
