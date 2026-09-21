export function MovieCardSkeleton() {
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted animate-pulse">
      <div className="absolute inset-x-2 bottom-2 h-12 rounded-lg bg-foreground/5" />
    </div>
  );
}
