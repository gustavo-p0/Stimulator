import { getBackgroundCapability, type BackgroundCapability, type TrayAvailability } from "./startup-coordinator.ts";

export interface PreferenceContext {
  backgroundEnabled: boolean;
  suspensionInhibited: boolean;
  tray: TrayAvailability;
}

export interface PreferenceDisposition {
  visible: boolean;
  enabled: boolean;
  reason: BackgroundCapability;
}

export function getStartMinimizedPreference(context: PreferenceContext): PreferenceDisposition {
  const reason = getBackgroundCapability(context);
  return { visible: reason !== "background-required", enabled: context.backgroundEnabled && context.suspensionInhibited, reason };
}
