import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { episodeHref, isAired } from "@/utils/episodes";

export interface Episode {
  id: number;
  name: string;
  episode_number: number;
  season_number: number;
  overview: string;
  still_path: string | null;
  runtime?: number | null;
  air_date?: string | null;
}

interface EpisodeListProps {
  showId: string;
  episodes: Episode[];
  variant?: "grid" | "compact";
  // Episode currently playing, highlighted in the list
  current?: { season: number; episode: number };
}

export function EpisodeList({
  showId,
  episodes,
  variant = "grid",
  current,
}: EpisodeListProps) {
  if (!episodes.length) {
    return <p className="text-muted-foreground">No episodes available.</p>;
  }

  return (
    <ul
      className={cn(
        variant === "grid"
          ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          : "flex flex-col gap-2"
      )}
    >
      {episodes.map((ep) => {
        const aired = isAired(ep.air_date);
        const isCurrent =
          current?.season === ep.season_number &&
          current?.episode === ep.episode_number;
        const content =
          variant === "grid" ? (
            <GridCard episode={ep} aired={aired} />
          ) : (
            <CompactRow episode={ep} aired={aired} isCurrent={isCurrent} />
          );

        return (
          <li key={ep.id}>
            {aired ? (
              <Link
                href={episodeHref(showId, {
                  season: ep.season_number,
                  episode: ep.episode_number,
                })}
                aria-current={isCurrent ? "true" : undefined}
                className="block group"
              >
                {content}
              </Link>
            ) : (
              <div className="opacity-50 cursor-not-allowed">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Still({ episode, className }: { episode: Episode; className?: string }) {
  return (
    <div className={cn("relative aspect-video bg-muted overflow-hidden", className)}>
      {episode.still_path && (
        <Image
          src={`https://image.tmdb.org/t/p/w300${episode.still_path}`}
          alt={episode.name}
          fill
          sizes="(max-width: 640px) 100vw, 300px"
          className="object-cover transition-transform group-hover:scale-105"
        />
      )}
    </div>
  );
}

function Meta({ episode, aired }: { episode: Episode; aired: boolean }) {
  if (!aired) {
    return <span>{episode.air_date ? `Airs ${episode.air_date}` : "Upcoming"}</span>;
  }
  return episode.runtime ? <span>{episode.runtime}m</span> : null;
}

function GridCard({ episode, aired }: { episode: Episode; aired: boolean }) {
  return (
    <div className="rounded-lg overflow-hidden bg-card border h-full transition-all group-hover:border-brand group-hover:shadow-glow">
      <Still episode={episode} />
      <div className="p-3">
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <h3 className="font-semibold line-clamp-1">
            E{episode.episode_number} · {episode.name}
          </h3>
          <span className="text-xs text-muted-foreground shrink-0">
            <Meta episode={episode} aired={aired} />
          </span>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {episode.overview || "No overview available."}
        </p>
      </div>
    </div>
  );
}

function CompactRow({
  episode,
  aired,
  isCurrent,
}: {
  episode: Episode;
  aired: boolean;
  isCurrent: boolean;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md p-2 transition-colors",
        isCurrent ? "bg-brand/10 ring-1 ring-brand" : "group-hover:bg-secondary"
      )}
    >
      <Still episode={episode} className="w-28 shrink-0 rounded" />
      <div className="min-w-0">
        <h3 className="text-sm font-medium line-clamp-2">
          E{episode.episode_number} · {episode.name}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {isCurrent ? "Now playing" : <Meta episode={episode} aired={aired} />}
        </p>
      </div>
    </div>
  );
}
