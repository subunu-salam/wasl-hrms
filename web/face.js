// Face ID for attendance — runs entirely in the browser on a normal laptop/phone camera (no biometric hardware).
// Uses face-api (TensorFlow.js, the same face-mesh/landmark approach as AR "virtual try-on") to find the face,
// track head pose, and turn a frame into a 128-number descriptor. Only descriptors are sent to the server.
//   enrollment  – iPhone-style ring: look straight, then roll your head in a circle (front/left/right/up/down)
//   verification – look at the camera, turn slightly (liveness), look back: matched on the server, then punched
const LIB = window.WASL_FACE_LIB || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js';
const MODELS = window.WASL_FACE_MODELS || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const TICKS = 60;
const YAW_T = 0.22, PITCH_T = 0.05; // pose thresholds (normalised landmark offsets from the front view)

let C = null; // { api, toast, esc }
let fa = null, loading = null;

async function lib() {
  if (fa) return fa;
  loading ||= (async () => {
    const m = await import(LIB); const f = m.default || m;
    await Promise.all([f.nets.tinyFaceDetector.loadFromUri(MODELS), f.nets.faceLandmark68Net.loadFromUri(MODELS), f.nets.faceRecognitionNet.loadFromUri(MODELS)]);
    fa = f; return f;
  })();
  try { return await loading; } catch (e) { loading = null; throw e; }
}
// warm the models in the background once the browser is idle, so the first scan opens instantly
const warm = () => (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => lib().catch(() => {}));

// ---------------------------------------------------------------- geometry
const avg = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const dist128 = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += (a[i] - b[i]) ** 2; return Math.sqrt(t); };
/** Head pose from 68 landmarks. yaw < 0 = turned to the user's left (as seen in the mirrored preview); pitch smaller = chin up. */
function pose(pts) {
  const j0 = pts[0], j16 = pts[16], nose = pts[30], chin = pts[8];
  const eyeY = avg(pts.slice(36, 48)).y;
  const yaw = -(((nose.x - j0.x) / (j16.x - j0.x || 1)) - 0.5) * 2;
  const pitch = (nose.y - eyeY) / ((chin.y - eyeY) || 1);
  const ear = (e) => (dist(e[1], e[5]) + dist(e[2], e[4])) / (2 * dist(e[0], e[3]) || 1);
  return { yaw, pitch, ear: (ear(pts.slice(36, 42)) + ear(pts.slice(42, 48))) / 2 };
}

// ---------------------------------------------------------------- camera sheet
function sheetHtml(title, sub) {
  const ticks = Array.from({ length: TICKS }, (_, i) => {
    const a = (i / TICKS) * Math.PI * 2, r1 = 47, r2 = 50;
    return `<line data-i="${i}" x1="${50 + r1 * Math.cos(a)}" y1="${50 + r1 * Math.sin(a)}" x2="${50 + r2 * Math.cos(a)}" y2="${50 + r2 * Math.sin(a)}"/>`;
  }).join('');
  return `<div class="sheet-card panel fid-card" role="dialog" aria-modal="true" aria-label="${C.esc(title)}">
    <div class="fid-head"><h2>${C.esc(title)}</h2><p>${C.esc(sub)}</p></div>
    <div class="fid-stage"><video playsinline muted autoplay></video>
      <svg class="fid-ring" viewBox="-2 -2 104 104" aria-hidden="true">${ticks}</svg>
      <div class="fid-done" hidden><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div></div>
    <div class="fid-msg" aria-live="polite">Loading face models…</div>
    <div class="fid-steps"></div>
    <div class="fid-actions"><button class="btn" data-x="cancel">Cancel</button><button class="btn pri" data-x="retry" hidden>Try again</button></div></div>`;
}

