"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { SORT_OPTIONS } from "@/utils/sort-options";
import { cn } from "@/lib/utils";

export function SortSelect({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentSort = searchParams.get("sort") ?? "popular";

  // Determine which browse page we're on
  const mediaType = pathname.includes("/movies")
    ? "movie"
    : pathname.includes("/anime")
    ? "anime"
    : "tv";
  const options = SORT_OPTIONS[mediaType as keyof typeof SORT_OPTIONS];
  const base = mediaType === "movie" ? "movies" : mediaType === "anime" ? "anime" : "series";

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "popular") {
      params.delete("sort");
    } else {
      params.set("sort", value);
    }

    // Keep the genre parameter if it exists
    router.push(`/${base}${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <Select value={currentSort} onValueChange={handleSortChange}>
      <SelectTrigger className={cn("w-full", className)} aria-label="Sort by">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent className="bg-background/85 backdrop-blur-xl">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
