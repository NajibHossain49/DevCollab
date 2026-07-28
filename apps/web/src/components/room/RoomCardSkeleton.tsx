import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Placeholder matching RoomCard's shape while the room list loads.
export function RoomCardSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="size-4 rounded" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </CardHeader>
      <CardContent className="pt-0">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-4 flex items-center justify-between">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function RoomCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <RoomCardSkeleton key={index} />
      ))}
    </div>
  );
}
