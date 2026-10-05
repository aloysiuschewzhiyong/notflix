"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
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
  Settings,
  Server,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubtitleTrack } from "@/lib/stream-utils";

type PlayerState = "idle" | "fetching" | "buffering" | "playing" | "error";
type MenuName = "captions" | "quality" | "source";

export interface StreamResult {
  url: string;
  referer?: string;
  source?: string;
  subtitles?: SubtitleTrack[];
}

interface HlsPlayerProps {
  label: string;
  fetchStream: (onStatus: (message: string) => void, source?: string) => Promise<StreamResult>;
  /** Sources the user may pick from. Omit to hide source switching. */
  sources?: readonly string[];
}

interface QualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

type WebkitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
};

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};

type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function levelLabel(level: QualityLevel): string {
  if (level.height > 0) return `${level.height}p`;
  return `${(level.bitrate / 1_000_000).toFixed(1)} Mbps`;
}

function getFullscreenElement(): Element | null {
  const doc = document as WebkitDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

function MenuItem({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-4 whitespace-nowrap px-3 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent",
        active && "text-white"
      )}
    >
      <span>{children}</span>
      {active && <Check className="h-4 w-4 text-red-500" />}
    </button>
  );
}

export function HlsPlayer({ label, fetchStream, sources }: HlsPlayerProps) {
  const [state, setState] = useState<PlayerState>("idle");
  const [streamUrl, setStreamUrl] = useState("");
  const [subtitles, setSubtitles] = useState<SubtitleTrack[]>([]);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Starting up…");
  const [source, setSource] = useState("");
  const [selectedSource, setSelectedSource] = useState("auto");

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [openMenu, setOpenMenu] = useState<MenuName | null>(null);

  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [failedTracks, setFailedTracks] = useState<number[]>([]);

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState(-1);
  const [playingHeight, setPlayingHeight] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trackRefs = useRef<(HTMLTrackElement | null)[]>([]);
  const activeSubtitleRef = useRef(-1);
  const resumeAtRef = useRef(0);
  const lastPointerType = useRef("mouse");

  const proxied = useCallback((url: string, referer?: string) => {
    const params = new URLSearchParams({ url });
    if (referer) params.set("ref", referer);
    return `/api/stream/proxy?${params.toString()}`;
  }, []);

  const start = useCallback(
    async (opts?: { source?: string; resumeAt?: number }) => {
      const requested = opts?.source ?? selectedSource;
      setSelectedSource(requested);
      resumeAtRef.current = opts?.resumeAt ?? 0;

      setState("fetching");
      setError("");
      setStreamUrl("");
      setSubtitles([]);
      setStatusMessage("Starting up…");
      setSource("");
      setLevels([]);
      setSelectedLevel(-1);
      setPlayingHeight(0);
      setActiveSubtitle(-1);
      activeSubtitleRef.current = -1;
      setFailedTracks([]);
      setOpenMenu(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setBuffered(0);

      try {
        const {
          url,
          referer,
          source: sourceName,
          subtitles: tracks,
        } = await fetchStream(
          (message) => setStatusMessage(message),
          requested === "auto" ? undefined : requested
        );
        // Subtitle files live on the same CDNs and need the same Referer treatment.
        setSubtitles((tracks || []).map((t) => ({ ...t, url: proxied(t.url, referer) })));
        setSource(sourceName || "");
        setStreamUrl(proxied(url, referer));
        setState("buffering");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch stream");
        setState("error");
      }
    },
    [fetchStream, proxied, selectedSource]
  );

  // Attach hls.js / native HLS playback
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;
    const video = videoRef.current;
    const resumeAt = resumeAtRef.current;

    const handlePlaying = () => setState("playing");
    const handleWaiting = () => setState((s) => (s === "playing" ? "buffering" : s));
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("waiting", handleWaiting);

    // iOS keeps its native HLS pipeline (most reliable there, and its native
    // fullscreen needs it); everywhere else hls.js gives us quality control.
    const isIOS =
      /iP(hone|ad|od)/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const useNative = isIOS && !!video.canPlayType("application/vnd.apple.mpegurl");

    if (!useNative && Hls.isSupported()) {
      const hls = new Hls({ startPosition: resumeAt > 0 ? resumeAt : -1 });
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        // One entry per resolution, keeping the highest-bitrate variant of each.
        const byHeight = new Map<number, QualityLevel>();
        data.levels.forEach((l, index) => {
          const existing = byHeight.get(l.height || 0);
          if (!existing || l.bitrate > existing.bitrate) {
            byHeight.set(l.height || 0, { index, height: l.height || 0, bitrate: l.bitrate });
          }
        });
        setLevels([...byHeight.values()].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate));
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setPlayingHeight(hls.levels[data.level]?.height || 0);
      });

      let networkRetries = 0;
      let mediaRecovered = false;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 2) {
          networkRetries++;
          hls.startLoad();
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
          mediaRecovered = true;
          hls.recoverMediaError();
          return;
        }
        setError(`Playback error: ${data.details.replace(/_/g, " ").toLowerCase()}`);
        setState("error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Native HLS (Safari/iOS): no quality control available, the OS picks.
      video.src = streamUrl;
      if (resumeAt > 0) {
        video.addEventListener("loadedmetadata", () => (video.currentTime = resumeAt), { once: true });
      }
    } else {
      setError("HLS playback is not supported in this browser");
      setState("error");
    }

    return () => {
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("waiting", handleWaiting);
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
    video.addEventListener("durationchange", onLoadedMetadata);
    video.addEventListener("progress", onProgress);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("durationchange", onLoadedMetadata);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("volumechange", onVolumeChange);
    };
  }, [streamUrl]);

  // Fullscreen state. Standard + webkit-prefixed document events cover desktop,
  // Android and iPadOS; the video-level webkit events cover iPhone Safari, which
  // only supports fullscreen on the <video> element itself.
  useEffect(() => {
    const video = videoRef.current as WebkitVideo | null;
    const sync = () =>
      setIsFullscreen(
        getFullscreenElement() === containerRef.current || !!video?.webkitDisplayingFullscreen
      );

    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    video?.addEventListener("webkitbeginfullscreen", sync);
    video?.addEventListener("webkitendfullscreen", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
      video?.removeEventListener("webkitbeginfullscreen", sync);
      video?.removeEventListener("webkitendfullscreen", sync);
    };
  }, []);

  // On phones, landscape is what you want in fullscreen; release it on exit.
  useEffect(() => {
    const orientation = screen.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    if (!orientation) return;
    if (isFullscreen) orientation.lock?.("landscape").catch(() => {});
    else orientation.unlock?.();
  }, [isFullscreen]);

  // Auto-hide the control bar a couple seconds after the last interaction.
  // Never hides while paused or while a menu is open.
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    if (!isPlaying || openMenu) return;
    hideTimer.current = setTimeout(() => setShowControls(false), 2800);
  }, [isPlaying, openMenu]);

  useEffect(() => {
    if (!isPlaying || openMenu) {
      clearTimeout(hideTimer.current);
      setShowControls(true);
    } else {
      scheduleHide();
    }
    return () => clearTimeout(hideTimer.current);
  }, [isPlaying, openMenu, scheduleHide]);

  const handleActivity = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seek = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value;
    setCurrentTime(value);
  };

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const changeVolume = (value: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = value;
    video.muted = value === 0;
  };

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current as WebkitElement | null;
    const video = videoRef.current as WebkitVideo | null;
    if (!el || !video) return;
    const doc = document as WebkitDocument;

    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();
      return;
    }
    if (getFullscreenElement()) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      return;
    }

    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (request) {
      // If the container can't go fullscreen (permission policy, odd WebViews),
      // fall back to the video element's own fullscreen where it exists.
      Promise.resolve(request.call(el)).catch(() => video.webkitEnterFullscreen?.());
    } else {
      video.webkitEnterFullscreen?.();
    }
  }, []);

  const selectSubtitle = (index: number) => {
    trackRefs.current.forEach((el, i) => {
      if (el?.track) el.track.mode = i === index ? "showing" : "disabled";
    });
    activeSubtitleRef.current = index;
    setActiveSubtitle(index);
    setOpenMenu(null);
  };

  // New <track> elements default to disabled, but make it explicit so a stale
  // mode can never leave captions showing with the menu saying "Off".
  useEffect(() => {
    trackRefs.current.forEach((el) => {
      if (el?.track) el.track.mode = "disabled";
    });
  }, [subtitles]);

  const selectLevel = (level: QualityLevel | null) => {
    const hls = hlsRef.current;
    if (hls) hls.currentLevel = level ? level.index : -1;
    setSelectedLevel(level ? level.index : -1);
    setOpenMenu(null);
  };

  const switchSource = (name: string) => {
    setOpenMenu(null);
    if (name === selectedSource && state !== "error") return;
    start({ source: name, resumeAt: videoRef.current?.currentTime || 0 });
  };

  // Keyboard shortcuts while this player is on screen and actually playable
  useEffect(() => {
    if (state !== "playing" && state !== "buffering") return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const video = videoRef.current;
      if (!video) return;

      if (e.key === "Escape") {
        setOpenMenu(null);
      } else if (e.code === "Space" || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (e.key === "ArrowRight") {
        video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
      } else if (e.key === "m") {
        toggleMute();
      } else if (e.key === "f") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state, togglePlay, toggleMute, toggleFullscreen]);

  const toggleMenu = (name: MenuName) => setOpenMenu((current) => (current === name ? null : name));

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const isActive = state === "playing" || state === "buffering";
  const controlsVisible = showControls || !isPlaying;
  const hasSources = !!sources && sources.length > 0;

  const barButton =
    "flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10";

  return (
    <div
      ref={containerRef}
      onMouseMove={isActive ? handleActivity : undefined}
      onClick={isActive ? handleActivity : undefined}
      className={cn(
        "group relative overflow-hidden bg-neutral-950 shadow-2xl ring-1 ring-white/10",
        isFullscreen ? "h-full w-full rounded-none ring-0" : "aspect-video w-full rounded-xl",
        isActive && isPlaying && !controlsVisible && "cursor-none"
      )}
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
              onClick={() => start()}
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
                className="px-4 text-center text-sm text-white/60"
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
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto bg-black px-6 py-4 text-center"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/30">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-medium text-white">Couldn&apos;t load this stream</p>
              <p className="mt-1 max-w-sm text-sm text-white/50">{error}</p>
            </div>
            <Button onClick={() => start()} size="sm" variant="secondary" className="gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
            {hasSources && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-xs text-white/40">Try:</span>
                {["auto", ...sources!].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => start({ source: name })}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs capitalize ring-1 ring-white/15 transition-colors hover:bg-white/10",
                      selectedSource === name ? "text-white" : "text-white/60"
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video element stays mounted once a stream URL exists so hls.js can attach to it */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onPointerDown={(e) => {
          lastPointerType.current = e.pointerType;
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (lastPointerType.current === "touch") {
            // Touch: tapping toggles the controls (play lives on the play button),
            // otherwise a stray tap would pause and the bar would never show.
            if (showControls && isPlaying) setShowControls(false);
            else handleActivity();
          } else {
            togglePlay();
            handleActivity();
          }
        }}
        onDoubleClick={(e) => {
          if (lastPointerType.current !== "touch") {
            e.preventDefault();
            toggleFullscreen();
          }
        }}
        className="h-full w-full bg-black object-contain"
        style={{ display: isActive ? "block" : "none" }}
      >
        {subtitles.map((track, i) => (
          <track
            key={`${track.lang || track.label}-${i}`}
            ref={(el) => {
              trackRefs.current[i] = el;
            }}
            kind="subtitles"
            src={track.url}
            srcLang={track.lang || "en"}
            label={track.label}
            onError={() => {
              setFailedTracks((prev) => (prev.includes(i) ? prev : [...prev, i]));
              if (activeSubtitleRef.current === i) {
                activeSubtitleRef.current = -1;
                setActiveSubtitle(-1);
              }
            }}
          />
        ))}
      </video>

      {state === "buffering" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}

      {isActive && source && (
        <div
          className={cn(
            "pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium capitalize text-white/80 backdrop-blur-sm transition-opacity duration-200",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
        >
          Source: {source}
        </div>
      )}

      {/* Click-away layer + popover menus (kept at container level so they can
          use the whole player height and never get clipped by the control bar) */}
      {isActive && openMenu && (
        <>
          <div
            className="absolute inset-0 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenu(null);
            }}
          />
          <AnimatePresence>
            <motion.div
              key={openMenu}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-16 right-3 z-20 max-h-[calc(100%-5rem)] min-w-44 overflow-y-auto rounded-lg bg-black/90 py-1 shadow-xl ring-1 ring-white/15 backdrop-blur-sm"
            >
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                {openMenu === "captions" ? "Subtitles" : openMenu === "quality" ? "Quality" : "Source"}
              </p>

              {openMenu === "captions" && (
                <>
                  <MenuItem active={activeSubtitle === -1} onClick={() => selectSubtitle(-1)}>
                    Off
                  </MenuItem>
                  {subtitles.map((track, i) => (
                    <MenuItem
                      key={`${track.lang || track.label}-${i}`}
                      active={activeSubtitle === i}
                      disabled={failedTracks.includes(i)}
                      onClick={() => selectSubtitle(i)}
                    >
                      {track.label}
                      {failedTracks.includes(i) && " (unavailable)"}
                    </MenuItem>
                  ))}
                </>
              )}

              {openMenu === "quality" && (
                <>
                  <MenuItem active={selectedLevel === -1} onClick={() => selectLevel(null)}>
                    Auto{selectedLevel === -1 && playingHeight > 0 ? ` (${playingHeight}p)` : ""}
                  </MenuItem>
                  {levels.map((level) => (
                    <MenuItem
                      key={level.index}
                      active={selectedLevel === level.index}
                      onClick={() => selectLevel(level)}
                    >
                      {levelLabel(level)}
                    </MenuItem>
                  ))}
                </>
              )}

              {openMenu === "source" && hasSources && (
                <>
                  <MenuItem active={selectedSource === "auto"} onClick={() => switchSource("auto")}>
                    Auto{selectedSource === "auto" && source ? ` (${source})` : ""}
                  </MenuItem>
                  {sources!.map((name) => (
                    <MenuItem
                      key={name}
                      active={selectedSource === name}
                      onClick={() => switchSource(name)}
                    >
                      <span className="capitalize">{name}</span>
                    </MenuItem>
                  ))}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* Custom control bar */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-8 transition-opacity duration-200 sm:px-4",
            controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
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
              className={barButton}
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
              className={barButton}
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

            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              {subtitles.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu("captions");
                  }}
                  aria-label="Subtitles"
                  aria-expanded={openMenu === "captions"}
                  className={cn(barButton, activeSubtitle >= 0 && "text-red-500")}
                >
                  <Captions className="h-5 w-5" />
                </button>
              )}

              {levels.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu("quality");
                  }}
                  aria-label="Quality"
                  aria-expanded={openMenu === "quality"}
                  className={barButton}
                >
                  <Settings className="h-5 w-5" />
                </button>
              )}

              {hasSources && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMenu("source");
                  }}
                  aria-label="Source"
                  aria-expanded={openMenu === "source"}
                  className={barButton}
                >
                  <Server className="h-5 w-5" />
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className={barButton}
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
