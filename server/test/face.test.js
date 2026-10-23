// Face attendance engine: enrollment checks and match decisions (synthetic descriptors, no camera needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANGLES, distance, validateEnrollment, decide, isDescriptor, confidence, identify } from '../src/ext/lib/face.js';

let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
const person = () => Array.from({ length: 128 }, () => rnd() * 0.18); // different people end up ~0.6+ apart
const jitter = (v, amt) => v.map((x) => x + rnd() * amt);
const enroll = (p) => ANGLES.map((angle) => ({ angle, descriptor: jitter(p, 0.04) }));

test('distance and descriptor shape', () => {
  const a = person();
  assert.equal(distance(a, a), 0);
  assert.ok(isDescriptor(a));
  assert.ok(!isDescriptor(a.slice(1)));
  assert.ok(!isDescriptor([...a.slice(1), NaN]));
  assert.ok(distance(person(), person()) > 0.6);
});

test('enrollment needs every angle from the same person', () => {
  const p = person();
  assert.ok(validateEnrollment(enroll(p)).ok);
  const missing = validateEnrollment(enroll(p).filter((s) => s.angle !== 'up'));
  assert.ok(!missing.ok && /up/.test(missing.errors[0]));
  const swapped = enroll(p).map((s) => (s.angle === 'left' ? { ...s, descriptor: person() } : s));
  const r = validateEnrollment(swapped);
  assert.ok(!r.ok && /left view/.test(r.errors.join(' ')));
  // same person whose down view drifts further from the front than from the up/left/right views still passes
  const drift = enroll(p).map((s) => (s.angle === 'down' ? { ...s, descriptor: jitter(p, 0.07) } : s));
  assert.ok(validateEnrollment(drift).ok);
});

test('own face passes, a stranger fails', () => {
  const p = person(); const own = enroll(p);
  const ok = decide({ probe: jitter(p, 0.04), own });
  assert.ok(ok.passed, ok.reasons.join());
  assert.ok(ok.confidence > 50);
  const bad = decide({ probe: person(), own });
  assert.ok(!bad.passed && /does not match/.test(bad.reasons[0]));
});

test('liveness is required', () => {
  const p = person();
  const r = decide({ probe: jitter(p, 0.04), own: enroll(p), live: false });
  assert.ok(!r.passed && /Liveness/.test(r.reasons[0]));
});

test('buddy punching: a closer match to another employee fails and names them', () => {
  const me = person(); const friend = jitter(me, 0.05); // look-alike within threshold of my profile
  const r = decide({ probe: jitter(friend, 0.01), own: enroll(me), others: [{ employeeId: 'f1', samples: enroll(friend) }] });
  assert.ok(!r.passed); assert.equal(r.otherEmployeeId, 'f1');
});

test('confidence scale', () => {
  assert.equal(confidence(0), 100); assert.equal(confidence(0.5), 50); assert.equal(confidence(1.2), 0);
});

test('tablet identification (1:N): right person, strangers rejected, look-alikes not guessed', () => {
  const people = Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, face: person() }));
  const profiles = people.map((p) => ({ employeeId: p.id, samples: enroll(p.face) }));
  const r = identify(jitter(people[17].face, 0.04), profiles);
  assert.ok(r.ok); assert.equal(r.employeeId, 'e17');
  assert.equal(identify(person(), profiles).reason, 'not_recognised');
  const twin = jitter(people[3].face, 0.02); // near-identical second person enrolled
  const amb = identify(jitter(people[3].face, 0.03), [...profiles, { employeeId: 'twin', samples: enroll(twin) }]);
  assert.ok(!amb.ok); assert.equal(amb.reason, 'ambiguous');
});
