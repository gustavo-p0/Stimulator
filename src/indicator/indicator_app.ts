// This is a standalone application for the tray
// It have is own imports
import {
  Indicator,
  IndicatorCategory,
  IndicatorStatus,
} from "@sigmasd/gtk/appindicator";
import * as Gtk from "@sigmasd/gtk/gtk3";
import {
  ioAddWatch,
  IOCondition,
  timeout,
  sourceRemove,
  UnixSignal,
  unixSignalAdd,
} from "@sigmasd/gtk/glib";
import { APP_ID, UI_LABELS } from "../consts.ts";
import { MESSAGES } from "./messages.ts";
import { LineProtocol } from "../indicator-line-protocol.ts";
import { TrayHeartbeat } from "../tray-heartbeat.ts";

// since this app is used with ipc, this is a better name
const sendMsg = console.log;

if (import.meta.main) {
  Gtk.init();

  const indicator = new Indicator(
    `${APP_ID}-tray`,
    `${APP_ID}-tray`,
    IndicatorCategory.APPLICATION_STATUS,
  );
  indicator.setTitle(UI_LABELS.Stimulator);

  const menu = new Gtk.Menu();

  const showApp = new Gtk.MenuItem(UI_LABELS.Show);
  const closeApp = new Gtk.MenuItem(UI_LABELS.Close);
  showApp.connect(
    "activate",
    () => {
      sendMsg(MESSAGES.Show);
      showApp.hide();
    },
  );
  closeApp.connect(
    "activate",
    () => {
      sendMsg(MESSAGES.Close);
      Gtk.mainQuit();
    },
  );

  let readinessCheck: number | undefined;
  const cancelReadinessCheck = () => {
    if (readinessCheck !== undefined) {
      sourceRemove(readinessCheck);
      readinessCheck = undefined;
    }
  };
  const awaitTrayConnection = () => {
    cancelReadinessCheck();
    const heartbeat = new TrayHeartbeat(20);
    const check = () => {
      const pulse = heartbeat.observe(Boolean(indicator.props.connected));
      if (pulse.message) sendMsg(pulse.message);
      if (!pulse.continuePolling) {
        readinessCheck = undefined;
        Gtk.mainQuit();
      }
      return pulse.continuePolling;
    };
    if (check()) readinessCheck = timeout(250, check);
  };
  const lines = new LineProtocol();
  ioAddWatch(
    0, /*stdin*/
    IOCondition.IN,
    () => {
      const buf = new Uint8Array(512);
      const n = Deno.stdin.readSync(buf);
      if (n === null || n === 0) {
        cancelReadinessCheck();
        Gtk.mainQuit();
        return false;
      }
      for (const message of lines.push(buf.subarray(0, n))) {
        switch (message) {
          case MESSAGES.Activate:
            indicator.setStatus(IndicatorStatus.ACTIVE);
            awaitTrayConnection();
            break;
          case MESSAGES.Deactivate:
            cancelReadinessCheck();
            indicator.setStatus(IndicatorStatus.PASSIVE);
            break;
          case MESSAGES.Hide:
            cancelReadinessCheck();
            indicator.setStatus(IndicatorStatus.PASSIVE);
            break;
          case MESSAGES.Close:
            cancelReadinessCheck();
            Gtk.mainQuit();
            break;
          case MESSAGES.showShowButton:
            showApp.show();
            break;
          case MESSAGES.HideShowButton:
            showApp.hide();
            break;
          default:
            throw new Error(`Incorrect message: '${message}'`);
        }
      }
      return true;
    },
  );

  // NOTE: the show item is always in the menu but only visible while the app
  // is in the background (removing/re-adding it would drop its last reference)
  menu.prepend(showApp);
  menu.append(closeApp);
  menu.showAll();
  showApp.hide();
  indicator.setMenu(menu);

  unixSignalAdd(UnixSignal.SIGINT, () => {
    Gtk.mainQuit();
    return false;
  });

  Gtk.main();
}
