// Extended data models for the modules added after the MVP.
// Additive only: no existing collection or schema is changed. Every schema uses the same tenant plugin,
// so the tenant-isolation guarantee of the MVP applies to every new collection too.
import mongoose from 'mongoose';
import { tenantPlugin } from '../lib/tenantContext.js';

const { Schema, model } = mongoose;
const Id = Schema.Types.ObjectId;
const fils = { type: Number, default: 0, validate: { validator: Number.isInteger, message: 'Money must be integer fils' } };
const ymd = { type: String, match: /^\d{4}-\d{2}-\d{2}$/ };
const period = { type: String, match: /^\d{4}-\d{2}$/ };
const tenantModel = (name, schema, indexes = []) => {
  schema.plugin(tenantPlugin);
  for (const ix of indexes) schema.index(...ix);
  return mongoose.models[name] || model(name, schema);
};

// ======================= Payroll & finance =======================
export const Loan = tenantModel('Loan', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  kind: { type: String, enum: ['loan', 'advance', 'fine'], required: true },
  reason: String,
  principalFils: fils,
  installmentFils: fils,
  startPeriod: period,
  schedule: [{ period, amountFils: Number, status: { type: String, enum: ['due', 'synced', 'deducted', 'skipped', 'deferred'], default: 'due' }, note: String }],
  status: { type: String, enum: ['pending', 'active', 'closed', 'rejected', 'written_off'], default: 'pending' },
  approvedBy: Id, approvedAt: Date, createdBy: Id,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, status: 1 }]]);

export const AirfarePolicy = tenantModel('AirfarePolicy', new Schema({
  name: { type: String, required: true },
  cycleMonths: { type: Number, default: 12 },          // one ticket every N months
  travelClass: { type: String, enum: ['economy', 'premium', 'business'], default: 'economy' },
  includeDependents: { type: Boolean, default: false },
  maxDependents: { type: Number, default: 0 },
  allowEncashment: { type: Boolean, default: true },
  // reference fares by IATA destination code; amounts in fils (per adult, return)
  fares: [{ iata: { type: String, match: /^[A-Z]{3}$/ }, city: String, adultFils: Number, childFils: Number }],
}, { timestamps: true }));

export const AirfareAccount = tenantModel('AirfareAccount', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  policyId: { type: Id, ref: 'AirfarePolicy', required: true },
  homeIata: { type: String, match: /^[A-Z]{3}$/, required: true },
  dependentsCovered: { type: Number, default: 0 },
  eligibleFrom: Date,
  ledger: [{ at: Date, period, kind: { type: String, enum: ['accrual', 'encashment', 'booking', 'adjustment'] }, amountFils: Number, note: String, refId: String, by: Id }],
  balanceFils: { type: Number, default: 0 },
  lastAccruedPeriod: period,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1 }, { unique: true }]]);

export const AirfareRequest = tenantModel('AirfareRequest', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  kind: { type: String, enum: ['encash', 'booking'], required: true },
  amountFils: fils, travelDate: Date, returnDate: Date, travellers: Number, notes: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  decidedBy: Id, decidedAt: Date, offcycleRunId: Id,
}, { timestamps: true }));

export const AccountMapping = tenantModel('AccountMapping', new Schema({
  establishmentId: { type: Id, ref: 'Establishment' }, // null = default for all
  accounts: {
    salaryExpense: { type: String, default: '6000' }, housingExpense: { type: String, default: '6010' },
    transportExpense: { type: String, default: '6020' }, otherAllowanceExpense: { type: String, default: '6030' },
    overtimeExpense: { type: String, default: '6040' }, reimbursementExpense: { type: String, default: '6050' },
    salariesPayable: { type: String, default: '2100' }, loanReceivable: { type: String, default: '1300' },
    finesIncome: { type: String, default: '4900' }, gratuityExpense: { type: String, default: '6100' }, gratuityProvision: { type: String, default: '2200' },
  },
  costCentreBy: { type: String, enum: ['none', 'department', 'establishment'], default: 'department' },
}, { timestamps: true }));

