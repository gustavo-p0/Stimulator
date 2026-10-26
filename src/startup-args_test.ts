import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseStartupArguments } from './startup-args.ts';

test('native autostart flag is consumed rather than passed to GTK', () => {
  assert.deepEqual(parseStartupArguments(['--minimized']), { requestMinimized: true, gtkArgs: [] });
});

test('ordinary invocation always requests a visible window', () => {
  assert.deepEqual(parseStartupArguments([]), { requestMinimized: false, gtkArgs: [] });
});

test('unrelated GTK options are not modified', () => {
  assert.deepEqual(parseStartupArguments(['--gapplication-service', '--minimized', '--display=:0']), {
    requestMinimized: true,
    gtkArgs: ['--gapplication-service', '--display=:0'],
  });
});

test('flag after end-of-options is not interpreted', () => {
  assert.deepEqual(parseStartupArguments(['--', '--minimized']), {
    requestMinimized: false,
    gtkArgs: ['--', '--minimized'],
  });
});
