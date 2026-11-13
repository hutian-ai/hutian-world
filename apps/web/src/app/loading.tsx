import { Skeleton } from "@/components/ui/skeleton";
export default function Loading() {
  return (
    <div className="flex h-dvh" role="status" aria-label="正在读取工作台">
      <aside className="hidden w-52 shrink-0 border-r p-4 md:block">
        <Skeleton className="mb-8 h-8 w-28" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="mb-4 h-8 w-full" />
        ))}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center border-b px-5">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 border-r p-4 lg:block">
            <Skeleton className="mb-6 h-9 w-full" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="mb-4 h-10 w-full" />
            ))}
          </aside>
          <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
            正在读取你的工作记录…
          </div>
        </div>
      </main>
    </div>
  );
}
