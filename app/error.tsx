"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen px-4">
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-8 max-w-md w-full text-center">
        <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <span className="text-red-500 dark:text-red-400 text-xl">!</span>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
