export type TrayMessage = 'Ready' | 'Unavailable';
export type TrayPulse = { continuePolling: boolean; message?: TrayMessage };

export class TrayHeartbeat {
  #attempts = 0;
  #connected = false;
  #finished = false;

  readonly #maxAttempts: number;

  constructor(maxAttempts: number) {
    this.#maxAttempts = maxAttempts;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
      throw new RangeError('maxAttempts must be a positive integer');
    }
  }

  observe(connected: boolean): TrayPulse {
    if (this.#finished) return { continuePolling: false };
    if (connected) {
      if (!this.#connected) {
        this.#connected = true;
        return { continuePolling: true, message: 'Ready' };
      }
      return { continuePolling: true };
    }
    if (this.#connected || ++this.#attempts >= this.#maxAttempts) {
      this.#finished = true;
      return { continuePolling: false, message: 'Unavailable' };
    }
    return { continuePolling: true };
  }
}
