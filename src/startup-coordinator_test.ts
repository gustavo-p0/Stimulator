import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StartupCoordinator, type StartupPrerequisites, type StartupPorts } from './startup-coordinator.ts';

type Harness = {
  coordinator: StartupCoordinator;
  prerequisites: StartupPrerequisites;
  shown: () => number;
  hidden: () => number;
  timeout: () => void;
  canceled: () => number;
};

function createHarness(overrides: Partial<StartupPrerequisites> = {}): Harness {
  const prerequisites: StartupPrerequisites = {
    startMinimized: true,
    backgroundEnabled: true,
    suspensionInhibited: true,
    tray: 'ready',
    ...overrides,
  };
  let showCount = 0;
  let hideCount = 0;
  let cancelCount = 0;
  let expire = () => {};
  const ports: StartupPorts = {
    prerequisites: () => ({ ...prerequisites }),
    showWindow: () => { showCount += 1; },
    hideWindow: () => { hideCount += 1; },
    scheduleFallback: (callback) => {
      expire = callback;
      return () => { cancelCount += 1; };
    },
  };
  return {
    coordinator: new StartupCoordinator(ports),
    prerequisites,
    shown: () => showCount,
    hidden: () => hideCount,
    timeout: () => expire(),
    canceled: () => cancelCount,
  };
}

test('explicit autostart with ready tray starts hidden', () => {
  const app = createHarness();
  app.coordinator.activate(true);
  assert.equal(app.hidden(), 1);
  assert.equal(app.shown(), 0);
  assert.equal(app.coordinator.state, 'hidden');
});

test('manual first invocation always shows a window', () => {
  const app = createHarness();
  app.coordinator.activate(false);
  assert.equal(app.hidden(), 0);
  assert.equal(app.shown(), 1);
  assert.equal(app.coordinator.state, 'visible');
});

test('every subsequent activation is manual even if it carries the flag', () => {
  const app = createHarness();
  app.coordinator.activate(true);
  app.coordinator.activate(true);
  assert.equal(app.hidden(), 1);
  assert.equal(app.shown(), 1);
  assert.equal(app.coordinator.state, 'visible');
});

test('while tray is pending do not show or hide before a response', () => {
  const app = createHarness({tray: 'pending'});
  app.coordinator.activate(true);
  assert.equal(app.coordinator.state, 'waiting');
  assert.equal(app.hidden(), 0);
  assert.equal(app.shown(), 0);
  app.prerequisites.tray = 'ready';
  app.coordinator.onPrerequisitesChanged();
  assert.equal(app.hidden(), 1);
  assert.equal(app.canceled(), 1);
});

test('unsupported tray falls back to visible', () => {
  const app = createHarness({tray: 'unavailable'});
  app.coordinator.activate(true);
  assert.equal(app.shown(), 1);
  assert.equal(app.hidden(), 0);
});

test('pending tray times out and a late Ready cannot hide the window', () => {
  const app = createHarness({tray: 'pending'});
  app.coordinator.activate(true);
  app.timeout();
  app.prerequisites.tray = 'ready';
  app.coordinator.onPrerequisitesChanged();
  assert.equal(app.shown(), 1);
  assert.equal(app.hidden(), 0);
});

test('second activation while waiting cancels pending hidden startup', () => {
  const app = createHarness({tray: 'pending'});
  app.coordinator.activate(true);
  app.coordinator.activate(false);
  app.prerequisites.tray = 'ready';
  app.coordinator.onPrerequisitesChanged();
  assert.equal(app.shown(), 1);
  assert.equal(app.hidden(), 0);
  assert.equal(app.canceled(), 1);
});

test('loss of tray after hiding restores window exactly once', () => {
  const app = createHarness();
  app.coordinator.activate(true);
  app.prerequisites.tray = 'unavailable';
  app.coordinator.onPrerequisitesChanged();
  app.coordinator.onPrerequisitesChanged();
  assert.equal(app.shown(), 1);
  assert.equal(app.hidden(), 1);
});

test('suspension or background disabled while hidden restores window', () => {
  for (const key of ['backgroundEnabled', 'suspensionInhibited', 'startMinimized'] as const) {
    const app = createHarness();
    app.coordinator.activate(true);
    app.prerequisites[key] = false;
    app.coordinator.onPrerequisitesChanged();
    assert.equal(app.shown(), 1, key);
    assert.equal(app.coordinator.state, 'visible', key);
  }
});

test('all combinations enforce the cannot-hide-without-all-dependencies invariant', () => {
  const states = ['pending', 'ready', 'unavailable'] as const;
  for (let mask = 0; mask < 16; mask += 1) {
    for (const tray of states) {
      const app = createHarness({
        startMinimized: Boolean(mask & 1),
        backgroundEnabled: Boolean(mask & 2),
        suspensionInhibited: Boolean(mask & 4),
        tray,
      });
      const requested = Boolean(mask & 8);
      app.coordinator.activate(requested);
      const ready = requested && (mask & 7) === 7;
      assert.equal(app.hidden(), ready && tray === 'ready' ? 1 : 0, `${mask}/${tray}`);
      assert.equal(app.coordinator.state === 'waiting', ready && tray === 'pending', `${mask}/${tray}`);
    }
  }
});

test('disposal prevents late events from reopening or hiding', () => {
  const app = createHarness({tray: 'pending'});
  app.coordinator.activate(true);
  app.coordinator.dispose();
  app.timeout();
  app.prerequisites.tray = 'ready';
  app.coordinator.onPrerequisitesChanged();
  assert.equal(app.shown(), 0);
  assert.equal(app.hidden(), 0);
});