export const BankRejection = tenantModel('BankRejection', new Schema({
  payrollRunId: { type: Id, ref: 'PayrollRun', required: true },
  employeeId: { type: Id, ref: 'Employee' },
  employeeName: String, ibanLast4: String, labourCardLast4: String,
  amountFils: Number, reasonCode: String, reason: String,
  status: { type: String, enum: ['open', 'corrected', 'repaid', 'written_off'], default: 'open' },
  resolution: String, resolvedBy: Id, resolvedAt: Date, importBatch: String,
}, { timestamps: true }), [[{ tenantId: 1, payrollRunId: 1 }]]);

export const PayrollPolicy = tenantModel('PayrollPolicy', new Schema({
  varianceThresholdPct: { type: Number, default: 15 },
  reportingCurrencies: { type: [String], default: ['AED', 'USD'] },
  conversionDatePolicy: { type: String, enum: ['period_end', 'payment_date', 'fixed'], default: 'period_end' },
  overtimeRequiresApproval: { type: Boolean, default: true },
  expenseCutoffDay: { type: Number, default: 20 },
  restDays: { type: [Number], default: [0] }, // weekday numbers (0 = Sunday) treated as the weekly rest day for overtime premiums
  standardHoursPerDay: { type: Number, default: 8 },
}, { timestamps: true }));

export const FxRate = tenantModel('FxRate', new Schema({
  currency: { type: String, match: /^[A-Z]{3}$/, required: true },
  date: { ...ymd, required: true },
  // how many AED for 1 unit of currency, as a decimal string (no float storage)
  aedPerUnit: { type: String, match: /^\d+(\.\d{1,8})?$/, required: true },
  source: String,
}, { timestamps: true }), [[{ tenantId: 1, currency: 1, date: -1 }, { unique: true }]]);

export const PayrollInputSync = tenantModel('PayrollInputSync', new Schema({
  establishmentId: { type: Id, ref: 'Establishment', required: true }, period: { ...period, required: true },
  lines: [{ employeeId: Id, employeeName: String, overtimeFils: Number, overtimeTrace: Schema.Types.Mixed, loanInstallmentFils: Number, fineFils: Number, expenseReimbursementFils: Number, before: Schema.Types.Mixed }],
  status: { type: String, enum: ['preview', 'applied'], default: 'preview' }, appliedBy: Id, appliedAt: Date, settledAt: Date,
}, { timestamps: true }));

// ======================= Time & attendance =======================
export const ShiftTemplate = tenantModel('ShiftTemplate', new Schema({
  name: { type: String, required: true }, code: { type: String, required: true },
  segments: [{ start: { type: String, match: /^\d{2}:\d{2}$/ }, end: { type: String, match: /^\d{2}:\d{2}$/ } }], // >1 = split shift; end < start = crosses midnight
  breakMin: { type: Number, default: 60 }, paidBreak: { type: Boolean, default: false },
  graceMin: { type: Number, default: 15 }, color: { type: String, default: '#3b82f6' },
  ramadanReduceMin: { type: Number, default: 120 },
}, { timestamps: true }), [[{ tenantId: 1, code: 1 }, { unique: true }]]);

export const RosterEntry = tenantModel('RosterEntry', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, establishmentId: { type: Id, ref: 'Establishment' },
  date: { ...ymd, required: true },
  shiftId: { type: Id, ref: 'ShiftTemplate' }, // null with restDay=true means rest day
  restDay: { type: Boolean, default: false }, note: String, publishedAt: Date, createdBy: Id,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, date: 1 }, { unique: true }], [{ tenantId: 1, date: 1 }]]);

