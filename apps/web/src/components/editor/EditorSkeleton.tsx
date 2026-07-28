import { Skeleton } from "@/components/ui/skeleton";

// Full editor-shell placeholder shown while the room + Monaco initialize.
export function EditorSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      {/* Header */}
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
        <div className="ml-auto flex items-center gap-3">
          <div className="flex -space-x-2">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="size-7 rounded-full" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="size-9" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Editor lines */}
        <div className="min-w-0 flex-1 space-y-3 p-4">
          {Array.from({ length: 14 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-4"
              style={{ width: `${35 + ((index * 37) % 55)}%` }}
            />
          ))}
        </div>

        {/* Side panel */}
        <div className="hidden w-96 shrink-0 flex-col gap-4 border-l border-border p-4 md:flex">
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-2">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
