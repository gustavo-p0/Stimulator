export interface StartupArguments {
  requestMinimized: boolean;
  gtkArgs: string[];
}

export function parseStartupArguments(args: readonly string[]): StartupArguments {
  let requestMinimized = false;
  let pastOptions = false;
  const gtkArgs: string[] = [];

  for (const arg of args) {
    if (arg === '--') pastOptions = true;
    if (!pastOptions && arg === '--minimized') {
      requestMinimized = true;
      continue;
    }
    gtkArgs.push(arg);
  }

  return { requestMinimized, gtkArgs };
}
