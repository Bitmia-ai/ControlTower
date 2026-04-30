interface FetchErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function FetchError({
  message = "Failed to load data",
  onRetry,
}: FetchErrorProps) {
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-6 text-center">
      <p className="text-sm text-red-700 dark:text-red-300 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-md transition"
        >
          Retry
        </button>
      )}
    </div>
  );
}
