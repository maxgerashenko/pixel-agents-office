/**
 * Day/night sky: the cycle follows the real clock hour — day at :00, sunset
 * mid-hour, night by the end, then day again.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';

import { test } from 'vitest';

import { hourFraction, skyAt } from '../src/office/engine/skyCycle.js';

test('hourFraction is 0 at the top of the hour and rises through it', () => {
  assert.equal(hourFraction(new Date(2026, 0, 1, 5, 0, 0, 0)), 0);
  assert.equal(hourFraction(new Date(2026, 0, 1, 5, 30, 0, 0)), 0.5);
  assert.ok(hourFraction(new Date(2026, 0, 1, 5, 59, 59, 999)) < 1);
});

test('the hour starts in daylight: sun up, no moon, no stars', () => {
  const s = skyAt(0);
  assert.ok(s.sun);
  assert.equal(s.moon, null);
  assert.equal(s.starAlpha, 0);
});

test('late in the day the sun is lower than at its peak', () => {
  const day = skyAt(0.3);
  const set = skyAt(0.62);
  assert.ok(set.sun && day.sun);
  assert.ok(set.sun.lift < day.sun.lift);
});

test('the hour ends in night: sun gone, moon and stars out', () => {
  const s = skyAt(0.85);
  assert.equal(s.sun, null);
  assert.ok(s.moon);
  assert.equal(s.starAlpha, 1);
});

test('the cycle loops: the end of the hour blends into the start', () => {
  const end = skyAt(1);
  const start = skyAt(0);
  assert.equal(end.top, start.top);
  assert.equal(end.bottom, start.bottom);
  assert.equal(skyAt(0.9999).starAlpha < 0.01, true);
});

test('the sun crosses the sky left to right over an arc, peaking mid-way', () => {
  const early = skyAt(0.05).sun;
  const mid = skyAt(0.36).sun;
  const late = skyAt(0.65).sun;
  assert.ok(early && mid && late);
  assert.ok(early.p < mid.p && mid.p < late.p);
  assert.ok(mid.lift > early.lift && mid.lift > late.lift);
  assert.ok(Math.abs(mid.lift - 1) < 0.01);
});

test('the moon crosses left to right during the night phase', () => {
  const a = skyAt(0.7).moon;
  const b = skyAt(0.9).moon;
  assert.ok(a && b);
  assert.ok(a.p < b.p);
});
