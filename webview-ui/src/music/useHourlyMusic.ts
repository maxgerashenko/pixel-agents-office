import { useCallback, useEffect, useRef, useState } from 'react';

import {
  MUSIC_DRIFT_TOLERANCE_SEC,
  MUSIC_ON_STORAGE_KEY,
  MUSIC_RESUME_CHECK_MS,
  MUSIC_RESYNC_CHECK_MS,
  MUSIC_SEEK_LEAD_SEC,
  MUSIC_URL_CHANGED_EVENT,
  MUSIC_URL_STORAGE_KEY,
  YOUTUBE_IFRAME_API_SRC,
} from '../constants.js';
import { needsResync, parseYouTubeId, syncedPosition } from './musicSync.js';

/** Just the slice of the YouTube IFrame API this uses. */
interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YtApi {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YtPlayer;
}
const YT_ENDED = 0;
const YT_PLAYING = 1;

let apiPromise: Promise<YtApi> | null = null;
function loadYouTubeApi(): Promise<YtApi> {
  const w = window as unknown as {
    YT?: YtApi & { loaded?: number };
    onYouTubeIframeAPIReady?: () => void;
  };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  apiPromise ??= new Promise<YtApi>((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT as YtApi);
    };
    const s = document.createElement('script');
    s.src = YOUTUBE_IFRAME_API_SRC;
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function readMusicUrl(): string {
  try {
    return localStorage.getItem(MUSIC_URL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

/** True once the user has turned the music off themselves; it then stays off on load. */
function readMusicMuted(): boolean {
  try {
    return localStorage.getItem(MUSIC_ON_STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}
function writeMusicMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUSIC_ON_STORAGE_KEY, muted ? 'off' : 'on');
  } catch {
    /* storage unavailable */
  }
}

/**
 * Plays the configured YouTube track in step with the real hourly clock.
 * `host` is the element the (hidden) player mounts into. Sound needs one tap
 * on iOS. On load it tries to start by itself (works where autoplay is allowed);
 * if the browser refuses, the first tap anywhere on the page starts it instead.
 * A user who turned the music off stays opted out across reloads.
 */
export function useHourlyMusic(host: React.RefObject<HTMLDivElement | null>) {
  const [url, setUrl] = useState(readMusicUrl);
  const [on, setOn] = useState(false);
  const player = useRef<YtPlayer | null>(null);
  const ready = useRef(false);
  const wantOn = useRef(false);
  const videoId = parseYouTubeId(url);

  useEffect(() => {
    const onChange = () => setUrl(readMusicUrl());
    window.addEventListener(MUSIC_URL_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(MUSIC_URL_CHANGED_EVENT, onChange);
  }, []);

  const sync = useCallback(() => {
    const p = player.current;
    if (!p || !ready.current) return;
    const dur = p.getDuration();
    const target = syncedPosition(new Date(), dur);
    p.seekTo(target + MUSIC_SEEK_LEAD_SEC, true);
  }, []);

  // (Re)build the player when the track changes; keep it ready for the first tap.
  useEffect(() => {
    wantOn.current = false;
    setOn(false);
    ready.current = false;
    if (!videoId || !host.current) return;
    let cancelled = false;
    const mount = document.createElement('div');
    host.current.appendChild(mount);
    void loadYouTubeApi().then((YT) => {
      if (cancelled) return;
      player.current = new YT.Player(mount, {
        videoId,
        playerVars: { playsinline: 1, controls: 0, disablekb: 1, rel: 0 },
        events: {
          onReady: () => {
            ready.current = true;
            if (readMusicMuted()) return;
            // Try to autoplay; if the browser blocks it, the first-tap listener takes over.
            wantOn.current = true;
            player.current?.playVideo();
            sync();
            setOn(true);
            window.setTimeout(() => {
              if (cancelled || !wantOn.current) return;
              if (player.current?.getPlayerState() !== YT_PLAYING) {
                wantOn.current = false;
                setOn(false);
              }
            }, MUSIC_RESUME_CHECK_MS);
          },
          onStateChange: (e) => {
            if (e.data === YT_PLAYING && wantOn.current) {
              const p = player.current!;
              const dur = p.getDuration();
              if (
                needsResync(
                  p.getCurrentTime(),
                  syncedPosition(new Date(), dur),
                  dur,
                  MUSIC_DRIFT_TOLERANCE_SEC,
                )
              ) {
                sync();
              }
            } else if (e.data === YT_ENDED && wantOn.current) {
              sync();
              player.current?.playVideo();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      player.current?.destroy();
      player.current = null;
      mount.remove();
    };
  }, [videoId, host, sync]);

  // Periodic re-sync against the real clock while playing.
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const p = player.current;
      if (!p || !ready.current || p.getPlayerState() !== YT_PLAYING) return;
      const dur = p.getDuration();
      if (
        needsResync(
          p.getCurrentTime(),
          syncedPosition(new Date(), dur),
          dur,
          MUSIC_DRIFT_TOLERANCE_SEC,
        )
      ) {
        sync();
      }
    }, MUSIC_RESYNC_CHECK_MS);
    return () => clearInterval(id);
  }, [on, sync]);

  // Coming back to the app (e.g. after "Open on GitHub" sent it to the background) pauses the
  // iframe on iOS. Try to resume; if iOS refuses without a tap, show the music as off so one tap
  // on the music button restarts it.
  useEffect(() => {
    let check: number | undefined;
    const resume = () => {
      if (document.visibilityState === 'hidden' || !wantOn.current) return;
      const p = player.current;
      if (!p || !ready.current || p.getPlayerState() === YT_PLAYING) return;
      p.playVideo();
      sync();
      window.clearTimeout(check);
      check = window.setTimeout(() => {
        if (wantOn.current && player.current?.getPlayerState() !== YT_PLAYING) {
          wantOn.current = false;
          setOn(false);
        }
      }, MUSIC_RESUME_CHECK_MS);
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    return () => {
      window.clearTimeout(check);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
    };
  }, [sync]);

  // Autoplay blocked: start on the first tap anywhere (the music button has its own handler).
  useEffect(() => {
    if (!videoId) return;
    const onGesture = (e: Event) => {
      if (wantOn.current || readMusicMuted()) return;
      const p = player.current;
      if (!p || !ready.current) return;
      if ((e.target as Element | null)?.closest?.('[data-testid="music-toggle"]')) return;
      wantOn.current = true;
      p.playVideo();
      sync();
      setOn(true);
    };
    document.addEventListener('pointerup', onGesture, true);
    document.addEventListener('touchend', onGesture, true);
    return () => {
      document.removeEventListener('pointerup', onGesture, true);
      document.removeEventListener('touchend', onGesture, true);
    };
  }, [videoId, sync]);

  /** Must run inside the tap handler so iOS allows sound. */
  const toggle = useCallback(() => {
    const p = player.current;
    if (!p || !ready.current) return;
    if (wantOn.current) {
      wantOn.current = false;
      writeMusicMuted(true);
      p.pauseVideo();
      setOn(false);
    } else {
      wantOn.current = true;
      writeMusicMuted(false);
      p.playVideo();
      sync();
      setOn(true);
    }
  }, [sync]);

  return { configured: videoId !== null, on, toggle };
}
