import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { getBackgroundCapability } from './startup-coordinator.ts';

test('one capability function is the source of truth for preference and launch decisions', () => {
  assert.equal(getBackgroundCapability({ backgroundEnabled: false, suspensionInhibited: true, tray: 'ready' }), 'background-required');
  assert.equal(getBackgroundCapability({ backgroundEnabled: true, suspensionInhibited: false, tray: 'ready' }), 'suspension-required');
  assert.equal(getBackgroundCapability({ backgroundEnabled: true, suspensionInhibited: true, tray: 'pending' }), 'tray-connecting');
  assert.equal(getBackgroundCapability({ backgroundEnabled: true, suspensionInhibited: true, tray: 'unavailable' }), 'tray-unavailable');
  assert.equal(getBackgroundCapability({ backgroundEnabled: true, suspensionInhibited: true, tray: 'ready' }), 'ready');
});
