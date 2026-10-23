import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantContext.js';
import { encryptField, decryptField } from '../lib/fieldcrypt.js';

const { Schema, model } = mongoose;
const Id = Schema.Types.ObjectId;
const fils = { type: Number, default: 0, validate: { validator: Number.isInteger, message: 'Money must be integer fils' } };

// ---------- Tenant (platform-level, not tenant-scoped) ----------
export const Tenant = model('Tenant', new Schema({
  name: { type: String, required: true },
  plan: { type: String, enum: ['starter', 'growth', 'enterprise'], default: 'starter' },
  defaultLanguage: { type: String, enum: ['en', 'ar'], default: 'en' },
  settings: {
    payrollCutoffDay: { type: Number, default: 25 }, gratuityDailyDivisor: { type: Number, default: 365 },
    gratuityCapBasis: { type: String, enum: ['total', 'basic'], default: 'total' },
    checklist: { backupsConfigured: Boolean, legalReviewDone: Boolean, bankFormatVerified: Boolean, staffTrained: Boolean },
    requireMfaForStaff: { type: Boolean, default: false },
    // UAE PDPL (Federal Decree-Law 45/2021) retention schedule — confirm periods with counsel
    retention: {
      notificationsDays: { type: Number, default: 180 },
      agentRunsDays: { type: Number, default: 365 },
      exitedEmployeeYears: { type: Number, default: 5 }, // personal data anonymised after this; payroll records kept
      sifFilesYears: { type: Number, default: 5 },
    },
  },
}, { timestamps: true }));

// ---------- Users ----------
const userSchema = new Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  name: String,
  passwordHash: { type: String, required: true, select: false },
  roles: [{ type: String, enum: ['owner', 'hr_admin', 'payroll_maker', 'payroll_checker', 'manager', 'employee'] }],
  employeeId: { type: Id, ref: 'Employee' },
  establishmentIds: [{ type: Id, ref: 'Establishment' }],
  active: { type: Boolean, default: true },
  // security
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, select: false }, // encrypted
  failedLogins: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLoginAt: Date,
  // self-service password: HR issues a one-time code; the employee sets their own password with it
  passwordSet: { type: Boolean, default: true },
  setupCodeHash: { type: String, select: false },
  setupCodeExpires: Date,
  setupCodeAttempts: { type: Number, default: 0 },
}, { timestamps: true });
userSchema.plugin(tenantPlugin);
userSchema.index({ email: 1 }, { unique: true }); // email unique across platform for login
export const User = model('User', userSchema);

// ---------- Establishments (trade licences / establishment cards) ----------
const estSchema = new Schema({
  name: { type: String, required: true },
  nameAr: String,
  jurisdiction: { type: String, enum: ['MAINLAND', 'FREEZONE'], required: true },
  freeZone: { type: String, enum: [null, 'DIFC', 'ADGM', 'DMCC', 'JAFZA', 'DAFZA', 'SHAMS', 'OTHER'], default: null },
  rulePackId: { type: String, default: 'UAE-MAINLAND' },
  emirate: String,
  mohreId: { type: String, match: /^\d{13}$/ },
  tradeLicenceNo: String,
  tradeLicenceExpiry: Date,
  establishmentCardExpiry: Date,
  designatedSector: { type: Boolean, default: false },
  // Work site used for GPS clock-in (geofence) and the default shift
  geo: { lat: Number, lng: Number, radiusM: { type: Number, default: 300 }, label: String },
  shift: { start: { type: String, default: '08:00' }, end: { type: String, default: '17:00' }, graceMin: { type: Number, default: 15 }, timezone: { type: String, default: 'Asia/Dubai' } },
  wps: { agentName: String, agentRoutingCode: { type: String, match: /^\d{9}$/ } },
}, { timestamps: true });
estSchema.plugin(tenantPlugin);
estSchema.index({ tenantId: 1, mohreId: 1 }, { unique: true, sparse: true });
export const Establishment = model('Establishment', estSchema);