export const PublicHoliday = tenantModel('PublicHoliday', new Schema({
  date: { ...ymd, required: true }, name: { type: String, required: true }, nameAr: String,
  establishmentId: { type: Id, ref: 'Establishment' }, // null = all entities
  estimated: { type: Boolean, default: false }, source: String,
}, { timestamps: true }), [[{ tenantId: 1, date: 1 }]]);

export const RamadanPeriod = tenantModel('RamadanPeriod', new Schema({
  year: Number, start: { ...ymd, required: true }, end: { ...ymd, required: true }, reduceMin: { type: Number, default: 120 }, estimated: Boolean,
}, { timestamps: true }));

export const AttendanceDispute = tenantModel('AttendanceDispute', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, attendanceId: { type: Id, ref: 'Attendance' },
  date: { ...ymd, required: true },
  kind: { type: String, enum: ['missed_punch', 'wrong_time', 'not_late', 'overtime_claim', 'other'], required: true },
  requestedIn: String, requestedOut: String, reason: { type: String, maxlength: 500 },
  status: { type: String, enum: ['open', 'approved', 'rejected'], default: 'open' },
  decidedBy: Id, decidedAt: Date, decisionNote: String, edit: Schema.Types.Mixed, // before/after visible to employee
}, { timestamps: true }), [[{ tenantId: 1, status: 1 }]]);

export const OvertimeApproval = tenantModel('OvertimeApproval', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, period: { ...period, required: true },
  approvedMinutes: { normal: Number, premium: Number }, computed: Schema.Types.Mixed,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, decidedBy: Id, decidedAt: Date, compensatoryRest: Boolean,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, period: 1 }, { unique: true }]]);

export const AttendanceDevice = tenantModel('AttendanceDevice', new Schema({
  name: String, vendor: { type: String, enum: ['zkteco', 'hikvision', 'generic', 'face_kiosk'], default: 'generic' },
  serial: String, establishmentId: { type: Id, ref: 'Establishment' },
  keyId: { type: String, required: true, unique: true }, secretEnc: { type: String, select: false },
  active: { type: Boolean, default: true }, lastSeenAt: Date, lastError: String,
}, { timestamps: true }));

export const DevicePunch = tenantModel('DevicePunch', new Schema({
  deviceId: { type: Id, ref: 'AttendanceDevice' }, employeeNo: String, employeeId: Id,
  at: Date, direction: { type: String, enum: ['in', 'out', 'auto'] }, verifyMode: String, raw: Schema.Types.Mixed,
  eventId: String, result: String,
}, { timestamps: true }), [[{ tenantId: 1, deviceId: 1, eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: 'string' } } }]]);

export const LivenessCheck = tenantModel('LivenessCheck', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, challenge: String, passed: Boolean, score: Number,
  method: String, detail: String, attendanceDate: String, expiresAt: Date, usedAt: Date,
}, { timestamps: true }));

// Face attendance: multi-angle enrollment (128-number descriptors only, no photos) and per-punch verifications.
export const FaceProfile = tenantModel('FaceProfile', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  samples: { type: [{ angle: String, descriptor: [Number], _id: false }], select: false },
  angles: [String], enrolledAt: Date, enrolledBy: Id, active: { type: Boolean, default: true },
  lastVerifiedAt: Date, verifications: { type: Number, default: 0 }, failures: { type: Number, default: 0 },
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1 }, { unique: true }]]);

export const FaceVerification = tenantModel('FaceVerification', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, direction: { type: String, enum: ['in', 'out'] },
  passed: Boolean, score: Number, confidence: Number, live: Boolean, liveness: Schema.Types.Mixed,
  otherEmployeeId: { type: Id, ref: 'Employee' }, reasons: [String], device: String,
  expiresAt: Date, usedAt: Date, attendanceDate: String,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, createdAt: -1 }]]);

