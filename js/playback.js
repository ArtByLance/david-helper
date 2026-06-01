const DEFAULT_VOICEMONKEY_ENDPOINT = "https://api-v2.voicemonkey.io/trigger";
const TOKEN_PLACEHOLDER = "TOKEN_NOT_SET";

/**
 * Build the VoiceMonkey URL without firing it. This keeps command routing out
 * of the shelf components and lets OFFSITE mode show the exact URL for testing.
 *
 * @param {string} command
 * @param {{ endpoint?: string, token?: string }} config
 * @returns {string | null}
 */
export function buildVoiceMonkeyUrl(command, config = window.KIOSK?.vm) {
  if (!config?.endpoint || !config?.token || !command) return null;

  const url = new URL(config.endpoint);
  url.searchParams.set("token", config.token);
  url.searchParams.set("device", command);
  return url.toString();
}

/**
 * Fire a URL through a hidden iframe to avoid fetch/CORS issues.
 *
 * @param {string | null} url
 * @returns {boolean}
 */
export function fireUrl(url) {
  if (!url) return false;

  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);

  window.setTimeout(() => {
    try {
      iframe.remove();
    } catch (error) {
      console.warn("[VIDEO] could not remove launch iframe", error);
    }
  }, 1500);

  return true;
}

/**
 * Launch a Prime Video item through VoiceMonkey.
 *
 * OFFSITE: log only, do not fire.
 * DEV: log and fire.
 * LIVE: fire only.
 *
 * @param {{ id?: string, title?: string, command?: string, active?: boolean }} item
 * @returns {{ fired: boolean, mode: string, url: string | null, command: string }}
 */
export function launchVideoItem(item) {
  if (!item) {
    console.warn("[VIDEO] missing item");
    return { fired: false, mode: getCommsMode(), url: null, command: "" };
  }

  const command = item.command ?? "";
  if (!command) {
    console.warn("[VIDEO] missing command:", item.title || item.id);
    return { fired: false, mode: getCommsMode(), url: null, command };
  }

  const mode = getCommsMode();
  const url = getConfiguredVoiceMonkeyUrl(command);

  if (!url) {
    console.warn("[VIDEO] could not build VoiceMonkey URL:", item);
    return { fired: false, mode, url: null, command };
  }

  if (mode !== "LIVE") {
    console.log("[VIDEO]", item.title, command, url);
  }

  if (mode === "OFFSITE") {
    return { fired: false, mode, url, command };
  }

  if (hasPlaceholderToken()) {
    console.warn("[VIDEO] VoiceMonkey token is not configured; not firing.");
    return { fired: false, mode, url, command };
  }

  return {
    fired: fireUrl(url),
    mode,
    url,
    command,
  };
}

function hasPlaceholderToken() {
  const token =
    window.KIOSK?.vm?.token ??
    window.DAVIDS_THINGS_VOICEMONKEY?.token ??
    "";
  return token === TOKEN_PLACEHOLDER;
}

function getCommsMode() {
  return String(window.KIOSK?.commsMode || "OFFSITE").toUpperCase();
}

function getConfiguredVoiceMonkeyUrl(command) {
  const kioskConfig = window.KIOSK?.vm ?? {};
  const legacyConfig = window.DAVIDS_THINGS_VOICEMONKEY ?? {};
  const commandUrl =
    kioskConfig.commands?.[command] ??
    legacyConfig.commands?.[command] ??
    legacyConfig[command];
  if (commandUrl) return commandUrl;

  return buildVoiceMonkeyUrl(command, {
    endpoint:
      kioskConfig.endpoint ??
      legacyConfig.endpoint ??
      DEFAULT_VOICEMONKEY_ENDPOINT,
    token:
      kioskConfig.token ??
      legacyConfig.token ??
      legacyConfig.accessToken ??
      legacyConfig.secretToken,
  });
}
