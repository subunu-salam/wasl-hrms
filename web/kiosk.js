// Shared Face ID tablet: "Look & Verify". No login. The tablet key comes from the link HR created
// (#k=kio_xxx.secret) and is kept in this browser. Staff look at the camera; the server identifies them
// among everyone enrolled and records the clock-in/out straight into Attendance.
const LIB = window.WASL_FACE_LIB || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/dist/face-api.esm.js';
const MODELS = window.WASL_FACE_MODELS || 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model/';
const KEY_STORE = 'wasl_kiosk_key';
const RESULT_MS = 4500;  // how long the green tick / name stays up
const STEADY_MS = 700;   // face must be steady this long before we read it

const $ = (id) => document.getElementById(id);
const stage = $('kStage');
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// ---------------------------------------------------------------- key from link
const fromHash = /(?:^|[#&])k=([\w-]+\.[\w-]+)/.exec(location.hash)?.[1];
if (fromHash) { store.set(KEY_STORE, fromHash); history.replaceState(null, '', location.pathname); }
const KEY = fromHash || store.get(KEY_STORE);

async function call(path, body) {
  const res = await fetch(`/api/public/kiosk${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'X-Kiosk-Key': KEY || '' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status });
  return data;
}

// ---------------------------------------------------------------- clock + chrome
const TZ = 'Asia/Dubai';
const fmtT = (d, s) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(s ? { second: '2-digit' } : {}), timeZone: TZ });
setInterval(() => { $('kTime').textContent = fmtT(Date.now()); $('kDate').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ }); }, 1000);
$('kFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});
let wake = null; const keepAwake = async () => { try { wake = await navigator.wakeLock?.request('screen'); } catch { /* not supported */ } };
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

function show(state, title, sub = '', progress = 0) {
  stage.dataset.state = state; $('kTitle').textContent = title; $('kSub').textContent = sub;
  stage.style.setProperty('--p', Math.round(progress * 100));
  $('kArc').style.strokeDasharray = state === 'scanning' ? `${Math.round(progress * 100)} 100` : '';
}
const hm = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
let timerInt = null;
function timer(fromIso) {
  const el = $('kTimer'); clearInterval(timerInt);
  if (!fromIso) { el.hidden = true; return; }
  const draw = () => { const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso)) / 1000)); el.innerHTML = `<i></i>On shift ${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  draw(); el.hidden = false; timerInt = setInterval(draw, 1000);
}

// ---------------------------------------------------------------- face helpers
const avg = (pts) => pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pose(pts) {
  const j0 = pts[0], j16 = pts[16], nose = pts[30], chin = pts[8], eyeY = avg(pts.slice(36, 48)).y;
  const ear = (e) => (dist(e[1], e[5]) + dist(e[2], e[4])) / (2 * dist(e[0], e[3]) || 1);
  return { yaw: ((nose.x - j0.x) / (j16.x - j0.x || 1) - 0.5) * 2, pitch: (nose.y - eyeY) / ((chin.y - eyeY) || 1), ear: (ear(pts.slice(36, 42)) + ear(pts.slice(42, 48))) / 2 };
}
function framing(det, v) {
  const b = det.detection.box, size = b.width / v.videoWidth, cx = (b.x + b.width / 2) / v.videoWidth;
  if (size < 0.16) return 'Step a little closer';
  if (size > 0.8) return 'Step back a little';
  if (Math.abs(cx - 0.5) > 0.22) return 'Move to the centre';
  return '';
}

// ---------------------------------------------------------------- main loop
async function main() {
  if (!KEY) { $('kSetup').hidden = false; return; }
  let info;
  try { info = await call('/hello'); } catch (e) { $('kSetup').hidden = false; $('kSetupErr').textContent = e.status === 401 ? e.message : `Can't reach the server: ${e.message}`; return; }
  $('kCompany').textContent = info.company || 'Wasl'; $('kSite').textContent = [info.site, info.device].filter(Boolean).join(' · ') || 'Face ID clock-in';
  keepAwake();
  show('boot', 'Starting camera…', 'Allow camera access if asked');
  const v = $('kVideo');
  let f;
  try {
    const [m, stream] = await Promise.all([import(LIB), navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })]);
    f = m.default || m; v.srcObject = stream; await v.play().catch(() => {});
    show('boot', 'Loading Face ID…', 'Only the first time on this tablet');
    await Promise.all([f.nets.tinyFaceDetector.loadFromUri(MODELS), f.nets.faceLandmark68Net.loadFromUri(MODELS), f.nets.faceRecognitionNet.loadFromUri(MODELS)]);
  } catch (e) {
    show('bad', e?.name === 'NotAllowedError' ? 'Camera is blocked' : 'Face ID could not start', e?.name === 'NotAllowedError' ? 'Allow the camera for this site in the browser settings, then reload.' : 'Check the internet connection, then reload this page.');
    return;
  }
  const opts = new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const idle = () => { timer(null); show('idle', 'Look at the camera', 'to clock in or out'); };
  idle();

  let since = 0, track = [], blinks = 0, earAvg = null, closed = false, busy = false, pauseUntil = 0;
  const reset = () => { since = 0; track = []; blinks = 0; earAvg = null; closed = false; };
  for (;;) {
    await new Promise((r) => requestAnimationFrame(r));
    if (busy || Date.now() < pauseUntil) continue;
    if (stage.dataset.state === 'ok' || stage.dataset.state === 'bad') idle();
    const det = await f.detectSingleFace(v, opts).withFaceLandmarks();
    if (!det) { if (since) { reset(); idle(); } continue; }
    const fr = framing(det, v);
    if (fr) { reset(); show('idle', fr, 'Look at the camera to clock in or out'); continue; }
    const p = pose(det.landmarks.positions); const now = Date.now();
    if (!since) since = now;
    track.push({ t: now, ...p }); track = track.filter((x) => now - x.t < 2000);
    earAvg = earAvg == null ? p.ear : earAvg * 0.85 + p.ear * 0.15;
    if (!closed && p.ear < earAvg * 0.72) closed = true; else if (closed && p.ear > earAvg * 0.9) { closed = false; blinks++; }
    const moved = track.length > 3 && (Math.max(...track.map((x) => x.yaw)) - Math.min(...track.map((x) => x.yaw)) > 0.05 || Math.max(...track.map((x) => x.pitch)) - Math.min(...track.map((x) => x.pitch)) > 0.025);
    const prog = Math.min(1, (now - since) / STEADY_MS);
    show('scanning', 'Hold still…', blinks || moved ? 'Reading your face' : 'Blink once', prog);
    if (prog < 1 || !(blinks || moved)) { if (now - since > 4000 && !(blinks || moved)) show('scanning', 'Blink or nod slightly', 'so we know it is really you', 1); continue; }

    busy = true;
    try {
      const d = await f.detectSingleFace(v, opts).withFaceLandmarks().withFaceDescriptor();
      if (!d) { busy = false; continue; }
      const r = await call('/identify', { descriptor: Array.from(d.descriptor), liveness: { blinks, moved } });
      if (r.status === 'ok') {
        if (navigator.vibrate) navigator.vibrate(30);
        if (r.result === 'clock_in') { show('ok', `Welcome, ${r.firstName}`, `${r.repeat ? 'Already clocked in' : 'Clocked in'} at ${fmtT(r.sessionStart || r.at)}${r.late ? ` · ${r.late} min late` : ''}`); timer(r.sessionStart || r.at); }
        else { show('ok', `Goodbye, ${r.firstName}`, `${r.repeat ? 'Already clocked out' : 'Clocked out'} at ${fmtT(r.at)} · worked ${hm(r.workedMinutes || 0)}`); timer(null); }
        pauseUntil = Date.now() + RESULT_MS;
      } else if (r.status === 'retry') {
        show('scanning', r.message, '', 1); pauseUntil = Date.now() + 900;
      } else {
        show('bad', 'Not recognised', r.message || 'Ask HR to set up your Face ID.'); pauseUntil = Date.now() + 3000;
      }
    } catch (e) {
      show('bad', e.status === 401 ? 'Tablet link turned off' : 'No connection', e.status === 401 ? 'Ask HR for a new tablet link.' : 'Check the Wi-Fi and try again.');
      pauseUntil = Date.now() + 4000;
    }
    reset(); busy = false;
  }
}
main();
