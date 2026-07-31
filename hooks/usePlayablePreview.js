import { useCallback, useEffect, useRef, useState } from "react";
import { getSongFromDeezer } from "../providers/rest";
import { playPreviewUrl, stopPreview } from "../audio/previewPlayer";

function getUrl(track) {
  return String(
    track?.audioUrl || track?.preview || track?.previewUrl ||
    track?.playbackUrl || track?.item_info?.preview ||
    track?.item_info?.previewUrl || track?.item_info?.playbackUrl || ""
  ).trim();
}

async function readResponse(response) {
  if (!response) throw new Error("The server returned no response.");
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error(text || "Invalid server response."); }
  if (!response.ok) throw new Error(data?.error || `Preview request failed (${response.status}).`);
  return data?.track || data?.item_info || data;
}

export function usePlayablePreview(track, { loop = false, autoPlay = false } = {}) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; stopPreview(); }, []);

  const resolveFreshUrl = useCallback(async (forceRefresh) => {
    const id = track?.id || track?.listenableId || track?.listenable_id || track?.item_info?.id;
    if (!id) throw new Error("This song does not have a track ID.");
    const response = await getSongFromDeezer(String(id), {
      refresh: forceRefresh,
      forceRefresh,
    });
    const data = await readResponse(response);
    const url = getUrl(data);
    if (!url) throw new Error("No licensed preview is available for this song.");
    return url;
  }, [track]);

  const play = useCallback(async ({ userInitiated = true } = {}) => {
    setLoading(true);
    setError("");
    try {
      let url = getUrl(track);
      if (!url) url = await resolveFreshUrl(false);
      try {
        await playPreviewUrl(url, { loop });
      } catch (firstError) {
        // Existing Deezer preview URLs may expire. Force one fresh lookup and retry.
        const freshUrl = await resolveFreshUrl(true);
        await playPreviewUrl(freshUrl, { loop });
      }
      if (mounted.current) setPlaying(true);
      return true;
    } catch (playError) {
      if (mounted.current) {
        setPlaying(false);
        setError(playError?.message || "Unable to play this preview.");
      }
      return false;
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [loop, resolveFreshUrl, track]);

  const stop = useCallback(async () => {
    await stopPreview();
    if (mounted.current) setPlaying(false);
  }, []);

  const toggle = useCallback(async () => {
    if (playing) return stop();
    return play({ userInitiated: true });
  }, [play, playing, stop]);

  useEffect(() => {
    stopPreview();
    setPlaying(false);
    setError("");
    if (autoPlay && track) play({ userInitiated: false });
    return () => { stopPreview(); };
  }, [autoPlay, play, track?.id, track?.listenableId, track?.listenable_id]);

  return { playing, loading, error, play, stop, toggle };
}
