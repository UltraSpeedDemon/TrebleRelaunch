import { Platform } from "react-native";
import { Audio } from "expo-av";

let nativeSound = null;
let webAudio = null;
let activeUrl = "";

async function stopNative() {
  const sound = nativeSound;
  nativeSound = null;
  if (!sound) return;
  try { await sound.stopAsync(); } catch {}
  try { await sound.unloadAsync(); } catch {}
}

function stopWeb() {
  if (!webAudio) return;
  try {
    webAudio.pause();
    webAudio.removeAttribute("src");
    webAudio.load();
  } catch {}
  webAudio = null;
}

export async function stopPreview() {
  activeUrl = "";
  if (Platform.OS === "web") {
    stopWeb();
    return;
  }
  await stopNative();
}

export async function playPreviewUrl(url, options = {}) {
  const cleanUrl = String(url || "").trim();
  if (!cleanUrl) throw new Error("No playable preview URL was provided.");

  const { volume = 0.72, loop = false, muted = false } = options;
  await stopPreview();
  activeUrl = cleanUrl;

  if (Platform.OS === "web") {
    const element = new window.Audio();
    element.preload = "auto";
    element.crossOrigin = "anonymous";
    element.src = cleanUrl;
    element.volume = volume;
    element.loop = loop;
    element.muted = muted;
    webAudio = element;

    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("The preview took too long to load."));
      }, 12000);
      const cleanup = () => {
        window.clearTimeout(timeout);
        element.removeEventListener("canplay", onReady);
        element.removeEventListener("error", onError);
      };
      const onReady = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("The preview URL could not be loaded.")); };
      element.addEventListener("canplay", onReady, { once: true });
      element.addEventListener("error", onError, { once: true });
      element.load();
    });

    await element.play();
    return { kind: "web", url: cleanUrl };
  }

  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const result = await Audio.Sound.createAsync(
    { uri: cleanUrl },
    { shouldPlay: true, isLooping: loop, isMuted: muted, volume }
  );
  nativeSound = result.sound;
  return { kind: "native", url: cleanUrl };
}

export async function setPreviewMuted(muted) {
  if (Platform.OS === "web") {
    if (webAudio) webAudio.muted = Boolean(muted);
    return;
  }
  if (nativeSound) await nativeSound.setIsMutedAsync(Boolean(muted));
}

export function getActivePreviewUrl() {
  return activeUrl;
}
