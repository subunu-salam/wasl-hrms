import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCode, hashCode, codeMatches, normalise, passwordProblem } from '../src/ext/lib/setupCode.js';

test('setup codes: format, case/dash-insensitive match, no lookalike characters', () => {
  const c = newCode();
  assert.match(c, /^[A-HJ-KM-NP-Z2-9]{4}-[A-HJ-KM-NP-Z2-9]{4}$/);
  const h = hashCode(c);
  assert.ok(codeMatches(c.toLowerCase().replace('-', ' '), h));
  assert.ok(!codeMatches('AAAA-AAAA', h));
  assert.ok(!codeMatches(c, undefined));
  assert.equal(normalise(' ab-cd 23 '), 'ABCD23');
  assert.notEqual(newCode(), newCode());
});

test('password rules', () => {
  assert.ok(passwordProblem('short1'));
  assert.ok(passwordProblem('longpassword'));
  assert.equal(passwordProblem('Desert2026'), null);
});