// ======================= Expenses, insurance & perks =======================
export const ExpenseClaim = tenantModel('ExpenseClaim', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  category: { type: String, enum: ['travel', 'meals', 'fuel', 'client', 'office', 'training', 'telecom', 'medical', 'other'], default: 'other' },
  merchant: String, trn: String, receiptDate: Date, description: String,
  totalFils: fils, vatFils: fils, currency: { type: String, default: 'AED' },
  receipt: { storageKey: String, contentType: String, size: Number, sha256: String, scan: String },
  ocr: Schema.Types.Mixed,
  approvals: [{ level: Number, role: String, by: Id, decision: String, note: String, at: Date }],
  status: { type: String, enum: ['submitted', 'manager_approved', 'approved', 'rejected', 'queued_for_payroll', 'paid'], default: 'submitted' },
  payrollPeriod: period, duplicateOf: Id, flags: [String],
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, createdAt: -1 }], [{ tenantId: 1, status: 1 }]]);

export const InsurancePolicy = tenantModel('InsurancePolicy', new Schema({
  insurer: { type: String, required: true }, tpa: String, policyNo: String, plan: String, emirate: String,
  startDate: Date, endDate: Date, premiumPerMemberFils: Number,
  network: [{ name: String, type: { type: String, enum: ['hospital', 'clinic', 'pharmacy', 'lab'] }, emirate: String, area: String, phone: String, lat: Number, lng: Number, directBilling: Boolean }],
  brokerContact: String,
}, { timestamps: true }));

export const InsuranceMember = tenantModel('InsuranceMember', new Schema({
  policyId: { type: Id, ref: 'InsurancePolicy', required: true }, employeeId: { type: Id, ref: 'Employee', required: true },
  memberName: String, relation: { type: String, enum: ['self', 'spouse', 'child', 'parent'], default: 'self' },
  cardNo: String, validFrom: Date, validTo: Date, status: { type: String, enum: ['active', 'pending_add', 'pending_delete', 'removed'], default: 'active' },
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1 }]]);

export const BenefitRequest = tenantModel('BenefitRequest', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  kind: { type: String, enum: ['dependent_add', 'dependent_remove', 'card_replacement', 'plan_query'], required: true },
  dependent: { name: String, relation: String, dateOfBirth: Date, emiratesIdLast4: String },
  memberId: Id, notes: String,
  status: { type: String, enum: ['open', 'sent_to_broker', 'done', 'rejected'], default: 'open' }, handledBy: Id, closedAt: Date,
}, { timestamps: true }));

export const Perk = tenantModel('Perk', new Schema({
  title: { type: String, required: true }, provider: String, category: String, description: String, code: String, url: String, validTo: Date, active: { type: Boolean, default: true },
}, { timestamps: true }));

// ======================= Talent acquisition =======================
export const GradeBand = tenantModel('GradeBand', new Schema({
  grade: { type: String, required: true }, title: String, minFils: fils, maxFils: fils, basicPctMin: { type: Number, default: 50 },
}, { timestamps: true }), [[{ tenantId: 1, grade: 1 }, { unique: true }]]);

export const JobRequisition = tenantModel('JobRequisition', new Schema({
  title: { type: String, required: true }, department: String, establishmentId: { type: Id, ref: 'Establishment' },
  headcount: { type: Number, default: 1 }, grade: String, budgetMinFils: Number, budgetMaxFils: Number,
  description: String, requirements: [String], location: String, employmentType: { type: String, default: 'full-time' },
  status: { type: String, enum: ['draft', 'pending_approval', 'approved', 'open', 'on_hold', 'closed', 'rejected'], default: 'draft' },
  approvals: [{ by: Id, decision: String, note: String, at: Date }],
  publicSlug: String, publishedAt: Date, createdBy: Id,
}, { timestamps: true }), [[{ tenantId: 1, status: 1 }]]);

