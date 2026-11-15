/**
 * Hourly music sync: where in the track should playback be right now?
 *
 * One rule covers both a short loop and a track longer than an hour. Elapsed
 * is the seconds since the top of the current hour on the REAL clock (the
 * sky's fast-forward never touches it); a track shorter than an hour loops in
 * step with the clock (elapsed modulo its length), a longer one restarts from
 * 0 at every :00 (position = elapsed).
 */
export function secondsIntoHour(now: Date): number {
  return now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
}

export function syncedPosition(now: Date, trackSeconds: number): number {
  const elapsed = secondsIntoHour(now);
  if (!Number.isFinite(trackSeconds) || trackSeconds <= 0) return elapsed;
  return elapsed % trackSeconds;
}

/** Whether the player has drifted far enough from the clock to be seeked back. */
export function needsResync(
  current: number,
  target: number,
  trackSeconds: number,
  tolerance: number,
): boolean {
  let diff = Math.abs(current - target);
  // near a loop seam the two can be a whole track apart yet nearly in step
  if (Number.isFinite(trackSeconds) && trackSeconds > 0) diff = Math.min(diff, trackSeconds - diff);
  return diff > tolerance;
}

/** The 11-character video id from a YouTube link (watch, youtu.be, shorts, embed, live) or a bare id. */
export function parseYouTubeId(input: string): string | null {
  const text = input.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text.includes('://') ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null;
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    if (!id) {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      id = m ? m[1] : null;
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