// ---------- Employees ----------
const empSchema = new Schema({
  establishmentId: { type: Id, ref: 'Establishment', required: true },
  employeeNo: { type: String, required: true },
  fullName: { type: String, required: true },
  fullNameAr: String,
  email: String,
  phone: String,
  nationality: String,
  isUaeNational: { type: Boolean, default: false },
  gender: { type: String, enum: ['M', 'F', null], default: null },
  dateOfBirth: Date,
  jobTitle: String,
  department: String,
  managerId: { type: Id, ref: 'Employee' },
  mohreSkillLevel: { type: Number, min: 1, max: 9 },
  contractType: { type: String, enum: ['full-time', 'part-time', 'temporary', 'flexible'], default: 'full-time' },
  joinDate: { type: Date, required: true },
  probationEndDate: Date,
  status: { type: String, enum: ['onboarding', 'active', 'notice', 'exited'], default: 'active' },
  exitDate: Date,
  pensionRegistered: { type: Boolean, default: false },
  paidViaWps: { type: Boolean, default: true },
  compensation: {
    basicFils: fils, housingFils: fils, transportFils: fils,
    allowances: [{ code: String, label: String, amountFils: fils }],
    effectiveFrom: Date,
  },
  compensationHistory: [{ effectiveFrom: Date, basicFils: Number, housingFils: Number, transportFils: Number, changedBy: Id }],
  bank: {
    iban: { type: String, select: false },
    routingCode: { type: String, select: false },
    bankName: String,
    ibanLast4: String,
  },
  labourCardNo: { type: String, select: false },
  emiratesIdLast4: String,
  dependents: [{ name: String, relation: String, dateOfBirth: Date }],
  emergencyContacts: [{ name: String, relation: String, phone: String }],
  leaveCarryForward: { type: Number, default: 0 },
  legalHold: { type: Boolean, default: false }, // blocks retention anonymisation
  anonymisedAt: Date,
  custom: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
empSchema.plugin(tenantPlugin);
empSchema.index({ tenantId: 1, employeeNo: 1 }, { unique: true });
empSchema.index({ tenantId: 1, establishmentId: 1, status: 1 });
// Sensitive identifiers are encrypted at rest (AES-256-GCM, see lib/fieldcrypt.js) and decrypted for lean reads.
const protectEmp = (d) => {
  if (d.bank?.iban) { const plain = decryptField(d.bank.iban); d.bank.ibanLast4 = plain.slice(-4); d.bank.iban = encryptField(plain); }
  if (d.labourCardNo) d.labourCardNo = encryptField(decryptField(d.labourCardNo));
};
const revealEmp = (d) => {
  if (!d || typeof d !== 'object' || d instanceof mongoose.Document) return;
  if (d.bank?.iban) d.bank.iban = decryptField(d.bank.iban);
  if (d.labourCardNo) d.labourCardNo = decryptField(d.labourCardNo);
};
empSchema.pre('save', function () { protectEmp(this); });
empSchema.pre('insertMany', function (next, docs) { try { docs.forEach(protectEmp); next(); } catch (e) { next(e); } });
empSchema.post(['find', 'findOne'], (res) => { (Array.isArray(res) ? res : [res]).forEach(revealEmp); });
export const Employee = model('Employee', empSchema);

// ---------- Compliance documents ----------
const docSchema = new Schema({
  ownerType: { type: String, enum: ['employee', 'establishment'], required: true },
  employeeId: { type: Id, ref: 'Employee' },
  establishmentId: { type: Id, ref: 'Establishment' },
  docType: { type: String, enum: ['passport', 'residence_visa', 'emirates_id', 'labour_card', 'driving_licence', 'health_insurance', 'trade_licence', 'establishment_card'], required: true },
  number: { type: String, select: false },
  issueDate: Date,
  expiryDate: { type: Date, required: true },
  storageKey: String, // Linode Object Storage key; served via short-lived presigned URL
  fileName: String, contentType: String, size: Number, sha256: String, uploadedBy: Id,
  ocr: { type: Schema.Types.Mixed },
  alertsSent: [{ daysBefore: Number, sentAt: Date }],
  renewalCase: { status: { type: String, enum: ['none', 'open', 'in_progress', 'done'], default: 'none' }, ownerUserId: Id, steps: [{ name: String, done: Boolean, at: Date }] },
}, { timestamps: true });
docSchema.plugin(tenantPlugin);
docSchema.index({ tenantId: 1, expiryDate: 1 });
export const ComplianceDocument = model('ComplianceDocument', docSchema);

// ---------- Leave ----------
const leaveSchema = new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  type: { type: String, enum: ['annual', 'sick', 'maternity', 'parental', 'hajj', 'unpaid', 'other'], required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true },
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'cancelled'], default: 'pending' },
  decidedBy: { type: Id, ref: 'User' },
  decidedAt: Date,
  source: { type: String, enum: ['web', 'mobile', 'whatsapp', 'agent'], default: 'web' },
  // pay split decided by the leave engine at request time
  fullDays: Number, halfDays: Number, unpaidDays: Number,
  childBirthDate: Date, certificateAttached: Boolean, warnings: [String],
}, { timestamps: true });
leaveSchema.plugin(tenantPlugin);
leaveSchema.index({ tenantId: 1, employeeId: 1, startDate: 1 });
export const LeaveRequest = model('LeaveRequest', leaveSchema);

