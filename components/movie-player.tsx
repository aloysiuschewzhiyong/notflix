"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface MoviePlayerProps {
  movieId: string;
  mediaType?: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
}

export function MoviePlayer({
  movieId,
  mediaType = "movie",
  seasonNumber,
  episodeNumber,
}: MoviePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlayClick = () => {
    setIsPlaying(true);
  };

  const getEmbedUrl = () => {
    if (mediaType === "movie") {
      return `https://vidsrc.net/embed/movie/${movieId}`;
    } else if (mediaType === "tv") {
      if (seasonNumber && episodeNumber) {
        return `https://vidsrc.net/embed/tv/${movieId}/${seasonNumber}/${episodeNumber}`;
      } else if (seasonNumber) {
        return `https://vidsrc.net/embed/tv/${movieId}/${seasonNumber}`;
      } else {
        return `https://vidsrc.net/embed/tv/${movieId}`;
      }
    }
    return "";
  };

  return (
    <div className="aspect-video bg-black rounded-lg overflow-hidden">
      {isPlaying ? (
        <iframe
          src={getEmbedUrl()}
          allowFullScreen
          allow="autoplay; fullscreen"
          className="w-full h-full"
          style={{ border: "none" }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button onClick={handlePlayClick} size="lg" variant="secondary">
              Play {mediaType === "movie" ? "Movie" : "Episode"}
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
