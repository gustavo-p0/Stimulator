export type TrayAvailability = 'pending' | 'ready' | 'unavailable';
export type StartupState = 'uninitialized' | 'waiting' | 'hidden' | 'visible' | 'disposed';

export interface StartupPrerequisites {
  startMinimized: boolean;
  backgroundEnabled: boolean;
  suspensionInhibited: boolean;
  tray: TrayAvailability;
}

export interface StartupPorts {
  prerequisites(): StartupPrerequisites;
  showWindow(): void;
  hideWindow(): void;
  scheduleFallback(onTimeout: () => void): () => void;
}

export type BackgroundCapability =
  | 'background-required'
  | 'suspension-required'
  | 'tray-connecting'
  | 'tray-unavailable'
  | 'ready';

export function getBackgroundCapability(prerequisites: Omit<StartupPrerequisites, 'startMinimized'>): BackgroundCapability {
  if (!prerequisites.backgroundEnabled) return 'background-required';
  if (!prerequisites.suspensionInhibited) return 'suspension-required';
  if (prerequisites.tray === 'pending') return 'tray-connecting';
  if (prerequisites.tray === 'unavailable') return 'tray-unavailable';
  return 'ready';
}

export type Disposition = 'show' | 'wait' | 'hide';

export function getStartupDisposition(requested: boolean, prerequisites: StartupPrerequisites): Disposition {
  if (!requested || !prerequisites.startMinimized) return 'show';
  const capability = getBackgroundCapability(prerequisites);
  if (capability === 'ready') return 'hide';
  return capability === 'tray-connecting' ? 'wait' : 'show';
}

export class StartupCoordinator {
  #state: StartupState = 'uninitialized';
  #cancelFallback?: () => void;
  readonly #ports: StartupPorts;

  constructor(ports: StartupPorts) {
    this.#ports = ports;
  }

  get state(): StartupState {
    return this.#state;
  }

  activate(requestMinimized: boolean): void {
    if (this.#state === 'disposed') return;
    if (this.#state !== 'uninitialized') {
      this.#show();
      return;
    }
    this.#transition(getStartupDisposition(requestMinimized, this.#ports.prerequisites()));
  }

  onPrerequisitesChanged(): void {
    if (this.#state === 'disposed') return;
    if (this.#state === 'waiting') {
      const disposition = getStartupDisposition(true, this.#ports.prerequisites());
      if (disposition !== 'wait') this.#transition(disposition);
    } else if (this.#state === 'hidden') {
      if (getStartupDisposition(true, this.#ports.prerequisites()) !== 'hide') this.#show();
    }
  }

  dispose(): void {
    if (this.#state === 'disposed') return;
    this.#cancel();
    this.#state = 'disposed';
  }

  #transition(disposition: Disposition): void {
    if (disposition === 'show') {
      this.#show();
      return;
    }
    if (disposition === 'hide') {
      this.#cancel();
      this.#state = 'hidden';
      this.#ports.hideWindow();
      return;
    }
    this.#state = 'waiting';
    this.#cancelFallback = this.#ports.scheduleFallback(() => {
      if (this.#state === 'waiting') this.#show();
    });
  }

  #show(): void {
    this.#cancel();
    this.#state = 'visible';
    this.#ports.showWindow();
  }

  #cancel(): void {
    this.#cancelFallback?.();
    this.#cancelFallback = undefined;
  }
}
