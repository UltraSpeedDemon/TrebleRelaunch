import { Platform } from "react-native";
import { Audio } from "expo-av";

import {
  forceRefreshPlayableTrack,
  getCachedPlayableTrack,
} from "../providers/rest";

let nativeSound = null;
let webAudio = null;
let activeUrl = "";
let playbackGeneration = 0;

const playbackRequestsInFlight =
  new Map();

function getTrackId(track) {
  return String(
    track?.id ||
      track?.listenableId ||
      track?.listenable_id ||
      track?.itemId ||
      track?.item_id ||
      ""
  );
}

function getPreviewUrl(track) {
  return String(
    track?.preview ||
      track?.previewUrl ||
      track?.playbackUrl ||
      track?.item_info?.preview ||
      track?.item_info?.previewUrl ||
      track?.item_info?.playbackUrl ||
      ""
  ).trim();
}

async function stopNative() {
  const sound = nativeSound;
  nativeSound = null;

  if (!sound) {
    return;
  }

  try {
    await sound.stopAsync();
  } catch {}

  try {
    await sound.unloadAsync();
  } catch {}
}

function stopWeb() {
  const element = webAudio;
  webAudio = null;

  if (!element) {
    return;
  }

  try {
    element.pause();
    element.removeAttribute("src");
    element.load();
  } catch {}
}

export async function stopPreview() {
  playbackGeneration += 1;
  activeUrl = "";

  if (Platform.OS === "web") {
    stopWeb();
    return;
  }

  await stopNative();
}

async function playWebPreview(
  cleanUrl,
  {
    volume,
    loop,
    muted,
    timeoutMs,
  }
) {
  const element =
    new window.Audio();

  element.preload = "auto";
  element.crossOrigin = "anonymous";
  element.src = cleanUrl;
  element.volume = volume;
  element.loop = loop;
  element.muted = muted;

  webAudio = element;

  await new Promise(
    (resolve, reject) => {
      const timeout =
        window.setTimeout(() => {
          cleanup();

          reject(
            new Error(
              "The preview took too long to load."
            )
          );
        }, timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeout);

        element.removeEventListener(
          "canplay",
          onReady
        );

        element.removeEventListener(
          "error",
          onError
        );

        element.removeEventListener(
          "stalled",
          onStalled
        );
      };

      const onReady = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();

        reject(
          new Error(
            "The preview URL could not be loaded."
          )
        );
      };

      const onStalled = () => {
        /*
         * Do not reject immediately. Some browsers emit stalled while
         * buffering and then continue normally before the timeout.
         */
      };

      element.addEventListener(
        "canplay",
        onReady,
        {
          once: true,
        }
      );

      element.addEventListener(
        "error",
        onError,
        {
          once: true,
        }
      );

      element.addEventListener(
        "stalled",
        onStalled
      );

      element.load();
    }
  );

  await element.play();

  return {
    kind: "web",
    url: cleanUrl,
  };
}

async function playNativePreview(
  cleanUrl,
  {
    volume,
    loop,
    muted,
  }
) {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const result =
    await Audio.Sound.createAsync(
      {
        uri: cleanUrl,
      },
      {
        shouldPlay: true,
        isLooping: loop,
        isMuted: muted,
        volume,
        progressUpdateIntervalMillis: 500,
      }
    );

  nativeSound = result.sound;

  return {
    kind: "native",
    url: cleanUrl,
  };
}

export async function playPreviewUrl(
  url,
  options = {}
) {
  const cleanUrl =
    String(url || "").trim();

  if (!cleanUrl) {
    throw new Error(
      "No playable preview URL was provided."
    );
  }

  const {
    volume = 0.72,
    loop = false,
    muted = false,
    timeoutMs = 12000,
  } = options;

  await stopPreview();

  const generation =
    playbackGeneration;

  activeUrl = cleanUrl;

  try {
    const result =
      Platform.OS === "web"
        ? await playWebPreview(
            cleanUrl,
            {
              volume,
              loop,
              muted,
              timeoutMs,
            }
          )
        : await playNativePreview(
            cleanUrl,
            {
              volume,
              loop,
              muted,
            }
          );

    if (
      generation !==
      playbackGeneration
    ) {
      await stopPreview();

      throw new Error(
        "Playback was superseded by another request."
      );
    }

    return result;
  } catch (error) {
    if (activeUrl === cleanUrl) {
      activeUrl = "";
    }

    if (Platform.OS === "web") {
      stopWeb();
    } else {
      await stopNative();
    }

    throw error;
  }
}

/*
 * Main function to use from song cards/pages.
 *
 * 1. Use the current/cached preview first.
 * 2. If missing, ask the server for a cache-friendly track.
 * 3. Only after a real playback failure, force one Deezer refresh.
 * 4. Retry playback once using the refreshed signed preview URL.
 *
 * Concurrent calls for the same track share one promise.
 */
export async function playTrackPreview(
  track,
  options = {}
) {
  const trackId =
    getTrackId(track);

  if (!trackId) {
    throw new Error(
      "The selected song has no Deezer track ID."
    );
  }

  if (
    playbackRequestsInFlight.has(
      trackId
    )
  ) {
    return await playbackRequestsInFlight.get(
      trackId
    );
  }

  const request =
    (async () => {
      let resolvedTrack =
        track || {};

      let previewUrl =
        getPreviewUrl(resolvedTrack);

      if (!previewUrl) {
        resolvedTrack =
          await getCachedPlayableTrack(
            trackId
          );

        previewUrl =
          getPreviewUrl(
            resolvedTrack
          );
      }

      if (previewUrl) {
        try {
          const playback =
            await playPreviewUrl(
              previewUrl,
              options
            );

          return {
            ...playback,
            track: resolvedTrack,
            refreshed: false,
          };
        } catch (cachedError) {
          console.warn(
            `[Preview] Cached playback failed for ${trackId}; refreshing once.`,
            cachedError?.message ||
              cachedError
          );
        }
      }

      const refreshedTrack =
        await forceRefreshPlayableTrack(
          trackId
        );

      const refreshedUrl =
        getPreviewUrl(
          refreshedTrack
        );

      if (!refreshedUrl) {
        throw new Error(
          "Deezer did not return a playable preview for this song."
        );
      }

      const playback =
        await playPreviewUrl(
          refreshedUrl,
          options
        );

      return {
        ...playback,
        track: refreshedTrack,
        refreshed: true,
      };
    })().finally(() => {
      playbackRequestsInFlight.delete(
        trackId
      );
    });

  playbackRequestsInFlight.set(
    trackId,
    request
  );

  return await request;
}

export async function setPreviewMuted(
  muted
) {
  if (Platform.OS === "web") {
    if (webAudio) {
      webAudio.muted =
        Boolean(muted);
    }

    return;
  }

  if (nativeSound) {
    await nativeSound.setIsMutedAsync(
      Boolean(muted)
    );
  }
}

export async function setPreviewVolume(
  volume
) {
  const safeVolume =
    Math.max(
      0,
      Math.min(
        1,
        Number(volume) || 0
      )
    );

  if (Platform.OS === "web") {
    if (webAudio) {
      webAudio.volume =
        safeVolume;
    }

    return;
  }

  if (nativeSound) {
    await nativeSound.setVolumeAsync(
      safeVolume
    );
  }
}

export function getActivePreviewUrl() {
  return activeUrl;
}
