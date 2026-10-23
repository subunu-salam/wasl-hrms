// Face attendance: employees enroll a multi-angle face scan in their own login, then each clock-in/out is verified
// against it. Descriptors are computed in the browser; only the 128-number vectors are stored (no face photos).
import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { encryptField, decryptField } from '../../lib/fieldcrypt.js';
import { Employee, Notification } from '../../models/index.js';
import { authenticate, requireRole, restrictEmployees, audit, ah } from '../../middleware/auth.js';
import { localParts } from '../../lib/attendance.js';
import { FaceProfile, FaceVerification, FeatureSettings, AttendanceDevice } from '../models.js';
import { ANGLES, DEFAULT_THRESHOLD, isDescriptor, validateEnrollment, decide } from '../lib/face.js';
import { z, fail, oid, publicBase } from './_util.js';

const r = Router();
r.use(authenticate, restrictEmployees);
const HR = requireRole('hr_admin');
const VALID_FOR_MS = 3 * 60 * 1000; // a passed scan must be used for the punch within 3 minutes

async function settings() {
  const f = await FeatureSettings.findOne().lean();
  return { required: !!f?.faceAttendance?.required, threshold: f?.faceAttendance?.threshold || DEFAULT_THRESHOLD };
}
const needEmployee = (req) => { if (!req.user.employeeId) throw fail(400, 'Your login is not linked to an employee record.'); return req.user.employeeId; };

// ---------------- Employee ----------------
r.get('/me/face', ah(async (req, res) => {
  const p = req.user.employeeId ? await FaceProfile.findOne({ employeeId: req.user.employeeId, active: true }).lean() : null;
  const s = await settings();
  res.json({ enrolled: !!p, enrolledAt: p?.enrolledAt, angles: p?.angles || [], lastVerifiedAt: p?.lastVerifiedAt, required: s.required, requiredAngles: ANGLES });
}));

const sample = z.object({ angle: z.enum(ANGLES), descriptor: z.array(z.number()).length(128) });
r.post('/me/face/enroll', ah(async (req, res) => {
  const employeeId = needEmployee(req);
  const b = z.object({ samples: z.array(sample).min(ANGLES.length).max(20) }).parse(req.body);
  const s = await settings();
  const v = validateEnrollment(b.samples, s.threshold);
  if (!v.ok) throw fail(400, v.errors.join(' '));
  const angles = [...new Set(b.samples.map((x) => x.angle))];
  await FaceProfile.findOneAndUpdate({ employeeId }, { $set: { samples: b.samples, angles, enrolledAt: new Date(), enrolledBy: req.user.id, active: true, failures: 0 } }, { upsert: true, new: true });
  await audit(req, 'face.enroll', 'FaceProfile', employeeId, null, { angles, samples: b.samples.length });
  res.status(201).json({ enrolled: true, angles });
}));

r.delete('/me/face', ah(async (req, res) => {
  const employeeId = needEmployee(req);
  await FaceProfile.deleteOne({ employeeId }); await audit(req, 'face.delete', 'FaceProfile', employeeId);
  res.json({ ok: true });
}));

r.post('/me/face/verify', ah(async (req, res) => {
  const employeeId = needEmployee(req);
  const b = z.object({ descriptor: z.array(z.number()).length(128), direction: z.enum(['in', 'out']).default('in'), liveness: z.object({ blinks: z.number().int().min(0).max(50).default(0), turned: z.boolean().default(false) }).default({}) }).parse(req.body);
  if (!isDescriptor(b.descriptor)) throw fail(400, 'Invalid face scan.');
  const s = await settings();
  const own = await FaceProfile.findOne({ employeeId, active: true }).select('+samples').lean();
  if (!own) throw fail(409, 'Set up Face ID first.');
  const others = (await FaceProfile.find({ employeeId: { $ne: employeeId }, active: true }).select('+samples employeeId').limit(2000).lean()).map((p) => ({ employeeId: p.employeeId, samples: p.samples }));
  const live = b.liveness.blinks >= 1 || b.liveness.turned;
  const d = decide({ probe: b.descriptor, own: own.samples, others, threshold: s.threshold, live });
  const v = await FaceVerification.create({ employeeId, direction: b.direction, ...d, live, liveness: b.liveness, device: (req.headers['user-agent'] || '').slice(0, 200), expiresAt: d.passed ? new Date(Date.now() + VALID_FOR_MS) : undefined, attendanceDate: localParts(new Date()).date });
  await FaceProfile.updateOne({ _id: own._id }, d.passed ? { $set: { lastVerifiedAt: new Date() }, $inc: { verifications: 1 } } : { $inc: { failures: 1 } });
  if (!d.passed && d.otherEmployeeId) {
    const emp = await Employee.findById(employeeId).select('fullName').lean();
    await Notification.create({ audience: 'hr', title: 'Face ID: possible buddy punching', body: `A clock-${b.direction} attempt on ${emp?.fullName || 'an employee'}'s login matched a different employee's face.`, link: '#timeplus', severity: 'warn' }).catch(() => {});
  }
  res.json({ passed: d.passed, verificationId: d.passed ? v._id : null, confidence: d.confidence, reasons: d.reasons });
}));

