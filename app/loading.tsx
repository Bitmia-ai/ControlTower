export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 border-2 border-gray-200 dark:border-zinc-700 border-t-gray-500 dark:border-t-zinc-400 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-zinc-500">Loading…</p>
      </div>
    </div>
  );
}
