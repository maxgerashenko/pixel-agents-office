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

test('sunset: the sun is low and warm-coloured, sky is between day and night', () => {
  const day = skyAt(0.3);
  const set = skyAt(0.62);
  assert.ok(set.sun && day.sun);
  assert.ok(set.sun.y > day.sun.y);
  assert.notEqual(set.top, day.top);
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