function openSheet(title, sub) {
  const sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.innerHTML = sheetHtml(title, sub);
  document.body.appendChild(sheet);
  const v = sheet.querySelector('video'), msg = sheet.querySelector('.fid-msg'), ring = sheet.querySelector('.fid-ring');
  const ticks = [...ring.querySelectorAll('line')];
  let stream = null, alive = true;
  const S = {
    sheet, v, ticks, card: sheet.querySelector('.fid-card'),
    say: (t, tone = '') => { msg.textContent = t; msg.dataset.tone = tone; },
    async start() {
      stream?.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      v.srcObject = stream; await v.play().catch(() => {});
      await new Promise((r) => (v.readyState >= 2 ? r() : v.addEventListener('loadeddata', r, { once: true })));
    },
    alive: () => alive,
    close() { alive = false; stream?.getTracks().forEach((t) => t.stop()); sheet.classList.add('out'); setTimeout(() => sheet.remove(), 200); },
    light(theta, on = 'seen') { // light the ticks around a direction (radians, 0 = right, clockwise on screen)
      const c = Math.round(((theta / (Math.PI * 2)) * TICKS + TICKS) % TICKS);
      for (let k = -2; k <= 2; k++) { const t = ticks[(c + k + TICKS) % TICKS]; if (!t.classList.contains('done')) t.classList.add(on); }
    },
    fillArc(from, to) { for (let i = 0; i < TICKS; i++) { const a = (i / TICKS) * Math.PI * 2; const d = ((a - from + Math.PI * 4) % (Math.PI * 2)); if (d <= ((to - from + Math.PI * 4) % (Math.PI * 2))) ticks[i].classList.add('done'); } },
    success() { ring.classList.add('all'); ticks.forEach((t) => t.classList.add('done')); sheet.querySelector('.fid-done').hidden = false; S.card.classList.add('ok'); },
    failRing() { S.card.classList.add('bad'); setTimeout(() => S.card.classList.remove('bad'), 700); },
  };
  return S;
}

