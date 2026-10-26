import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StartupCoordinator, type StartupPrerequisites } from './startup-coordinator.ts';
import { TrayHeartbeat } from './tray-heartbeat.ts';
import { LineProtocol, encodeMessage } from './indicator-line-protocol.ts';

function setup() {
  const events: string[] = [];
  const state: StartupPrerequisites = {
    startMinimized: true,
    backgroundEnabled: true,
    suspensionInhibited: true,
    tray: 'pending',
  };
  const decoder = new LineProtocol();
  const coordinator = new StartupCoordinator({
    prerequisites: () => ({ ...state }),
    showWindow: () => { events.push('show'); },
    hideWindow: () => { events.push('hide'); },
    scheduleFallback: () => () => {},
  });
  const deliver = (bytes: Uint8Array) => {
    for (const message of decoder.push(bytes)) {
      if (message === 'Ready') state.tray = 'ready';
      if (message === 'Unavailable') state.tray = 'unavailable';
      coordinator.onPrerequisitesChanged();
    }
  };
  return { events, state, coordinator, deliver };
}

test('KDE tray eventually connects: an IPC Ready event is required before hiding', () => {
  const fixture = setup();
  fixture.coordinator.activate(true);
  assert.deepEqual(fixture.events, []);
  const heartbeat = new TrayHeartbeat(3);
  const response = heartbeat.observe(true);
  assert.equal(response.message, 'Ready');
  const framed = encodeMessage(response.message!);
  fixture.deliver(framed.subarray(0, 2));
  assert.deepEqual(fixture.events, []);
  fixture.deliver(framed.subarray(2));
  assert.deepEqual(fixture.events, ['hide']);

  const loss = heartbeat.observe(false);
  assert.equal(loss.message, 'Unavailable');
  fixture.deliver(encodeMessage(loss.message!));
  assert.deepEqual(fixture.events, ['hide', 'show']);
});

test('KDE tray absent: finite availability probe emits Unavailable and opens window', () => {
  const fixture = setup();
  fixture.coordinator.activate(true);
  const heartbeat = new TrayHeartbeat(2);
  assert.equal(heartbeat.observe(false).continuePolling, true);
  const event = heartbeat.observe(false);
  assert.equal(event.message, 'Unavailable');
  fixture.deliver(encodeMessage(event.message!));
  assert.deepEqual(fixture.events, ['show']);
});
