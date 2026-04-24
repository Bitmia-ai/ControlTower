"use client";

import { BacklogId } from "@/components/backlog-id";
import type { BacklogItem, ChangelogEntry } from "@/lib/redeye-types";

interface ShippedCardProps {
  items: BacklogItem[];
  changelog?: ChangelogEntry[];
  projectId?: number;
}

export function ShippedCard({ items, changelog = [], projectId }: ShippedCardProps) {
  const hasChangelog = changelog.length > 0;
  const shippedItems = hasChangelog ? changelog.slice(0, 5) : items.slice(0, 5);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-green-600 rounded-lg p-5">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-zinc-500 mb-3">
        Recently Shipped
      </p>

      {shippedItems.length === 0 ? (
        <span className="text-gray-400 dark:text-zinc-600 text-sm">Nothing shipped yet</span>
      ) : (
        <ul className="space-y-2">
          {hasChangelog
            ? (shippedItems as ChangelogEntry[]).map((entry, i) => {
                const blMatch = entry.details?.match(/\*\*Built:\*\*\s*(BL-\d+)/);
                const blId = blMatch ? blMatch[1] : null;
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 text-green-500 text-sm shrink-0">✓</span>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">
                        {projectId !== undefined && blId ? (
                          <BacklogId id={blId} projectId={projectId} className="text-gray-500 dark:text-zinc-500" />
                        ) : blId ? (
                          <span className="text-gray-500 dark:text-zinc-500 font-mono">{blId}</span>
                        ) : null}
                        {blId && " · "}
                        {entry.title}
                      </p>
                      {entry.date && (
                        <p className="text-xs text-gray-400 dark:text-zinc-600">{entry.date}</p>
                      )}
                    </div>
                  </li>
                );
              })
            : (shippedItems as BacklogItem[]).map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <span className="mt-0.5 text-green-500 text-sm shrink-0">✓</span>
                  <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug flex-1 min-w-0">
                    {projectId !== undefined ? (
                      <BacklogId id={item.id} projectId={projectId} className="text-gray-500 dark:text-zinc-500" />
                    ) : (
                      <span className="text-gray-500 dark:text-zinc-500 font-mono">{item.id}</span>
                    )}
                    {" · "}
                    {item.title}
                  </p>
                  {item.cost_usd !== undefined && item.cost_usd > 0 && (
                    <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono shrink-0 ml-auto">
                      ${item.cost_usd.toFixed(2)}
                    </span>
                  )}
                </li>
              ))}
        </ul>
      )}
    </div>
  );
}
