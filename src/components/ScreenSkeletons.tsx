// Skeletons no bloqueantes para pantallas cargadas bajo demanda
import { Skeleton } from '@/components/ui/skeleton';

function Header() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-3">
          <Skeleton className="h-11 w-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export type SkeletonVariant =
  | 'map' | 'transit' | 'alerts' | 'community' | 'resources' | 'status' | 'settings' | 'page';

export function ScreenSkeleton({ variant = 'page' }: { variant?: SkeletonVariant }) {
  if (variant === 'map') {
    return (
      <div className="relative h-[calc(100dvh-120px-env(safe-area-inset-bottom,0px))] w-full overflow-hidden" aria-busy="true">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="absolute top-3 left-3 right-3 flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-lg" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <div className="absolute bottom-4 right-3 space-y-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in" aria-busy="true" aria-live="polite">
      <Header />
      {variant === 'resources' || variant === 'community' ? (
        <>
          <GridSkeleton items={6} />
          <ListSkeleton rows={3} />
        </>
      ) : variant === 'settings' ? (
        <ListSkeleton rows={7} />
      ) : variant === 'status' ? (
        <>
          <Skeleton className="h-28 w-full rounded-xl" />
          <ListSkeleton rows={4} />
        </>
      ) : (
        <ListSkeleton rows={5} />
      )}
      <span className="sr-only">Cargando contenido…</span>
    </div>
  );
}

export default ScreenSkeleton;
