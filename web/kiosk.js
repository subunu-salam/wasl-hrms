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
  // The tablet is stationary: read its location on load and refresh every 10 minutes; sent with each punch.
  let gps = null;
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { gps = { lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: Math.round(p.coords.accuracy) }; }, () => {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 });
  locate(); setInterval(locate, 10 * 60 * 1000);
  const v = $('kVideo');
  let f = null, stream = null;
  // Load the face models in the background while the buttons are showing, so a scan starts instantly.
  show('home', 'Clock in or out', 'Tap a button, then look at the camera');
  const ready = (async () => { const m = await import(LIB); const lib = m.default || m; await Promise.all([lib.nets.tinyFaceDetector.loadFromUri(MODELS), lib.nets.faceLandmark68Net.loadFromUri(MODELS), lib.nets.faceRecognitionNet.loadFromUri(MODELS)]); f = lib; return lib; })();
  ready.catch(() => {});
  const stopCam = () => { stream?.getTracks().forEach((t) => t.stop()); stream = null; v.srcObject = null; };
  let run = 0;
  const home = () => { run++; stopCam(); timer(null); $('kCancel').hidden = true; show('home', 'Clock in or out', 'Tap a button, then look at the camera'); };
  $('kCancel').onclick = home;
  $('kIn').onclick = () => scan('in');
  $('kOut').onclick = () => scan('out');

  // Geo-tagged photo: what/where, date-time (GST) and the tablet's coordinates stamped along the bottom.
  function snapshot(direction) {
    const w = Math.min(480, v.videoWidth || 480), h = Math.round(((v.videoHeight || 360) / (v.videoWidth || 480)) * w);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(v, 0, 0, w, h);
    const lines = [
      `${direction === 'out' ? 'Clock out' : 'Clock in'} · ${[info.company, (() => { const n = info.device || info.site || ''; return /tablet/i.test(n) ? n : `${n} tablet`.trim(); })()].filter(Boolean).join(' · ')}`,
      `${new Date().toLocaleString('en-GB', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} GST`,
      gps ? `${gps.lat.toFixed(5)}°, ${gps.lng.toFixed(5)}° ±${gps.accuracyM} m` : 'Location: not available',
    ];
    const fs = Math.max(11, Math.round(w / 34)), pad = Math.round(fs * 0.75), lh = Math.round(fs * 1.4), boxH = lines.length * lh + pad * 1.4;
    const grad = g.createLinearGradient(0, h - boxH - fs, 0, h); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.25, 'rgba(0,0,0,.62)'); grad.addColorStop(1, 'rgba(0,0,0,.78)');
    g.fillStyle = grad; g.fillRect(0, h - boxH - fs, w, boxH + fs); g.textBaseline = 'top';
    lines.forEach((t, i) => { g.font = `${i === 0 ? '600 ' : ''}${fs}px system-ui, sans-serif`; g.fillStyle = i === 0 ? '#fff' : 'rgba(255,255,255,.88)'; g.fillText(t, pad + (i === 2 ? fs * 0.95 : 0), h - boxH + pad * 0.7 + i * lh); });
    const px = pad, py = h - boxH + pad * 0.7 + lh * 2 + fs * 0.1;
    g.fillStyle = gps ? '#ff5b1f' : '#9ca3af'; g.beginPath(); g.arc(px + fs * 0.35, py + fs * 0.32, fs * 0.3, Math.PI, 0); g.lineTo(px + fs * 0.35, py + fs * 0.95); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px + fs * 0.35, py + fs * 0.32, fs * 0.11, 0, Math.PI * 2); g.fill();
    return c.toDataURL('image/jpeg', 0.75);
  }

  async function scan(direction) {
    const my = ++run; const alive = () => my === run;
    $('kCancel').hidden = false;
    show('scanning', direction === 'in' ? 'Clock in · look at the camera' : 'Clock out · look at the camera', 'Starting camera…', 0);
    try {
      [stream] = await Promise.all([navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false }), ready]);
      if (!alive()) { stream.getTracks().forEach((t) => t.stop()); return; }
      v.srcObject = stream; await v.play().catch(() => {});
    } catch (e) {
      if (!alive()) return;
      show('bad', e?.name === 'NotAllowedError' ? 'Camera is blocked' : e?.name === 'NotReadableError' ? 'Camera is busy' : 'Face ID could not start', e?.name === 'NotAllowedError' ? 'Allow the camera for this site in the browser settings.' : e?.name === 'NotReadableError' ? 'Close other apps or tabs using the camera, then try again.' : 'Check the internet connection and try again.');
      stopCam(); setTimeout(() => alive() && home(), 5000); return;
    }
    const opts = new f.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    let since = 0, track = [], blinks = 0, earAvg = null, closed = false; const t0 = Date.now();
    while (alive()) {
      await new Promise((r) => requestAnimationFrame(r));
      if (Date.now() - t0 > 30000) { show('bad', 'Timed out', 'Tap the button and try again.'); stopCam(); setTimeout(() => alive() && home(), 3000); return; }
      const det = await f.detectSingleFace(v, opts).withFaceLandmarks();
      if (!alive()) return;
      if (!det) { since = 0; track = []; show('scanning', direction === 'in' ? 'Clock in · look at the camera' : 'Clock out · look at the camera', 'No face yet', 0); continue; }
      const fr = framing(det, v);
      if (fr) { since = 0; show('scanning', fr, '', 0); continue; }
      const p = pose(det.landmarks.positions); const now = Date.now();
      if (!since) since = now;
      track.push({ t: now, ...p }); track = track.filter((x) => now - x.t < 2000);
      earAvg = earAvg == null ? p.ear : earAvg * 0.85 + p.ear * 0.15;
      if (!closed && p.ear < earAvg * 0.72) closed = true; else if (closed && p.ear > earAvg * 0.9) { closed = false; blinks++; }
      const moved = track.length > 3 && (Math.max(...track.map((x) => x.yaw)) - Math.min(...track.map((x) => x.yaw)) > 0.05 || Math.max(...track.map((x) => x.pitch)) - Math.min(...track.map((x) => x.pitch)) > 0.025);
      const prog = Math.min(1, (now - since) / STEADY_MS);
      show('scanning', 'Hold still…', blinks || moved ? 'Reading your face' : 'Blink once', prog);
      if (prog < 1 || !(blinks || moved)) { if (now - since > 4000 && !(blinks || moved)) show('scanning', 'Blink or nod slightly', 'so we know it is really you', 1); continue; }
      const d = await f.detectSingleFace(v, opts).withFaceLandmarks().withFaceDescriptor();
      if (!d || !alive()) continue;
      const photo = snapshot(direction);
      show('scanning', 'Checking…', '', 1);
      let r;
      try { r = await call('/identify', { direction, photo, ...(gps ? { gps } : {}), descriptor: Array.from(d.descriptor), liveness: { blinks, moved } }); } catch (e) {
        show('bad', e.status === 401 ? 'Tablet link turned off' : 'No connection', e.status === 401 ? 'Ask HR to turn this tablet back on.' : 'Check the Wi-Fi and try again.');
        stopCam(); setTimeout(() => alive() && home(), 4000); return;
      }
      if (!alive()) return;
      if (r.status === 'retry') { show('scanning', r.message, '', 1); since = 0; await new Promise((x) => setTimeout(x, 800)); continue; }
      stopCam(); $('kCancel').hidden = true;
      if (r.status === 'ok') {
        if (navigator.vibrate) navigator.vibrate(30);
        if (r.result === 'clock_in') { show('ok', `Welcome, ${r.firstName}`, `Clocked in at ${fmtT(r.sessionStart || r.at)}${r.late ? ` · ${r.late} min late` : ''}`); timer(r.sessionStart || r.at); }
        else show('ok', `Goodbye, ${r.firstName}`, `Clocked out at ${fmtT(r.at)} · worked ${hm(r.workedMinutes || 0)}`);
      } else if (r.status === 'info') {
        show('info', `Hi ${r.firstName}`, r.message); if (r.sessionStart) timer(r.sessionStart);
      } else show('bad', 'Not recognised', r.message || 'Ask HR to set up your Face ID.');
      setTimeout(() => alive() && home(), r.status === 'ok' ? RESULT_MS : 4000);
      return;
    }
  }
}
main();
