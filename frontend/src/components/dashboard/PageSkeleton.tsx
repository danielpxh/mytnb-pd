export function PageSkeleton({
  title,
  cards = 4,
  charts = 2,
}: {
  title: string;
  cards?: number;
  charts?: number;
}) {
  return (
    <div
      role="status"
      aria-label={`Loading ${title}`}
      className="animate-pulse space-y-6 p-4 sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-6 w-36 rounded bg-slate-200" />
          <div className="h-4 w-56 max-w-full rounded bg-slate-100" />
        </div>
        <div className="h-10 w-full rounded-lg bg-slate-200 sm:w-48" />
      </div>
      {cards > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: cards }, (_, index) => (
            <div
              key={index}
              className="h-28 rounded-xl border border-slate-100 bg-white p-4"
            >
              <div className="h-3 w-20 rounded bg-slate-100" />
              <div className="mt-4 h-6 w-28 max-w-full rounded bg-slate-200" />
              <div className="mt-3 h-3 w-16 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: charts }, (_, index) => (
          <div
            key={index}
            className="h-72 rounded-xl border border-slate-100 bg-white p-4"
          >
            <div className="h-4 w-40 rounded bg-slate-100" />
            <div className="mt-6 h-52 rounded-lg bg-slate-50" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading {title} data…</span>
    </div>
  );
}