export const CandidateProfile = tenantModel('CandidateProfile', new Schema({
  applicantId: { type: Id, ref: 'Applicant', required: true }, requisitionId: { type: Id, ref: 'JobRequisition' },
  cv: { storageKey: String, contentType: String, fileName: String },
  parsed: Schema.Types.Mixed, // skills, years, education, languages, nationality, visaStatus
  match: { score: Number, reasons: [String] },
  interviews: [{ at: Date, with: String, mode: String, feedback: String, rating: Number }],
}, { timestamps: true }), [[{ tenantId: 1, applicantId: 1 }, { unique: true }]]);

export const Offer = tenantModel('Offer', new Schema({
  applicantId: { type: Id, ref: 'Applicant' }, employeeId: { type: Id, ref: 'Employee' }, requisitionId: Id,
  candidateName: String, candidateEmail: String, jobTitle: String, grade: String, establishmentId: Id,
  startDate: Date, basicFils: Number, housingFils: Number, transportFils: Number, otherFils: Number,
  probationMonths: { type: Number, default: 6 }, noticeDays: { type: Number, default: 30 }, visaType: String,
  lang: { type: String, default: 'dual' },
  validation: Schema.Types.Mixed,
  status: { type: String, enum: ['draft', 'sent', 'viewed', 'signed', 'declined', 'withdrawn', 'expired'], default: 'draft' },
  signToken: { type: String, select: false }, signTokenHash: String, expiresAt: Date,
  signature: { name: String, imageDataUrl: { type: String, select: false }, at: Date, ip: String, userAgent: String, docHash: String },
  documents: [{ kind: String, fileName: String, storageKey: String, contentType: String, size: Number, sha256: String, at: Date }],
  createdBy: Id, source: { type: String, default: 'manual' },
}, { timestamps: true }), [[{ tenantId: 1, signTokenHash: 1 }]]);

// ======================= Performance & engagement =======================
export const Goal = tenantModel('Goal', new Schema({
  ownerType: { type: String, enum: ['company', 'department', 'employee'], default: 'employee' },
  employeeId: { type: Id, ref: 'Employee' }, department: String, parentId: { type: Id, ref: 'Goal' },
  title: { type: String, required: true }, description: String, cycle: { type: String, required: true }, // e.g. 2026-H2
  keyResults: [{ title: String, metric: String, start: Number, target: Number, current: Number, weight: { type: Number, default: 1 } }],
  status: { type: String, enum: ['draft', 'active', 'at_risk', 'done', 'dropped'], default: 'active' },
  createdBy: Id,
}, { timestamps: true }), [[{ tenantId: 1, cycle: 1 }]]);

export const Review = tenantModel('Review', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true },
  kind: { type: String, enum: ['probation_30', 'probation_60', 'probation_90', 'probation_final', 'annual', '360', 'mid_year'], required: true },
  cycle: String, dueDate: Date,
  competencies: { type: [String], default: ['Quality of work', 'Collaboration', 'Ownership', 'Communication', 'Learning'] },
  reviewers: [{ userId: Id, employeeId: Id, relation: { type: String, enum: ['self', 'manager', 'peer', 'report', 'hr'] }, ratings: [Number], strengths: String, improvements: String, submittedAt: Date, invitedAt: Date }],
  outcome: { rating: Number, recommendation: { type: String, enum: [null, 'confirm', 'extend', 'terminate', 'promote', 'pip', 'none'], default: null }, note: String, decidedBy: Id, decidedAt: Date },
  status: { type: String, enum: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled' },
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1, kind: 1, cycle: 1 }]]);

export const Recognition = tenantModel('Recognition', new Schema({
  fromEmployeeId: Id, fromUserId: Id, toEmployeeId: { type: Id, ref: 'Employee', required: true },
  badge: { type: String, enum: ['team_player', 'customer_hero', 'innovator', 'above_and_beyond', 'mentor', 'safety_star'], required: true },
  message: { type: String, maxlength: 400 }, visibility: { type: String, enum: ['public', 'private'], default: 'public' },
}, { timestamps: true }), [[{ tenantId: 1, createdAt: -1 }]]);