async function detect(f, v, withDescriptor) {
  let q = f.detectSingleFace(v, new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks();
  if (withDescriptor) q = q.withFaceDescriptor();
  return q;
}
const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function centred(det, v) {
  const b = det.detection.box, cx = (b.x + b.width / 2) / v.videoWidth, cy = (b.y + b.height / 2) / v.videoHeight;
  const size = b.width / v.videoWidth;
  if (size < 0.2) return 'Move a little closer.';
  if (size > 0.75) return 'Move back a little.';
  if (Math.abs(cx - 0.5) > 0.18 || Math.abs(cy - 0.5) > 0.2) return 'Centre your face in the circle.';
  return '';
}
function snapshot(v) {
  const w = Math.min(480, v.videoWidth), h = Math.round((v.videoHeight / v.videoWidth) * w);
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(v, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.78);
}

// ---------------------------------------------------------------- enrollment
const ANG = { front: 'Look straight', left: 'Turn left', right: 'Turn right', up: 'Look up', down: 'Look down' };
const ARC = { right: [-0.6, 0.6], down: [Math.PI / 2 - 0.6, Math.PI / 2 + 0.6], left: [Math.PI - 0.6, Math.PI + 0.6], up: [-Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6] };

export async function enroll(opt = {}) {
  const S = openSheet(opt.title || 'Set up Face ID', opt.sub || 'A quick 360° scan from your own camera. Only a numeric face signature is stored, never the video.');
  const steps = S.sheet.querySelector('.fid-steps');
  const paintSteps = (got) => (steps.innerHTML = Object.keys(ANG).map((a) => `<span class="${got[a] ? 'on' : ''}">${got[a] ? '✓ ' : ''}${ANG[a]}</span>`).join(''));
  return new Promise((resolve) => {
    let result = false;
    S.sheet.querySelector('[data-x=cancel]').onclick = () => { S.close(); resolve(result); };
    const run = async () => {
      const got = {}; const samples = []; let base = null; const fronts = [];
      paintSteps(got);
      try { const [f] = await Promise.all([lib(), S.start()]); S.say('Position your face inside the circle.');
        while (S.alive()) {
          await frame();
          const det = await detect(f, S.v, false);
          if (!S.alive()) return;
          if (!det) { S.say('No face found. Face the camera in good light.'); continue; }
          const p = pose(det.landmarks.positions);
          if (!base) {
            const c = centred(det, S.v); if (c) { S.say(c); continue; }
            S.say('Hold still…');
            const d = await detect(f, S.v, true); if (!d) continue;
            const pp = pose(d.landmarks.positions); fronts.push({ d: Array.from(d.descriptor), p: pp });
            if (fronts.length < 2) { await sleep(250); continue; }
            base = { yaw: (fronts[0].p.yaw + fronts[1].p.yaw) / 2, pitch: (fronts[0].p.pitch + fronts[1].p.pitch) / 2 };
            fronts.forEach((x) => samples.push({ angle: 'front', descriptor: x.d })); got.front = true; paintSteps(got);
            S.say('Now slowly move your head to complete the circle.');
            continue;
          }
          const dx = p.yaw - base.yaw, dy = p.pitch - base.pitch;
          const m = Math.hypot(dx / YAW_T, dy / PITCH_T);
          if (m > 0.55) S.light(Math.atan2(dy / PITCH_T, dx / YAW_T));
          let want = null;
          if (dx <= -YAW_T && Math.abs(dy) < PITCH_T * 1.6) want = 'left';
          else if (dx >= YAW_T && Math.abs(dy) < PITCH_T * 1.6) want = 'right';
          else if (dy <= -PITCH_T && Math.abs(dx) < YAW_T) want = 'up';
          else if (dy >= PITCH_T && Math.abs(dx) < YAW_T) want = 'down';
          if (want && !got[want]) {
            const d = await detect(f, S.v, true);
            if (d) {
              // Retake on the spot if this frame drifted too far from the front view (steep angle, glare on glasses,
              // motion blur) instead of failing the whole scan at the end.
              const desc = Array.from(d.descriptor);
              const drift = Math.min(...fronts.map((x) => dist128(x.d, desc)));
              if (drift > 0.62) { S.say(want === 'down' || want === 'up' ? `A little less ${want}, and hold still…` : 'Hold still for a moment…'); continue; }
              samples.push({ angle: want, descriptor: desc }); got[want] = true; S.fillArc(...ARC[want]); paintSteps(got); if (navigator.vibrate) navigator.vibrate(20);
            }
          }
          const left = Object.keys(ANG).filter((a) => !got[a]);
          if (!left.length) break;
          S.say(`Keep moving your head: ${left.map((a) => ANG[a].toLowerCase()).join(', ')}.`);
        }
        if (!S.alive()) return;
        S.say('Saving…');
        await C.api(opt.url || '/me/face/enroll', { method: 'POST', body: { samples } });
        S.success(); S.say(opt.done || 'Face ID is set up. You can now clock in with a glance.', 'ok'); result = true;
        await sleep(1300); S.close(); resolve(true);
      } catch (e) {
        if (!S.alive()) return;
        S.failRing(); S.say(camError(e), 'bad');
        const b = S.sheet.querySelector('[data-x=retry]'); b.hidden = false;
        b.onclick = () => { b.hidden = true; S.ticks.forEach((t) => t.classList.remove('seen', 'done')); run(); };
      }
    };
    run();
  });
}

function camError(e) {
  const n = e?.name || '';
  if (n === 'NotAllowedError') return 'Camera access is blocked. Allow the camera for this site (lock icon in the address bar) and try again.';
  if (n === 'NotFoundError') return 'No camera found on this device.';
  if (/fetch|import|load/i.test(e?.message || '')) return 'Could not load the face models. Check your internet connection and try again.';
  return e?.message || 'Something went wrong.';
}

// ---------------------------------------------------------------- verification
export async function verify(direction = 'in') {
  const S = openSheet(direction === 'out' ? 'Clock out with Face ID' : 'Clock in with Face ID', 'Look at the camera, then turn your head slightly.');
  S.sheet.querySelector('.fid-steps').remove();
  return new Promise((resolve) => {
    S.sheet.querySelector('[data-x=cancel]').onclick = () => { S.close(); resolve(null); };
    let attempts = 0;
    const run = async () => {
      attempts++;
      try {
        const [f] = await Promise.all([lib(), S.start()]);
        let first = null, minY = Infinity, maxY = -Infinity, blinks = 0, earAvg = null, closed = false;
        const t0 = Date.now(); let phase = 'find';
        S.say('Look at the camera.');
        while (S.alive()) {
          if (Date.now() - t0 > 30000) throw new Error('Timed out. Try again in better light.');
          await frame();
          const det = await detect(f, S.v, false);
          if (!S.alive()) return;
          if (!det) { S.say('No face found. Face the camera in good light.'); continue; }
          const p = pose(det.landmarks.positions);
          minY = Math.min(minY, p.yaw); maxY = Math.max(maxY, p.yaw);
          earAvg = earAvg == null ? p.ear : earAvg * 0.9 + p.ear * 0.1;
          if (!closed && p.ear < earAvg * 0.72) closed = true; else if (closed && p.ear > earAvg * 0.9) { closed = false; blinks++; }
          if (phase === 'find') { const c = centred(det, S.v); if (c) { S.say(c); continue; } first = p; phase = 'turn'; S.say('Now turn your head slightly left or right.'); continue; }
          S.light(Math.atan2(0, p.yaw - first.yaw > 0 ? 1 : -1), 'seen');
          if (phase === 'turn') { if (maxY - minY >= 0.18) { phase = 'back'; S.say('Great, now look straight at the camera.'); } continue; }
          if (Math.abs(p.yaw - first.yaw) > 0.08 || centred(det, S.v)) continue;
          const d = await detect(f, S.v, true); if (!d) continue;
          const photo = snapshot(S.v);
          S.say('Checking…');
          const r = await C.api('/me/face/verify', { method: 'POST', body: { descriptor: Array.from(d.descriptor), direction, liveness: { blinks, turned: maxY - minY >= 0.18 } } });
          if (!r.passed) throw Object.assign(new Error(`${r.reasons?.[0] || 'Face not recognised.'}`), { soft: true });
          S.success(); S.say(`Verified · ${r.confidence}% match`, 'ok');
          await sleep(900); S.close(); resolve({ verificationId: r.verificationId, photo, confidence: r.confidence });
          return;
        }
      } catch (e) {
        if (!S.alive()) return;
        S.failRing(); S.say(camError(e) + (attempts >= 3 ? ' If this keeps happening, ask HR to reset your Face ID.' : ''), 'bad');
        const b = S.sheet.querySelector('[data-x=retry]'); b.hidden = false;
        b.onclick = () => { b.hidden = true; S.ticks.forEach((t) => t.classList.remove('seen', 'done')); run(); };
      }
    };
    run();
  });
}

// ---------------------------------------------------------------- integration points used by app.js
/**
 * Before a clock-in/out. Returns undefined when Face ID is not in use (caller falls back to the selfie flow),
 * null when the person cancelled, or { verificationId, photo } after a passed scan.
 */
async function gate(direction) {
  let st; try { st = await C.api('/me/face', { fresh: true }); } catch { return undefined; }
  if (!st.enrolled && !st.required) return undefined;
  if (!st.enrolled) { C.toast('Your company uses Face ID for attendance. Set it up once (about 20 seconds).'); if (!(await enroll())) return null; }
  return verify(direction);
}

async function mountCard(el) {
  if (!el) return;
  let st; try { st = await C.api('/me/face', { fresh: true }); } catch { return; }
  if (st.enrolled || st.required) warm();
  const when = st.lastVerifiedAt ? `Last used ${new Date(st.lastVerifiedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : st.enrolledAt ? `Set up ${new Date(st.enrolledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  el.innerHTML = `<div class="panel fid-banner ${st.enrolled ? 'on' : ''}">
    <span class="fid-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/></svg></span>
    <div class="fid-txt"><b>${st.enrolled ? 'Face ID is on' : st.required ? 'Set up Face ID to clock in' : 'Clock in with Face ID'}</b>
      <small>${st.enrolled ? `${C.esc(when)} · clock-ins are matched to your face, no selfie needed` : 'A one-time 360° scan with this camera. No fingerprint machine needed.'}</small></div>
    <div class="fid-btns">${st.enrolled ? '<button class="btn sm" data-f="re">Rescan</button><button class="btn sm" data-f="rm">Remove</button>' : '<button class="btn pri sm" data-f="set">Set up Face ID</button>'}</div></div>`;
  el.onclick = async (e) => {
    const b = e.target.closest('[data-f]'); if (!b) return;
    if (b.dataset.f === 'rm') {
      if (st.required) { C.toast('Face ID is required by your company. Use Rescan to update it.'); return; }
      await C.api('/me/face', { method: 'DELETE' }).catch((x) => C.toast(x.message)); C.toast('Face ID removed'); return mountCard(el);
    }
    if (await enroll()) { C.toast('Face ID saved'); mountCard(el); }
  };
}

// After sign-in, employees without Face ID get a one-time prompt (once per browser session).
const STAFF = ['owner', 'hr_admin', 'payroll_maker', 'payroll_checker', 'manager'];
function promptSheet(required) {
  return new Promise((resolve) => {
    const sh = document.createElement('div'); sh.className = 'sheet';
    sh.innerHTML = `<div class="sheet-card panel fid-card" role="dialog" aria-modal="true" aria-label="Set up Face ID">
      <div class="fid-intro" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9.5 16a4 4 0 0 0 5 0"/></svg></div>
      <div class="fid-head"><h2>Set up Face ID</h2><p>${required ? 'Your company uses Face ID for attendance. ' : ''}Clock in and out with a glance, no fingerprint machine or selfie needed. It takes about 20 seconds.</p></div>
      <div class="fid-actions"><button class="btn" data-x="later">Later</button><button class="btn pri" data-x="go">Set up now</button></div></div>`;
    document.body.appendChild(sh);
    const done = (v) => { sh.remove(); resolve(v); };
    sh.querySelector('[data-x=later]').onclick = () => done(false);
    sh.querySelector('[data-x=go]').onclick = () => done(true);
  });
}
async function maybePrompt() {
  let u; try { if (!localStorage.getItem('wasl_token')) return false; u = JSON.parse(localStorage.getItem('wasl_user') || 'null'); } catch { return false; }
  if (!u) return false;
  if ((u.roles || []).some((r) => STAFF.includes(r))) return true; // HR/staff: nothing to prompt
  try { if (sessionStorage.getItem('wasl_face_prompted')) return true; sessionStorage.setItem('wasl_face_prompted', '1'); } catch { /* ignore */ }
  let st; try { st = await C.api('/me/face', { fresh: true }); } catch { return true; }
  if (st.enrolled) { warm(); return true; }
  warm();
  if (await promptSheet(st.required) && await enroll()) {
    C.toast('Face ID saved. Use it from Attendance when you clock in.');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  return true;
}
const watch = async () => { if (!(await maybePrompt())) setTimeout(watch, 1500); };
/** Called on sign-out so the next person to sign in on this page gets their own prompt. */
function reset() { try { sessionStorage.removeItem('wasl_face_prompted'); } catch { /* ignore */ } setTimeout(watch, 1500); }
function init(ctx) {
  C = ctx;
  // runs on load (already signed in) and keeps watching until the person signs in
  setTimeout(watch, 1200);
  window.addEventListener('storage', () => { try { if (!localStorage.getItem('wasl_token')) sessionStorage.removeItem('wasl_face_prompted'); } catch { /* ignore */ } });
}

/** HR scans an employee in person (for staff who only use the shared tablet). */
async function hrEnroll(employeeId, name) {
  const ok = await enroll({ url: `/attendance/face/${employeeId}/enroll`, title: `Face ID for ${name}`, sub: `Ask ${name.split(' ')[0]} to look at this camera and slowly roll their head in a circle. Only a numeric signature is stored.`, done: `${name.split(' ')[0]} can now clock in on the shared tablet.` });
  if (ok) C.toast(`Face ID saved for ${name}`);
  return ok;
}
window.waslKioskLink = () => { try { localStorage.setItem('wasl_tab_timeplus', 'face'); } catch { /* ignore */ } document.querySelector('[data-tab="face"]')?.click(); };

window.waslFace = { init, reset, gate, enroll, hrEnroll, verify, mountCard };
