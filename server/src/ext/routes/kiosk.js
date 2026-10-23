// Shared-tablet Face ID ("Look & Verify"). A tablet at the shop/office entrance opens /kiosk.html with a tablet key.
// Staff just look at it: the face is identified among everyone enrolled (1:N), the punch goes through the same engine
// as biometric terminals (applyDevicePunch), so Attendance, the roster and the live pill update immediately.
// No staff login and no personal phone needed.
import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { Tenant, Employee, Establishment, Attendance } from '../../models/index.js';
import { runAsSystem, runWithTenant } from '../../lib/tenantContext.js';
import { decryptField } from '../../lib/fieldcrypt.js';
import { AttendanceDevice, FaceProfile, FaceVerification, FeatureSettings } from '../models.js';
import { identify, isDescriptor, DEFAULT_THRESHOLD } from '../lib/face.js';
import { applyDevicePunch } from './time.js';
import { localParts, distanceMeters } from '../../lib/attendance.js';
import { z, fail } from './_util.js';

const r = Router();
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
r.use(express.json({ limit: '600kb' })); // descriptor + a small clock-in photo
r.use(rateLimit({ windowMs: 60 * 1000, max: 90, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many scans. Wait a moment.' } }));
const same = (a, b) => createHash('sha256').update(String(a)).digest().equals(createHash('sha256').update(String(b)).digest());
const REPEAT_MS = 2 * 60 * 1000; // ignore a second scan within 2 minutes of the last punch (people often look twice)

/** Tablet key "dev_xxxx.secret" in X-Kiosk-Key. Returns the device (with its tenant). */
async function kioskDevice(req) {
  const [keyId, secret] = String(req.headers['x-kiosk-key'] || '').split('.');
  if (!keyId || !secret) throw fail(401, 'This tablet is not linked yet.');
  const d = await runAsSystem(() => AttendanceDevice.findOne({ keyId, vendor: 'face_kiosk', active: true }).select('+secretEnc').lean());
  if (!d || !same(decryptField(d.secretEnc), secret)) throw fail(401, 'This tablet link is not valid or was turned off. Ask HR for a new link.');
  return d;
}
const inTenant = (d, fn) => runWithTenant({ tenantId: String(d.tenantId) }, fn);

r.get('/hello', ah(async (req, res) => {
  const d = await kioskDevice(req);
  const out = await inTenant(d, async () => {
    const [t, est, enrolled] = await Promise.all([runAsSystem(() => Tenant.findById(d.tenantId).select('name').lean()), d.establishmentId ? Establishment.findById(d.establishmentId).select('name').lean() : null, FaceProfile.countDocuments({ active: true })]);
    await AttendanceDevice.updateOne({ _id: d._id }, { $set: { lastSeenAt: new Date() } });
    return { company: t?.name, site: est?.name || null, device: d.name, enrolled };
  });
  res.json(out);
}));

r.post('/identify', ah(async (req, res) => {
  const d = await kioskDevice(req);
  const b = z.object({ gps: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), accuracyM: z.number().min(0).max(100000).optional() }).optional(), direction: z.enum(['in', 'out', 'auto']).default('auto'), photo: z.string().regex(/^data:image\/jpeg;base64,/).max(450_000).optional(), descriptor: z.array(z.number()).length(128), liveness: z.object({ blinks: z.number().int().min(0).max(50).default(0), moved: z.boolean().default(false) }).default({}) }).parse(req.body);
  if (!isDescriptor(b.descriptor)) throw fail(400, 'Invalid face scan.');
  const out = await inTenant(d, async () => {
    const f = await FeatureSettings.findOne().lean();
    const threshold = f?.faceAttendance?.threshold || DEFAULT_THRESHOLD;
    const live = b.liveness.blinks >= 1 || b.liveness.moved;
    if (!live) return { status: 'retry', message: 'Blink or move slightly so we know you are here.' };
    const q = { active: true }; if (d.establishmentId) { const ids = await Employee.find({ establishmentId: d.establishmentId }).distinct('_id'); q.employeeId = { $in: ids }; }
    const profiles = await FaceProfile.find(q).select('+samples employeeId').limit(3000).lean();
    const m = identify(b.descriptor, profiles.map((p) => ({ employeeId: p.employeeId, samples: p.samples })), threshold);
    if (!m.ok) return { status: m.reason === 'ambiguous' ? 'retry' : 'unknown', message: m.reason === 'ambiguous' ? 'Hold still and look straight at the camera.' : 'Face not recognised. Ask HR to set up your Face ID.' };
    const emp = await Employee.findById(m.employeeId).select('fullName employeeNo status establishmentId').lean();
    if (!emp || !['active', 'notice', 'onboarding'].includes(emp.status)) return { status: 'unknown', message: 'This employee is not active. Please see HR.' };
    const now = new Date();
    // double-scan guard
    const last = await Attendance.findOne({ employeeId: emp._id }).sort({ 'clockIn.at': -1 }).lean();
    const lastPunch = last ? (last.clockOut?.at || last.clockIn?.at) : null;
    const first = emp.fullName.split(' ')[0];
    if (b.direction === 'auto' && lastPunch && now - new Date(lastPunch) < REPEAT_MS) {
      return { status: 'ok', result: last.clockOut?.at ? 'clock_out' : 'clock_in', repeat: true, name: emp.fullName, firstName: first, at: lastPunch, sessionStart: last.clockIn?.at, workedMinutes: last.minutesWorked || 0, confidence: m.confidence };
    }
    const result = await applyDevicePunch({ device: d, employeeNo: emp.employeeNo, at: now, direction: b.direction, verifyMode: 'face' });
    const rec = await Attendance.findOne({ employeeId: emp._id }).sort({ 'clockIn.at': -1 }).lean();
    await FaceVerification.create({ employeeId: emp._id, direction: result === 'clock_out' ? 'out' : 'in', passed: true, score: m.score, confidence: m.confidence, live, liveness: b.liveness, device: `kiosk:${d.name}`, usedAt: now, attendanceDate: localParts(now).date });
    await FaceProfile.updateOne({ employeeId: emp._id }, { $set: { lastVerifiedAt: now }, $inc: { verifications: 1 } });
    await AttendanceDevice.updateOne({ _id: d._id }, { $set: { lastSeenAt: now, lastError: null } });
    if (result === 'already_in') return { status: 'info', name: emp.fullName, firstName: first, message: `You are already clocked in since ${new Date(rec?.clockIn?.at || now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })}. Press Clock out when you leave.`, sessionStart: rec?.clockIn?.at };
    if (result === 'no_open_session') return { status: 'info', name: emp.fullName, firstName: first, message: 'You are not clocked in yet. Press Clock in first.' };
    if (!['clock_in', 'clock_out'].includes(result)) return { status: 'unknown', message: 'Could not record the punch. Please see HR.', result };
    // the tablet's photo goes on the attendance record, like the selfie on a phone clock-in
    // tablet location on the punch (same fields as a phone clock-in), checked against the site's geofence
    if (b.gps && rec) {
      const est = await Establishment.findById(d.establishmentId || emp.establishmentId).select('geo').lean();
      const site = est?.geo; const distanceM = site?.lat != null ? distanceMeters(b.gps, site) : undefined;
      const inside = distanceM == null ? undefined : distanceM <= (site.radiusM || 300) + Math.min(b.gps.accuracyM || 0, 150);
      const key = result === 'clock_in' ? 'clockIn' : 'clockOut';
      const set = { [`${key}.lat`]: b.gps.lat, [`${key}.lng`]: b.gps.lng, [`${key}.accuracyM`]: b.gps.accuracyM, [`${key}.distanceM`]: distanceM, [`${key}.insideGeofence`]: inside };
      const upd = { $set: set };
      if (result === 'clock_in' && inside === false) upd.$push = { flags: { code: 'OUTSIDE_GEOFENCE', msg: `Tablet is ${distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`} from the site` } };
      await Attendance.updateOne({ _id: rec._id }, upd);
    }
    if (b.photo && rec && (result === 'clock_in' || !rec.hasPhoto)) await Attendance.updateOne({ _id: rec._id }, { $set: { photo: b.photo, hasPhoto: true } });
    return { status: 'ok', result, name: emp.fullName, firstName: first, at: now, sessionStart: rec?.clockIn?.at, workedMinutes: rec?.minutesWorked || 0, late: result === 'clock_in' ? rec?.lateMinutes || 0 : 0, confidence: m.confidence };
  });
  res.json(out);
}));

export default r;