// ---------- Payroll ----------
const runSchema = new Schema({
  establishmentId: { type: Id, ref: 'Establishment', required: true },
  period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  type: { type: String, enum: ['regular', 'offcycle', 'final'], default: 'regular' },
  runNo: { type: Number, default: 0 }, // 0 for regular; increments for off-cycle/final runs in the same period
  title: String,
  settlement: Schema.Types.Mixed, // final settlement breakdown + trace
  status: { type: String, enum: ['draft', 'preflight_failed', 'pending_approval', 'approved', 'exported', 'paid'], default: 'draft' },
  lines: [{
    employeeId: Id, employeeName: String, fixedFils: Number, variableFils: Number, grossFils: Number,
    deductionsFils: Number, netFils: Number, unpaidLeaveDays: Number,
    flags: [{ code: String, severity: String, msg: String }], held: Boolean,
  }],
  totals: { grossFils: Number, netFils: Number, heldFils: Number },
  rulePack: String,
  inputsHash: String,
  makerId: { type: Id, ref: 'User' },
  checkerId: { type: Id, ref: 'User' },
  approvedAt: Date,
  locked: { type: Boolean, default: false },
}, { timestamps: true });
runSchema.plugin(tenantPlugin);
runSchema.index({ tenantId: 1, establishmentId: 1, period: 1, type: 1, runNo: 1 }, { unique: true });
export const PayrollRun = model('PayrollRun', runSchema);

const payInputSchema = new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  period: { type: String, required: true },
  overtimeFils: fils, commissionFils: fils, expenseReimbursementFils: fils,
  loanInstallmentFils: fils, fineFils: fils, unpaidLeaveDays: { type: Number, default: 0 },
});
payInputSchema.plugin(tenantPlugin);
payInputSchema.index({ tenantId: 1, employeeId: 1, period: 1 }, { unique: true });
export const PayrollInput = model('PayrollInput', payInputSchema);

const sifSchema = new Schema({
  payrollRunId: { type: Id, ref: 'PayrollRun', required: true },
  filename: String,
  content: String,
  checks: [{ id: String, status: String, label: String, detail: String }],
  totalFils: Number,
  recordCount: Number,
  status: { type: String, enum: ['generated', 'submitted', 'accepted', 'rejected'], default: 'generated' },
  generatedBy: Id,
}, { timestamps: true });
sifSchema.plugin(tenantPlugin);
export const WpsSifBatch = model('WpsSifBatch', sifSchema);

// ---------- AI agent runs & audit ----------
const agentSchema = new Schema({
  userId: Id, command: String, intent: String,
  proposal: Schema.Types.Mixed,
  status: { type: String, enum: ['proposed', 'approved', 'executed', 'discarded', 'failed'], default: 'proposed' },
  result: Schema.Types.Mixed,
}, { timestamps: true });
agentSchema.plugin(tenantPlugin);
export const AgentRun = model('AgentRun', agentSchema);

const auditSchema = new Schema({
  actorId: Id, actorType: { type: String, enum: ['user', 'agent', 'system'], default: 'user' },
  action: String, entity: String, entityId: String,
  before: Schema.Types.Mixed, after: Schema.Types.Mixed,
  ip: String, correlationId: String,
}, { timestamps: { createdAt: true, updatedAt: false } });
auditSchema.plugin(tenantPlugin);
auditSchema.index({ tenantId: 1, createdAt: -1 });
// append-only
auditSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany'], function () { throw new Error('Audit log is immutable'); });
export const AuditLog = model('AuditLog', auditSchema);

// ---------- In-app notifications ----------
const notifSchema = new Schema({
  audience: { type: String, enum: ['hr', 'manager', 'employee'], default: 'hr' },
  userId: Id, employeeId: { type: Id, ref: 'Employee' },
  title: String, body: String, link: String,
  severity: { type: String, enum: ['info', 'warn', 'bad'], default: 'info' },
  dedupeKey: String, readBy: [Id], deliveries: [String],
}, { timestamps: true });
notifSchema.plugin(tenantPlugin);
notifSchema.index({ tenantId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
notifSchema.index({ tenantId: 1, createdAt: -1 });
export const Notification = model('Notification', notifSchema);

// ---------- Employee request centre (letters, data changes, salary queries, ...) ----------
const reqSchema = new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  kind: { type: String, enum: ['letter', 'bank_change', 'personal_data', 'salary_query', 'document_renewal', 'it_facilities', 'other'], required: true },
  letterType: String, addressee: String, purpose: String, lang: { type: String, default: 'dual' },
  details: String, payload: Schema.Types.Mixed,
  status: { type: String, enum: ['open', 'in_progress', 'done', 'rejected'], default: 'open' },
  reference: String, comments: [{ by: Id, text: String, at: Date }],
  slaDueAt: Date, handledBy: Id, closedAt: Date,
}, { timestamps: true });
reqSchema.plugin(tenantPlugin);
reqSchema.index({ tenantId: 1, employeeId: 1, createdAt: -1 });
export const ServiceRequest = model('ServiceRequest', reqSchema);

