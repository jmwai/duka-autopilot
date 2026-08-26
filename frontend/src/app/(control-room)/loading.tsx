export default function ControlRoomLoading() {
  return (
    <div aria-live="polite" aria-busy="true" className="space-y-6">
      <span className="sr-only">Loading the control room</span>
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
