import { encodeMessage } from './indicator-line-protocol.ts';

type Write = (
  bytes: Uint8Array,
  completed: (success: boolean, bytesWritten: number) => void,
) => void;

export class IndicatorCommandQueue {
  readonly #queue: Uint8Array[] = [];
  #writing = false;
  readonly #write: Write;
  readonly #onFailure: () => void;

  constructor(write: Write, onFailure: () => void) {
    this.#write = write;
    this.#onFailure = onFailure;
  }

  send(message: string): void {
    if (!message) throw new Error('Cannot send an empty message');
    this.#queue.push(encodeMessage(message));
    this.#drain();
  }

  #drain(): void {
    if (this.#writing) return;
    const bytes = this.#queue.shift();
    if (!bytes) return;
    this.#writing = true;
    try {
      this.#write(bytes, (success, bytesWritten) => {
        if (!success || bytesWritten !== bytes.length) {
          this.#fail();
          return;
        }
        this.#writing = false;
        this.#drain();
      });
    } catch {
      this.#fail();
    }
  }

  #fail(): void {
    this.#queue.length = 0;
    this.#writing = false;
    this.#onFailure();
  }
}
