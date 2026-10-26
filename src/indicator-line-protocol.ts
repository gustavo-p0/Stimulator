/** Newline-delimited IPC protocol for the Stimulator AppIndicator subprocess. */
export class LineProtocol {
  #decoder = new TextDecoder();
  #pending = "";

  push(chunk: Uint8Array): string[] {
    this.#pending += this.#decoder.decode(chunk, { stream: true });
    const messages: string[] = [];
    let delimiter: number;
    while ((delimiter = this.#pending.indexOf("\n")) >= 0) {
      const message = this.#pending.slice(0, delimiter).trim();
      this.#pending = this.#pending.slice(delimiter + 1);
      if (message) messages.push(message);
    }
    return messages;
  }
}

const encoder = new TextEncoder();
export function encodeMessage(message: string): Uint8Array {
  if (message.includes("\n") || message.includes("\r")) {
    throw new Error("IPC message must not contain a newline");
  }
  return encoder.encode(`${message}\n`);
}
