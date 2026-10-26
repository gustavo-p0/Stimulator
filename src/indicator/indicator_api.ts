import {
  type InputStream,
  Subprocess,
  SubprocessFlags,
} from "@sigmasd/gtk/gio";
import type { MainWindow } from "../main.ts";
import { MESSAGES } from "./messages.ts";
import type { TrayAvailability } from "../startup-coordinator.ts";
import { LineProtocol } from "../indicator-line-protocol.ts";
import { IndicatorCommandQueue } from "../indicator-command-queue.ts";

export class Indicator {
  #io_priority = 0;
  #stdin;
  #mainWindow: MainWindow;
  #availability: TrayAvailability = "pending";
  #availabilityListener?: (availability: TrayAvailability) => void;
  #commands: IndicatorCommandQueue;
  #child: Subprocess;
  constructor(mainWindow: MainWindow) {
    this.#mainWindow = mainWindow;
    this.#child = new Subprocess(
      [
        "deno",
        "run",
        "--allow-read",
        "--allow-ffi",
        import.meta.resolve("./indicator_app.ts"),
      ],
      SubprocessFlags.STDIN_PIPE | SubprocessFlags.STDOUT_PIPE,
    );
    this.#stdin = this.#child.getStdinPipe()!;
    this.#commands = new IndicatorCommandQueue(
      (data, done) => this.#stdin.writeAllAsync(data, this.#io_priority, done),
      () => this.#setAvailability("unavailable"),
    );
    this.#monitorStdout(this.#child.getStdoutPipe()!);
  }

  get availability(): TrayAvailability {
    return this.#availability;
  }
  setAvailabilityListener(listener: (availability: TrayAvailability) => void) {
    this.#availabilityListener = listener;
    listener(this.#availability);
  }
  #setAvailability(availability: TrayAvailability) {
    this.#availability = availability;
    this.#availabilityListener?.(availability);
  }
  activate() {
    this.#setAvailability("pending");
    this.#writeToStdin(MESSAGES.Activate);
  }
  deactivate() {
    this.#setAvailability("unavailable");
    this.#writeToStdin(MESSAGES.Deactivate);
  }
  hide() {
    this.#setAvailability("unavailable");
    this.#writeToStdin(MESSAGES.Hide);
  }
  close() {
    this.#writeToStdin(MESSAGES.Close);
  }
  showShowButton() {
    this.#writeToStdin(MESSAGES.showShowButton);
  }
  hideShowButton() {
    this.#writeToStdin(MESSAGES.HideShowButton);
  }

  #writeToStdin(message: string) {
    this.#commands.send(message);
  }

  stop() {
    this.#child.forceExit();
  }

  #monitorStdout(stdoutPipe: InputStream) {
    const lines = new LineProtocol();
    const handleMessage = (message: string) => {
      switch (message) {
        case MESSAGES.Ready:
          this.#setAvailability("ready");
          break;
        case MESSAGES.Unavailable:
          this.#setAvailability("unavailable");
          break;
        case MESSAGES.Show:
          this.#mainWindow.present();
          break;
        case MESSAGES.Close:
          this.#mainWindow.quit();
          break;
        default:
          throw new Error(`Incorrect message: '${message}'`);
      }
    };
    const readNext = () => {
      stdoutPipe.readBytesAsync(512, 0, (data) => {
        if (!data || data.length === 0) {
          // The tray process exited: recover any background window.
          this.#setAvailability("unavailable");
          return;
        }
        for (const message of lines.push(data)) handleMessage(message);
        readNext();
      });
    };
    readNext();
  }
}
