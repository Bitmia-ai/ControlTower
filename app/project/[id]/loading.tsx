export default function ProjectLoading() {
  return (
    <div className="min-h-screen">
      <div className="px-4 sm:px-6 pt-8 max-w-6xl mx-auto">
        <div className="mb-8">
          {/* Back link skeleton */}
          <div className="h-3 w-20 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse mb-4" />

          <div className="flex items-start justify-between mt-2">
            <div>
              {/* Project name skeleton */}
              <div className="h-7 w-48 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
              {/* Path skeleton */}
              <div className="h-3 w-64 bg-gray-100 dark:bg-zinc-800/50 rounded animate-pulse mt-2" />
            </div>

            {/* Status dot skeleton */}
            <div className="flex items-center gap-1.5 mt-1">
              <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
              <div className="h-3 w-12 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>

          {/* Nav skeleton */}
          <div className="flex gap-4 mt-5 border-b border-gray-200 dark:border-zinc-800 pb-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-4 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse"
              />
            ))}
          </div>
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-40 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