// ---------- Attendance (clock in/out with GPS + selfie at clock-in) ----------
const punch = { at: Date, lat: Number, lng: Number, accuracyM: Number, distanceM: Number, insideGeofence: Boolean, gpsError: String, device: String };
const attSchema = new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  establishmentId: { type: Id, ref: 'Establishment' },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // local work date (Asia/Dubai)
  seq: { type: Number, default: 0 }, // session number within the day (clock in again after a break / site visit)
  clockIn: punch,
  clockOut: punch,
  photo: { type: String, select: false }, // small JPEG data URL captured at clock-in
  hasPhoto: { type: Boolean, default: false },
  minutesWorked: Number,
  lateMinutes: { type: Number, default: 0 },
  overtimeMinutes: { type: Number, default: 0 },
  status: { type: String, enum: ['present', 'late', 'absent', 'leave', 'holiday'], default: 'present' },
  flags: [{ code: String, msg: String }],
  note: String,
  source: { type: String, enum: ['web', 'mobile', 'kiosk', 'hr'], default: 'web' },
}, { timestamps: true });
attSchema.plugin(tenantPlugin);
attSchema.index({ tenantId: 1, employeeId: 1, date: 1, seq: 1 }, { unique: true });
attSchema.index({ tenantId: 1, date: 1 });
export const Attendance = model('Attendance', attSchema);

// ---------- Applicant tracker (ATS) ----------
const applicantSchema = new Schema({
  name: { type: String, required: true }, email: String, phone: String,
  role: String, department: String, establishmentId: { type: Id, ref: 'Establishment' },
  stage: { type: String, enum: ['applied', 'screening', 'interviewed', 'offer', 'hired', 'rejected'], default: 'applied' },
  visaStatus: { type: String, enum: ['visit_visa', 'residence_on_notice', 'golden_visa', 'uae_national', 'outside_uae', 'other'], default: 'other' },
  expectedSalaryFils: Number, source: String, rating: { type: Number, min: 0, max: 5, default: 0 }, tags: [String], notes: String,
  order: { type: Number, default: 0 }, movedAt: Date,
}, { timestamps: true });
applicantSchema.plugin(tenantPlugin);
applicantSchema.index({ tenantId: 1, stage: 1, order: 1 });
export const Applicant = model('Applicant', applicantSchema);

// ---------- Tasks (HR to-dos and employee tasks) ----------
const taskSchema = new Schema({
  title: { type: String, required: true }, ownerUserId: { type: Id, ref: 'User' }, employeeId: { type: Id, ref: 'Employee' },
  dueDate: Date, done: { type: Boolean, default: false }, doneAt: Date, link: String, createdBy: Id,
}, { timestamps: true });
taskSchema.plugin(tenantPlugin);
taskSchema.index({ tenantId: 1, ownerUserId: 1, done: 1 });
taskSchema.index({ tenantId: 1, employeeId: 1, done: 1 });
export const Task = model('Task', taskSchema);

// ---------- Company calendar events ----------
const eventSchema = new Schema({
  title: { type: String, required: true }, date: { type: String, required: true }, start: String, end: String,
  detail: String, audience: { type: String, enum: ['all', 'hr', 'department'], default: 'all' }, department: String,
}, { timestamps: true });
eventSchema.plugin(tenantPlugin);
eventSchema.index({ tenantId: 1, date: 1 });
export const CalendarEvent = model('CalendarEvent', eventSchema);

// ---------- Wellness pulse check-ins (reported in aggregate only) ----------
const pulseSchema = new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, department: String,
  date: { type: String, required: true }, mood: { type: Number, min: 1, max: 5, required: true },
  energy: { type: Number, min: 1, max: 5 }, workload: { type: Number, min: 1, max: 5 }, comment: { type: String, maxlength: 500 },
}, { timestamps: true });
pulseSchema.plugin(tenantPlugin);
pulseSchema.index({ tenantId: 1, employeeId: 1, date: 1 }, { unique: true });
pulseSchema.index({ tenantId: 1, date: 1 });
export const Pulse = model('Pulse', pulseSchema);
