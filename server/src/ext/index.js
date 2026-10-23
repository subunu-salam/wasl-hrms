// Extension entry point. The MVP's app.js/index.js call these three functions; nothing else in the MVP changes.
//   mountPublic(app)  – before the JSON body parser (signature checks need the raw body)
//   mountExt(app)     – metrics + authenticated extension routes + versioned API
//   initExt()         – rule registry, Ramadan auto-mode, job worker and periodic sweeps
import express from 'express';
import rateLimit from 'express-rate-limit';
import publicRoutes from './routes/public.js';
import payroll from './routes/payroll.js';
import time from './routes/time.js';
import people from './routes/people.js';
import talent from './routes/talent.js';
import platform from './routes/platform.js';
import ai from './routes/ai.js';
import v1 from './routes/v1.js';
import face, { faceGate } from './routes/face.js';
import kiosk from './routes/kiosk.js';
import { initExtJobs } from './jobs.js';
import { metricsMiddleware, metricsHandler } from './lib/metrics.js';
import { compression } from './lib/compress.js';

export function mountPublic(app) {
  app.use(metricsMiddleware);
  if (process.env.COMPRESSION !== 'false') app.use(compression); // gzip API + static (set COMPRESSION=false if nginx already compresses)
  app.use('/api/public/kiosk', kiosk); // shared Face ID tablet (own JSON parser; before the raw-body public router)
  app.use('/api/public', publicRoutes);
  app.post(['/api/me/clock-in', '/api/me/clock-out'], ...faceGate); // Face ID check before the existing punch routes
  app.use('/api/v1', express.json({ limit: '1mb' }), v1);
  // Larger JSON bodies for extension uploads (receipts, CVs, voice notes, liveness frames, bank files, network lists).
  // Registered before the MVP's global 1 MB parser so they take effect; body-parser skips already-parsed bodies.
  app.use(['/api/me/expenses', '/api/applicants/:id/cv', '/api/me/copilot/voice', '/api/me/liveness', '/api/insurance/policies', '/api/payroll/runs/:id/rejections'], express.json({ limit: '15mb' }));
}

export function mountExt(app) {
  app.get('/metrics', metricsHandler);
  app.use('/api/agent2', rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many AI requests. Wait a minute.' } }));
  app.use('/api/me/copilot', rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many assistant requests. Wait a minute.' } }));
  for (const r of [payroll, time, people, talent, platform, ai, face]) app.use('/api', r);
}

export const initExt = initExtJobs;
