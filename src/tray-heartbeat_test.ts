import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TrayHeartbeat } from './tray-heartbeat.ts';

test('one readiness message is emitted only on the first established connection', () => {
  const heartbeat = new TrayHeartbeat(3);
  assert.deepEqual(heartbeat.observe(false), { continuePolling: true });
  assert.deepEqual(heartbeat.observe(true), { continuePolling: true, message: 'Ready' });
  assert.deepEqual(heartbeat.observe(true), { continuePolling: true });
});

test('a connection lost after Ready announces loss and terminates polling', () => {
  const heartbeat = new TrayHeartbeat(3);
  heartbeat.observe(true);
  assert.deepEqual(heartbeat.observe(false), { continuePolling: false, message: 'Unavailable' });
  assert.deepEqual(heartbeat.observe(true), { continuePolling: false });
});

test('waiting for a missing tray connection has a finite budget', () => {
  const heartbeat = new TrayHeartbeat(3);
  assert.deepEqual(heartbeat.observe(false), { continuePolling: true });
  assert.deepEqual(heartbeat.observe(false), { continuePolling: true });
  assert.deepEqual(heartbeat.observe(false), { continuePolling: false, message: 'Unavailable' });
});

test('initial connection before timeout resets failure budget', () => {
  const heartbeat = new TrayHeartbeat(2);
  heartbeat.observe(false);
  assert.deepEqual(heartbeat.observe(true), { continuePolling: true, message: 'Ready' });
});

test('invalid retry threshold is rejected', () => {
  assert.throws(() => new TrayHeartbeat(0), RangeError);
});
