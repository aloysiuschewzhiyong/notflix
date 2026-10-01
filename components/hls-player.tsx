"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Pause,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Captions,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubtitleTrack } from "@/lib/stream-utils";

type PlayerState = "idle" | "fetching" | "buffering" | "playing" | "error";

export interface StreamResult {
  url: string;
  referer?: string;
  subtitles?: SubtitleTrack[];
}

interface HlsPlayerProps {
  label: string;
  fetchStream: (onStatus: (message: string) => void) => Promise<StreamResult>;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function HlsPlayer({ label, fetchStream }: HlsPlayerProps) {
  const [state, setState] = useState<PlayerState>("idle");
  const [streamUrl, setStreamUrl] = useState("");
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Starting up…");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const proxied = useCallback((url: string, referer?: string) => {
    const params = new URLSearchParams({ url });
    if (referer) params.set("ref", referer);
    return `/api/stream/proxy?${params.toString()}`;
  }, []);

  const start = useCallback(async () => {
    setState("fetching");
    setError("");
    setStreamUrl("");
    setSubtitles([]);
    setStatusMessage("Starting up…");
    try {
      const { url, referer, subtitles: tracks } = await fetchStream((message) =>
        setStatusMessage(message)
      );
      // Subtitle files live on the same CDNs and need the same Referer treatment.
      setSubtitles((tracks || []).map((t) => ({ ...t, url: proxied(t.url, referer) })));
      setStreamUrl(proxied(url, referer));
      setState("buffering");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stream");
      setState("error");
    }
  }, [fetchStream, proxied]);

  // Attach hls.js / native HLS playback
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;

    const handlePlaying = () => setState("playing");
    video.addEventListener("playing", handlePlaying);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
    } else if (Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError(`Playback error: ${data.details.replace(/_/g, " ").toLowerCase()}`);
          setState("error");
        }
      });
    } else {
      setError("HLS playback is not supported in this browser");
      setState("error");
    }

    return () => {
      video.removeEventListener("playing", handlePlaying);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]);

  // Drive custom control state off the native media element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onVolumeChange = () => {
      setVolume(video.volume);
      setMuted(video.muted);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, [streamUrl]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // Auto-hide the control bar a couple seconds after the last interaction
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls((prev) => (isPlaying ? false : prev));
    }, 2800);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying) scheduleHide();
    else {
      clearTimeout(hideTimer.current);
      setShowControls(true);
    }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying, scheduleHide]);

  // Keyboard shortcuts while this player is on screen and actually playable
  useEffect(() => {
    if (state !== "playing" && state !== "buffering") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const video = videoRef.current;
      if (!video) return;

      if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        video.paused ? video.play() : video.pause();
      } else if (e.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (e.key === "ArrowRight") {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      } else if (e.key === "m") {
        video.muted = !video.muted;
      } else if (e.key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const handleActivity = () => {
    setShowControls(true);
    scheduleHide();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const changeVolume = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  };

  const selectSubtitle = (index: number) => {
    const video = videoRef.current;
    if (video) {
      Array.from(video.textTracks).forEach((t, i) => {
        t.mode = i === index ? "showing" : "disabled";
      });
    }
    setActiveSubtitle(index);
    setSubtitleMenuOpen(false);
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const isActive = state === "playing" || state === "buffering";

  return (
    <div
      ref={containerRef}
      onMouseMove={isActive ? handleActivity : undefined}
      onClick={isActive ? handleActivity : undefined}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-950 shadow-2xl ring-1 ring-white/10"
    >
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-950 to-black"
          >
            <button
              onClick={start}
              className="group/play flex flex-col items-center gap-3 outline-none"
            >
              <motion.span
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 transition-colors group-hover/play:bg-red-600/90 group-hover/play:ring-red-500/50"
              >
                <span className="absolute inset-0 rounded-full bg-white/10 animate-ping opacity-0 group-hover/play:opacity-40" />
                <Play className="h-8 w-8 translate-x-0.5 fill-white text-white" />
              </motion.span>
              <span className="text-sm font-medium text-white/80 transition-colors group-hover/play:text-white">
                Play {label}
              </span>
            </button>
          </motion.div>
        )}

        {state === "fetching" && (
          <motion.div
            key="fetching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black"
          >
            <Loader2 className="h-8 w-8 animate-spin text-white/70" />
            <AnimatePresence mode="wait">
              <motion.p
                key={statusMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="text-sm text-white/60"
              >
                {statusMessage}
              </motion.p>
            </AnimatePresence>
          </motion.div>
        )}

        {state === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-6 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-white">Couldn&apos;t load this stream</p>
              <p className="mt-1 max-w-sm text-sm text-white/50">{error}</p>
            </div>
            <Button onClick={start} size="sm" variant="secondary" className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video element stays mounted once a stream URL exists so hls.js can attach to it */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className="h-full w-full bg-black"
        style={{ display: isActive ? "block" : "none" }}
      >
        {subtitles.map((track, i) => (
          <track
            key={`${track.lang || track.label}-${i}`}
            kind="subtitles"
            src={track.url}
            srcLang={track.lang || "en"}
            label={track.label}
          />
        ))}
      </video>

      {state === "buffering" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {/* Custom control bar */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 sm:px-4",
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Seek bar */}
          <div className="group/seek relative mb-2 flex h-4 cursor-pointer items-center">
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/25 transition-all group-hover/seek:h-1.5">
              <div
                className="absolute inset-y-0 left-0 bg-white/40"
                style={{ width: `${bufferedPct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 bg-red-600"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              aria-label="Seek"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>

          <div className="flex items-center gap-1 text-white sm:gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 translate-x-0.5 fill-white" />
              )}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
              aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              aria-label="Volume"
              className="hidden w-20 accent-red-600 sm:block"
            />

            <span className="ml-1 whitespace-nowrap text-xs font-medium tabular-nums text-white/80 sm:text-sm">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="ml-auto flex items-center gap-1">
              {subtitles.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSubtitleMenuOpen((o) => !o);
                    }}
                    aria-label="Subtitles"
                    aria-expanded={subtitleMenuOpen}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10",
                      activeSubtitle >= 0 && "text-red-500"
                    )}
                  >
                    <Captions className="h-5 w-5" />
                  </button>

                  <AnimatePresence>
                    {subtitleMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-11 right-0 max-h-56 min-w-36 overflow-y-auto rounded-lg bg-black/90 py-1 text-sm shadow-xl ring-1 ring-white/15 backdrop-blur-sm"
                      >
                        <button
                          onClick={() => selectSubtitle(-1)}
                          className={cn(
                            "block w-full px-3 py-1.5 text-left text-white/80 hover:bg-white/10",
                            activeSubtitle === -1 && "text-red-500"
                          )}
                        >
                          Off
                        </button>
                        {subtitles.map((track, i) => (
                          <button
                            key={`${track.lang || track.label}-${i}`}
                            onClick={() => selectSubtitle(i)}
                            className={cn(
                              "block w-full whitespace-nowrap px-3 py-1.5 text-left text-white/80 hover:bg-white/10",
                              activeSubtitle === i && "text-red-500"
                            )}
                          >
                            {track.label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
              >
                {isFullscreen ? (
                  <Minimize className="h-5 w-5" />
                ) : (
                  <Maximize className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
