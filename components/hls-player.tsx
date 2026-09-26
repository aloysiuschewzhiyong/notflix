"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PlayerState = "idle" | "fetching" | "buffering" | "playing" | "error";

export interface StreamResult {
  url: string;
  referer?: string;
}

interface HlsPlayerProps {
  label: string;
  fetchStream: () => Promise<StreamResult>;
}

export function HlsPlayer({ label, fetchStream }: HlsPlayerProps) {
  const [state, setState] = useState<PlayerState>("idle");
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const start = useCallback(async () => {
    setState("fetching");
    setError("");
    setStreamUrl("");
    try {
      const { url, referer } = await fetchStream();
      const params = new URLSearchParams({ url });
      if (referer) params.set("ref", referer);
      setStreamUrl(`/api/stream/proxy?${params.toString()}`);
      setState("buffering");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stream");
      setState("error");
    }
  }, [fetchStream]);

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

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-xl bg-neutral-950 shadow-2xl ring-1 ring-white/10">
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
            <p className="text-sm text-white/60">Fetching stream&hellip;</p>
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
        controls
        autoPlay
        playsInline
        className="h-full w-full bg-black"
        style={{ display: state === "playing" || state === "buffering" ? "block" : "none" }}
      />

      {state === "buffering" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-8 w-8 animate-spin text-white/80" />
        </div>
      )}
    </div>
  );
}
