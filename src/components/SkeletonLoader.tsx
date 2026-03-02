export function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl" aria-hidden>
      <div className="h-4 w-full max-w-[95%] rounded-lg bg-white/10 animate-shimmer" />
      <div className="h-4 w-full max-w-[88%] rounded-lg bg-white/10 animate-shimmer" />
      <div className="h-4 w-full max-w-[70%] rounded-lg bg-white/10 animate-shimmer" />
      <div className="h-4 w-full max-w-[60%] rounded-lg bg-white/10 animate-shimmer" />
      <div className="h-4 w-2/3 max-w-[50%] rounded-lg bg-white/10 animate-shimmer" />
    </div>
  );
}
