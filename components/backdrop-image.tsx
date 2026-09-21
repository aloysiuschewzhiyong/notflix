"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

interface BackdropImageProps {
  src: string;
  // Override the default banner height, e.g. a shorter one on player pages
  className?: string;
}

export function BackdropImage({
  src,
  className = "h-[45vh] md:h-[60vh]",
}: BackdropImageProps) {
  const layer = useRef<HTMLDivElement>(null);

  // Parallax via a direct style write once per frame, instead of setState on
  // every scroll event (which re-rendered the component dozens of times a second)
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (layer.current) {
          layer.current.style.transform = `translate3d(0, ${window.scrollY * 0.3}px, 0)`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={`relative w-full overflow-hidden ${className}`}>
      <div ref={layer} className="absolute inset-0 h-[120%] -top-[20%] will-change-transform">
        <Image src={src} alt="" fill sizes="100vw" className="object-cover object-[50%_35%]" priority />
      </div>
      <div className="absolute inset-0 dark:bg-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  );
}
