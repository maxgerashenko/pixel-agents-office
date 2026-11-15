/**
 * Day/night sky: the cycle follows the real clock hour — dawn over :00–:03, day
 * until :30, dusk over :30–:33, night until the hour turns.
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

test('dawn opens the hour: night at :00, full day by :03', () => {
  const start = skyAt(0);
  assert.ok(start.sun);
  assert.equal(start.starAlpha, 1);
  const mid = skyAt(0.025);
  assert.ok(mid.starAlpha > 0 && mid.starAlpha < 1);
  const day = skyAt(0.05);
  assert.ok(day.sun);
  assert.equal(day.moon, null);
  assert.equal(day.starAlpha, 0);
  assert.equal(day.dayAlpha, 1);
});

test('the day holds until :30', () => {
  const s = skyAt(0.49);
  assert.ok(s.sun);
  assert.equal(s.moon, null);
  assert.equal(s.starAlpha, 0);
});

test('night starts at :30 and is full by :33', () => {
  assert.equal(skyAt(0.5).starAlpha, 0);
  const dusk = skyAt(0.525);
  assert.ok(dusk.sun && dusk.moon);
  assert.ok(dusk.starAlpha > 0 && dusk.starAlpha < 1);
  const night = skyAt(0.56);
  assert.equal(night.sun, null);
  assert.ok(night.moon);
  assert.equal(night.starAlpha, 1);
  assert.equal(night.dayAlpha, 0);
});

test('the cycle loops: the end of the hour blends into the start', () => {
  const end = skyAt(0.9999);
  const start = skyAt(0);
  assert.equal(end.top, start.top);
  assert.equal(end.bottom, start.bottom);
  assert.equal(end.starAlpha, start.starAlpha);
});

test('the sun crosses the sky left to right over an arc, peaking mid-way', () => {
  const early = skyAt(0.05).sun;
  const mid = skyAt(0.275).sun;
  const late = skyAt(0.5).sun;
  assert.ok(early && mid && late);
  assert.ok(early.p < mid.p && mid.p < late.p);
  assert.ok(mid.lift > early.lift && mid.lift > late.lift);
  assert.ok(Math.abs(mid.lift - 1) < 0.01);
});

test('the moon crosses left to right during the night phase', () => {
  const a = skyAt(0.6).moon;
  const b = skyAt(0.9).moon;
  assert.ok(a && b);
  assert.ok(a.p < b.p);
});