export const Announcement = tenantModel('Announcement', new Schema({
  title: { type: String, required: true }, titleAr: String, body: String, bodyAr: String,
  kind: { type: String, enum: ['news', 'townhall', 'policy', 'event'], default: 'news' },
  eventAt: Date, link: String, audience: { type: String, enum: ['all', 'department', 'establishment'], default: 'all' }, department: String, establishmentId: Id,
  pinned: Boolean, readBy: [Id], publishedBy: Id, publishedAt: Date,
}, { timestamps: true }));

export const Survey = tenantModel('Survey', new Schema({
  title: { type: String, required: true }, kind: { type: String, enum: ['enps', 'pulse', 'custom'], default: 'enps' },
  questions: [{ id: String, text: String, type: { type: String, enum: ['scale10', 'scale5', 'text'] } }],
  opensAt: Date, closesAt: Date, anonymous: { type: Boolean, default: true }, minGroupSize: { type: Number, default: 5 },
  status: { type: String, enum: ['draft', 'open', 'closed'], default: 'draft' },
}, { timestamps: true }));

export const SurveyResponse = tenantModel('SurveyResponse', new Schema({
  surveyId: { type: Id, ref: 'Survey', required: true }, respondentHash: { type: String, required: true }, // HMAC(employeeId) — not reversible to a person
  department: String, answers: Schema.Types.Mixed,
}, { timestamps: true }), [[{ tenantId: 1, surveyId: 1, respondentHash: 1 }, { unique: true }]]);

// ======================= Immigration, dependents, assets =======================
export const ImmigrationCase = tenantModel('ImmigrationCase', new Schema({
  employeeId: { type: Id, ref: 'Employee' }, dependentId: { type: Id, ref: 'Dependent' }, offerId: Id,
  subjectName: String, establishmentId: { type: Id, ref: 'Establishment' },
  kind: { type: String, enum: ['new_hire', 'renewal', 'cancellation', 'transfer', 'dependent_new', 'dependent_renewal', 'golden_visa'], required: true },
  jurisdiction: { type: String, enum: ['MAINLAND', 'FREEZONE'], default: 'MAINLAND' },
  steps: [{
    key: String, name: String, owner: { type: String, enum: ['hr', 'pro', 'typing_centre', 'employee', 'insurer'], default: 'hr' },
    dueDate: Date, dependsOn: [String], status: { type: String, enum: ['todo', 'in_progress', 'submitted', 'rejected', 'done', 'skipped'], default: 'todo' },
    costFils: { type: Number, default: 0 }, reference: String, evidenceKey: String, rejectionReason: String, attempts: { type: Number, default: 0 }, doneAt: Date,
  }],
  graceUntil: Date, status: { type: String, enum: ['open', 'blocked', 'done', 'cancelled'], default: 'open' }, createdBy: Id, source: String,
}, { timestamps: true }), [[{ tenantId: 1, status: 1 }]]);

export const Dependent = tenantModel('Dependent', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, name: { type: String, required: true }, nameAr: String,
  relation: { type: String, enum: ['spouse', 'son', 'daughter', 'father', 'mother', 'other'], required: true },
  dateOfBirth: Date, nationality: String,
  sponsor: { type: String, enum: ['employee', 'company', 'other'], default: 'employee' },
  residenceExpiry: Date, emiratesIdExpiry: Date, passportExpiry: Date, insuranceMemberId: Id, airfareEligible: Boolean,
}, { timestamps: true }), [[{ tenantId: 1, employeeId: 1 }]]);

export const CompanyAsset = tenantModel('CompanyAsset', new Schema({
  tag: { type: String, required: true }, kind: { type: String, enum: ['laptop', 'phone', 'sim', 'vehicle', 'access_card', 'tools', 'uniform', 'other'], required: true },
  model: String, serial: String, valueFils: Number, purchasedAt: Date,
  assignedTo: { type: Id, ref: 'Employee' }, assignedAt: Date,
  status: { type: String, enum: ['in_stock', 'requested', 'assigned', 'repair', 'retired', 'lost'], default: 'in_stock' },
  history: [{ at: Date, action: String, employeeId: Id, by: Id, note: String }],
}, { timestamps: true }), [[{ tenantId: 1, tag: 1 }, { unique: true }]]);

