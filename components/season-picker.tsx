"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { SeasonSummary } from "@/utils/episodes";

const MAX_PILLS = 8;

interface SeasonPickerProps {
  seasons: SeasonSummary[];
  selected: number;
  // Page the picker links to; the season is passed as ?season=N
  basePath: string;
}

export function SeasonPicker({ seasons, selected, basePath }: SeasonPickerProps) {
  const router = useRouter();
  const hrefFor = (n: number) => `${basePath}?season=${n}`;

  if (seasons.length <= 1) return null;

  if (seasons.length > MAX_PILLS) {
    return (
      <Select
        value={selected.toString()}
        onValueChange={(v) => router.push(hrefFor(Number(v)), { scroll: false })}
      >
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Select a season" />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.season_number.toString()}>
              {s.name} ({s.episode_count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {seasons.map((s) => (
        <Link
          key={s.id}
          href={hrefFor(s.season_number)}
          scroll={false}
          replace
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            s.season_number === selected
              ? "bg-brand text-white"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
        >
          {s.season_number === 0 ? s.name : `Season ${s.season_number}`}
        </Link>
      ))}
    </div>
  );
}
