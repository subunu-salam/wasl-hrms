// Self-service passwords for employees (no email integration needed):
//   - first sign-in: email -> setup code from HR -> choose a password
//   - forgot password: email -> Face ID scan (if enrolled) or a new code from HR -> new password
// Knowing an email is never enough on its own.
import express, { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../../models/index.js';
import { runAsSystem, runWithTenant } from '../../lib/tenantContext.js';
import { FaceProfile, FeatureSettings } from '../models.js';
import { decide, isDescriptor, DEFAULT_THRESHOLD } from '../lib/face.js';
import { codeMatches, passwordProblem, MAX_ATTEMPTS } from '../lib/setupCode.js';
import { z, fail } from './_util.js';

const r = Router();
r.use(express.json({ limit: '50kb' }));
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Wait 15 minutes and try again.' } });
const findUser = (email) => runAsSystem(() => User.findOne({ email: String(email).toLowerCase().trim(), active: true }).select('+setupCodeHash').exec());

// What should this email do next? Unknown emails look the same as normal accounts without Face ID.
r.post('/check', limiter, ah(async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  const u = await findUser(email);
  if (!u) return res.json({ next: 'password', faceReset: false });
  const faceReset = !!(u.employeeId && (await runWithTenant({ tenantId: String(u.tenantId) }, () => FaceProfile.exists({ employeeId: u.employeeId, active: true }))));
  res.json({ next: u.passwordSet === false ? 'setup' : 'password', faceReset, hasCode: !!(u.setupCodeHash && u.setupCodeExpires > new Date()) });
}));

const pw = z.string().min(8).max(72);
async function setPassword(u, password) {
  const p = passwordProblem(password); if (p) throw fail(400, p);
  u.passwordHash = await bcrypt.hash(password, 10);
  u.passwordSet = true; u.setupCodeHash = undefined; u.setupCodeExpires = undefined; u.setupCodeAttempts = 0;
  u.failedLogins = 0; u.lockedUntil = undefined;
  await runAsSystem(() => u.save());
}

// Set (first time) or reset a password with the one-time code from HR.
r.post('/code', limiter, ah(async (req, res) => {
  const b = z.object({ email: z.string().email(), code: z.string().min(4).max(20), password: pw }).parse(req.body);
  const u = await findUser(b.email);
  const bad = () => fail(400, 'That code is not valid or has expired. Ask HR for a new one.');
  if (!u || !u.setupCodeHash || !(u.setupCodeExpires > new Date())) throw bad();
  if (!codeMatches(b.code, u.setupCodeHash)) {
    u.setupCodeAttempts = (u.setupCodeAttempts || 0) + 1;
    if (u.setupCodeAttempts >= MAX_ATTEMPTS) { u.setupCodeHash = undefined; u.setupCodeExpires = undefined; u.setupCodeAttempts = 0; }
    await runAsSystem(() => u.save());
    throw bad();
  }
  await setPassword(u, b.password);
  res.json({ ok: true, message: 'Password saved. You can sign in now.' });
}));

// Forgot password, verified with the employee's own Face ID.
r.post('/face', limiter, ah(async (req, res) => {
  const b = z.object({ email: z.string().email(), descriptor: z.array(z.number()).length(128), liveness: z.object({ blinks: z.number().int().min(0).max(50).default(0), turned: z.boolean().default(false) }).default({}), password: pw }).parse(req.body);
  if (!isDescriptor(b.descriptor)) throw fail(400, 'Invalid face scan.');
  const u = await findUser(b.email);
  const no = () => fail(400, "Face ID didn't match this account. Try again in good light, or ask HR for a reset code.");
  if (!u?.employeeId) throw no();
  const ok = await runWithTenant({ tenantId: String(u.tenantId) }, async () => {
    const [p, f] = await Promise.all([FaceProfile.findOne({ employeeId: u.employeeId, active: true }).select('+samples').lean(), FeatureSettings.findOne().lean()]);
    if (!p) return false;
    const th = Math.min(f?.faceAttendance?.threshold || DEFAULT_THRESHOLD, 0.48); // a bit stricter for account recovery
    return decide({ probe: b.descriptor, own: p.samples, threshold: th, live: b.liveness.blinks >= 1 || b.liveness.turned }).passed;
  });
  if (!ok) throw no();
  await setPassword(u, b.password);
  res.json({ ok: true, message: 'Password saved. You can sign in now.' });
}));

export default r;