export const AssetRequest = tenantModel('AssetRequest', new Schema({
  employeeId: { type: Id, ref: 'Employee', required: true }, kind: String, reason: String, neededBy: Date,
  status: { type: String, enum: ['open', 'fulfilled', 'rejected'], default: 'open' }, assetId: Id, source: String,
}, { timestamps: true }));

// ======================= Platform: reports, API, webhooks, jobs, connectors, rules =======================
export const SavedReport = tenantModel('SavedReport', new Schema({
  name: { type: String, required: true }, entity: { type: String, required: true },
  columns: [String], filters: Schema.Types.Mixed, sort: String,
  schedule: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' }, recipients: [String],
  lastRunAt: Date, ownerUserId: Id, shared: Boolean,
}, { timestamps: true }));

export const ApiKey = tenantModel('ApiKey', new Schema({
  name: String, prefix: { type: String, required: true, unique: true }, hash: { type: String, required: true },
  scopes: [{ type: String, enum: ['employees:read', 'leave:read', 'leave:write', 'attendance:read', 'attendance:write', 'payroll:read'] }],
  createdBy: Id, lastUsedAt: Date, revokedAt: Date,
}, { timestamps: true }));

export const IdempotencyRecord = tenantModel('IdempotencyRecord', new Schema({
  key: { type: String, required: true }, route: String, requestHash: String, status: Number, response: Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 },
}), [[{ tenantId: 1, key: 1, route: 1 }, { unique: true }]]);

export const Webhook = tenantModel('Webhook', new Schema({
  url: { type: String, required: true }, events: [String], secretEnc: { type: String, select: false },
  active: { type: Boolean, default: true }, description: String, failures: { type: Number, default: 0 }, lastDeliveryAt: Date, lastStatus: Number,
}, { timestamps: true }));

export const WebhookDelivery = tenantModel('WebhookDelivery', new Schema({
  webhookId: { type: Id, ref: 'Webhook' }, event: String, eventId: String, payload: Schema.Types.Mixed,
  attempts: [{ at: Date, status: Number, ms: Number, error: String }], state: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
}, { timestamps: true }), [[{ tenantId: 1, webhookId: 1, eventId: 1 }, { unique: true }]]);

export const Connector = tenantModel('Connector', new Schema({
  kind: { type: String, enum: ['accounting', 'sso', 'esign', 'sms', 'whatsapp', 'email', 'attendance_device', 'insurance_broker', 'recruitment', 'slack', 'speech'], required: true },
  provider: { type: String, required: true }, config: Schema.Types.Mixed, secretEnc: { type: String, select: false },
  enabled: { type: Boolean, default: false }, killSwitch: { type: Boolean, default: false },
  health: { status: { type: String, default: 'unknown' }, checkedAt: Date, detail: String },
}, { timestamps: true }), [[{ tenantId: 1, kind: 1, provider: 1 }, { unique: true }]]);

export const Job = tenantModel('Job', new Schema({
  queue: { type: String, required: true }, name: String, payload: Schema.Types.Mixed,
  state: { type: String, enum: ['queued', 'running', 'done', 'failed', 'dead'], default: 'queued' },
  attempts: { type: Number, default: 0 }, maxAttempts: { type: Number, default: 5 }, runAt: { type: Date, default: Date.now },
  lockedAt: Date, lockedBy: String, lastError: String, result: Schema.Types.Mixed, idempotencyKey: String, finishedAt: Date,
}, { timestamps: true }), [[{ state: 1, runAt: 1 }], [{ tenantId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }]]);