// ---------------- HR ----------------
r.get('/attendance/face', HR, ah(async (req, res) => {
  const [profiles, recent, emps, s] = await Promise.all([
    FaceProfile.find().populate('employeeId', 'fullName employeeNo').lean(),
    FaceVerification.find().sort({ createdAt: -1 }).limit(200).populate('employeeId', 'fullName employeeNo').populate('otherEmployeeId', 'fullName').lean(),
    Employee.countDocuments({ status: { $in: ['active', 'notice', 'onboarding'] } }),
    settings(),
  ]);
  res.json({ settings: s, profiles, recent, activeEmployees: emps });
}));
r.put('/attendance/face/settings', HR, ah(async (req, res) => {
  const b = z.object({ required: z.boolean(), threshold: z.number().min(0.3).max(0.7).default(DEFAULT_THRESHOLD) }).parse(req.body);
  await FeatureSettings.findOneAndUpdate({}, { $set: { faceAttendance: b } }, { upsert: true });
  await audit(req, 'face.settings', 'FeatureSettings', null, null, b); res.json(b);
}));
// HR enrolls someone in person (staff without a login or phone, e.g. retail on the shared tablet).
r.post('/attendance/face/:employeeId/enroll', HR, ah(async (req, res) => {
  const employeeId = oid.parse(req.params.employeeId);
  if (!(await Employee.exists({ _id: employeeId }))) throw fail(404, 'Employee not found');
  const b = z.object({ samples: z.array(sample).min(ANGLES.length).max(20) }).parse(req.body);
  const s = await settings();
  const v = validateEnrollment(b.samples, s.threshold);
  if (!v.ok) throw fail(400, v.errors.join(' '));
  const angles = [...new Set(b.samples.map((x) => x.angle))];
  await FaceProfile.findOneAndUpdate({ employeeId }, { $set: { samples: b.samples, angles, enrolledAt: new Date(), enrolledBy: req.user.id, active: true, failures: 0 } }, { upsert: true, new: true });
  await audit(req, 'face.enroll_by_hr', 'FaceProfile', employeeId, null, { angles });
  res.status(201).json({ enrolled: true, angles });
}));

// Shared-tablet links ("Look & Verify" kiosk). The key travels in the URL fragment, so it never reaches server logs.
// HR can always see/copy each tablet's link (it is stored encrypted and only returned to HR).
r.get('/attendance/kiosks', HR, ah(async (req, res) => {
  const list = await AttendanceDevice.find({ vendor: 'face_kiosk' }).select('+secretEnc').sort({ createdAt: -1 }).populate('establishmentId', 'name').lean();
  res.json(list.map(({ secretEnc, ...d }) => { let url = null; try { url = `${publicBase(req)}/kiosk.html#k=${d.keyId}.${decryptField(secretEnc)}`; } catch { /* key rotated */ } return { ...d, url }; }));
}));
r.post('/attendance/kiosks', HR, ah(async (req, res) => {
  const b = z.object({ name: z.string().min(2).max(60), establishmentId: oid.optional() }).parse(req.body);
  const secret = randomBytes(24).toString('base64url'); const keyId = `kio_${randomBytes(6).toString('hex')}`;
  const d = await AttendanceDevice.create({ ...b, vendor: 'face_kiosk', keyId, secretEnc: encryptField(secret) });
  await audit(req, 'kiosk.create', 'AttendanceDevice', d._id, null, { name: b.name });
  res.status(201).json({ device: d, url: `${publicBase(req)}/kiosk.html#k=${keyId}.${secret}`, note: 'Open this link once on the tablet; it remembers it. Anyone with the link can record punches for enrolled faces, so share it only with the tablet.' });
}));
r.patch('/attendance/kiosks/:id', HR, ah(async (req, res) => {
  const b = z.object({ active: z.boolean() }).parse(req.body);
  const d = await AttendanceDevice.findOneAndUpdate({ _id: oid.parse(req.params.id), vendor: 'face_kiosk' }, { $set: b }, { new: true });
  if (!d) throw fail(404, 'Tablet not found');
  await audit(req, b.active ? 'kiosk.enable' : 'kiosk.disable', 'AttendanceDevice', d._id); res.json(d);
}));

r.delete('/attendance/face/:employeeId', HR, ah(async (req, res) => {
  oid.parse(req.params.employeeId);
  await FaceProfile.deleteOne({ employeeId: req.params.employeeId });
  await audit(req, 'face.reset', 'FaceProfile', req.params.employeeId); res.json({ ok: true });
}));

export default r;

/**
 * Gate in front of the existing /api/me/clock-in and /api/me/clock-out. When Face ID is required (or the employee
 * has enrolled), the punch needs a passed, unused verification from the last few minutes, sent as X-Face-Verification.
 */
export const faceGate = [authenticate, ah(async (req, res, next) => {
  const employeeId = req.user.employeeId;
  if (!employeeId) return next();
  const [s, enrolled] = await Promise.all([settings(), FaceProfile.exists({ employeeId, active: true })]);
  if (!enrolled && !s.required) return next();
  if (!enrolled) return res.status(428).json({ error: 'Set up Face ID before clocking in.', code: 'FACE_ENROLL' });
  const id = String(req.headers['x-face-verification'] || '');
  const v = /^[0-9a-f]{24}$/i.test(id) ? await FaceVerification.findOneAndUpdate({ _id: id, employeeId, passed: true, usedAt: null, expiresAt: { $gt: new Date() } }, { $set: { usedAt: new Date() } }) : null;
  if (!v) return res.status(428).json({ error: 'Scan your face to clock in or out.', code: 'FACE_VERIFY' });
  next();
})];
