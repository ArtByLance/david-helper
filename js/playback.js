export const PlaybackService = {
  /**
   * @param {{ title: string, playbackProvider?: string, playbackAction?: string }} item
   * @returns {Promise<void>}
   */
  async play(item) {
    const provider = item.playbackProvider ?? "voicemonkey";
    if (provider === "voicemonkey") {
      return VoiceMonkeyAdapter.play(item);
    }
    throw new Error(`Unknown playback provider: ${provider}`);
  },
};

const VoiceMonkeyAdapter = {
  /**
   * VoiceMonkey URLs can be supplied later without changing shelf UI code:
   *   window.DAVIDS_THINGS_VOICEMONKEY = {
   *     play_frasier: "https://api.voicemonkey.io/trigger?...",
   *   };
   *
   * @param {{ title: string, playbackAction?: string }} item
   * @returns {Promise<void>}
   */
  async play(item) {
    const action = item.playbackAction ?? "";
    const url = window.DAVIDS_THINGS_VOICEMONKEY?.[action];

    if (!url) {
      console.info(`[VoiceMonkey placeholder] ${action || item.title}`);
      return;
    }

    const response = await fetch(url, { method: "GET", mode: "no-cors" });
    if (response.type !== "opaque" && !response.ok) {
      throw new Error(`VoiceMonkey playback failed for ${item.title}`);
    }
  },
};