export const RuleVersion = tenantModel('RuleVersion', new Schema({
  packId: { type: String, required: true }, version: { type: String, required: true }, jurisdiction: String,
  employeeCategory: { type: String, default: 'all' },
  effectiveFrom: { ...ymd, required: true }, effectiveTo: ymd,
  overrides: Schema.Types.Mixed, // partial pack: gratuity / leave / overtime / deductions / emiratisation
  sourceRef: String, sourceUrls: [String],
  testCases: [{ name: String, input: Schema.Types.Mixed, expect: Schema.Types.Mixed }],
  lastTest: { passed: Boolean, at: Date, results: Schema.Types.Mixed },
  status: { type: String, enum: ['draft', 'approved', 'retired'], default: 'draft' },
  approvedBy: Id, approvedAt: Date, createdBy: Id, changeNote: String,
}, { timestamps: true }), [[{ tenantId: 1, packId: 1, version: 1 }, { unique: true }]]);

export const FeatureSettings = tenantModel('FeatureSettings', new Schema({
  attritionInsights: { enabled: { type: Boolean, default: false }, individualScores: { type: Boolean, default: false }, reviewedForBias: { type: Boolean, default: false }, minGroupSize: { type: Number, default: 5 } },
  agentKillSwitch: { type: Boolean, default: false },
  agentRequiresApproval: { type: [String], default: ['hire', 'payroll', 'termination', 'wps_export', 'visa', 'salary_change'] },
  copilotLanguages: { type: [String], default: ['en', 'ar', 'hi', 'ml', 'ur', 'tl'] },
  feeSchedule: Schema.Types.Mixed, // visa/insurance cost assumptions for forecasting
  faceAttendance: { required: { type: Boolean, default: false }, threshold: { type: Number, default: 0.5 } },
}, { timestamps: true }));

export const CopilotMessage = tenantModel('CopilotMessage', new Schema({
  employeeId: Id, userId: Id, channel: { type: String, enum: ['app', 'whatsapp', 'slack', 'voice'], default: 'app' },
  lang: String, text: String, transcript: String, intent: String, result: Schema.Types.Mixed, reply: String,
}, { timestamps: true }), [[{ tenantId: 1, createdAt: -1 }]]);

export const ExportLog = tenantModel('ExportLog', new Schema({
  userId: Id, reportId: Id, entity: String, columns: [String], rows: Number, sensitive: Boolean, format: String,
}, { timestamps: true }));

export const SealedDocument = tenantModel('SealedDocument', new Schema({
  code: { type: String, required: true, unique: true }, kind: String, title: String, employeeId: Id, sha256: String, issuedBy: Id, revokedAt: Date,
}, { timestamps: true }));

// Platform-level key/value state (NOT tenant scoped): job cursors etc. Only touched by background workers.
export const ExtState = mongoose.models.ExtState || model('ExtState', new Schema({ key: { type: String, unique: true }, value: Schema.Types.Mixed }, { timestamps: true }));

export const EXT_MODELS = {
  Loan, AirfarePolicy, AirfareAccount, AirfareRequest, AccountMapping, BankRejection, PayrollPolicy, FxRate, PayrollInputSync,
  ShiftTemplate, RosterEntry, PublicHoliday, RamadanPeriod, AttendanceDispute, OvertimeApproval, AttendanceDevice, DevicePunch, LivenessCheck, FaceProfile, FaceVerification,
  ExpenseClaim, InsurancePolicy, InsuranceMember, BenefitRequest, Perk, GradeBand, JobRequisition, CandidateProfile, Offer,
  Goal, Review, Recognition, Announcement, Survey, SurveyResponse, ImmigrationCase, Dependent, CompanyAsset, AssetRequest,
  SavedReport, ApiKey, IdempotencyRecord, Webhook, WebhookDelivery, Connector, Job, RuleVersion, FeatureSettings, CopilotMessage, ExportLog, SealedDocument,
};
