import type { VelocityWeek } from "@/lib/velocity";

interface VelocityChartProps {
  weeks: VelocityWeek[];
  className?: string;
}

const VIEW_W = 280;
const VIEW_H = 110;
const PADDING_X = 6;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 22; // reserve room for week labels

const ROLLING_AVG_COLOR = "#6366f1"; // indigo-500

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatWeekLabel(weekStart: string): string {
  // weekStart is an ISO date, e.g. "2026-04-20". Parse as UTC to dodge
  // timezone-induced day shifts at midnight in non-UTC locales.
  const d = new Date(`${weekStart}T12:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Pure-SVG velocity chart with bars per week and an indigo rolling-average
 * polyline overlaid on top.
 *
 * Renders nothing when `weeks` is empty, or when every week has both a
 * zero count and a zero rolling average — there is nothing to draw.
 *
 * The current (incomplete) week's bar is rendered at lower opacity with a
 * dashed outline to signal that it may still grow.
 */
export function VelocityChart({ weeks, className }: VelocityChartProps) {
  if (weeks.length === 0) return null;

  const allZero = weeks.every((w) => w.count === 0 && w.rollingAvg === 0);
  if (allZero) return null;

  const innerW = VIEW_W - PADDING_X * 2;
  const innerH = VIEW_H - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = VIEW_H - PADDING_BOTTOM;

  const counts = weeks.map((w) => w.count);
  const rollingAvgs = weeks.map((w) => w.rollingAvg);
  const maxValue = Math.max(0, ...counts, ...rollingAvgs);
  // 20% headroom; minimum 1 to avoid divide-by-zero.
  const yMax = maxValue === 0 ? 1 : maxValue * 1.2;

  const xFor = (index: number): number => {
    if (weeks.length <= 1) return PADDING_X + innerW / 2;
    return PADDING_X + (index / (weeks.length - 1)) * innerW;
  };

  const yFor = (value: number): number => {
    const norm = value / yMax;
    return PADDING_TOP + (1 - norm) * innerH;
  };

  const spacing = weeks.length > 1 ? innerW / (weeks.length - 1) : innerW;
  const barWidth = Math.max(2, Math.min(14, spacing * 0.6));

  // Rolling-average polyline: only points where rollingAvg > 0.
  const rollingPoints: Array<{ x: number; y: number }> = [];
  weeks.forEach((w, i) => {
    if (w.rollingAvg > 0) {
      rollingPoints.push({ x: xFor(i), y: yFor(w.rollingAvg) });
    }
  });
  const rollingPolyline = rollingPoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  // Y-axis max label rounds up so it always reflects an integer task count.
  const yMaxLabel = Math.max(1, Math.ceil(maxValue));

  // Week labels: at most 5, evenly spaced, including first and last.
  const maxLabels = 5;
  const step = Math.max(1, Math.ceil(weeks.length / maxLabels));
  const labelIndexes = new Set<number>();
  for (let i = 0; i < weeks.length; i += step) labelIndexes.add(i);
  labelIndexes.add(weeks.length - 1);

  return (
    <svg
      data-testid="velocity-chart"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="Velocity chart showing tasks completed per week"
    >
      {/* Baseline */}
      <line
        x1={PADDING_X}
        y1={baselineY}
        x2={VIEW_W - PADDING_X}
        y2={baselineY}
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="1"
      />

      {/* Bars */}
      {weeks.map((w, i) => {
        const x = xFor(i);
        const y = yFor(w.count);
        const h = Math.max(0, baselineY - y);
        const isCurrent = w.isCurrentWeek;
        return (
          <rect
            key={`bar-${i}`}
            data-testid="velocity-bar"
            data-current={isCurrent ? "true" : "false"}
            x={x - barWidth / 2}
            y={y}
            width={barWidth}
            height={h}
            fill="currentColor"
            fillOpacity={isCurrent ? 0.4 : 0.8}
            stroke={isCurrent ? "currentColor" : "none"}
            strokeOpacity={isCurrent ? 0.6 : 0}
            strokeWidth={isCurrent ? 1 : 0}
            strokeDasharray={isCurrent ? "2 2" : undefined}
          />
        );
      })}

      {/* Rolling-average polyline (indigo) */}
      {rollingPoints.length >= 2 && (
        <polyline
          data-testid="velocity-rolling-avg"
          fill="none"
          stroke={ROLLING_AVG_COLOR}
          strokeOpacity="0.85"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={rollingPolyline}
        />
      )}

      {/* Y-axis max label (top right) */}
      <text
        x={VIEW_W - PADDING_X}
        y={PADDING_TOP + 8}
        fontSize="8"
        textAnchor="end"
        fill="currentColor"
        fillOpacity="0.55"
        data-testid="velocity-ymax-label"
      >
        {yMaxLabel} tasks
      </text>

      {/* Week labels under selected bars */}
      {weeks.map((w, i) =>
        labelIndexes.has(i) ? (
          <text
            key={`l-${i}`}
            x={xFor(i)}
            y={VIEW_H - 2}
            fontSize="8"
            textAnchor="middle"
            fill="currentColor"
            fillOpacity="0.55"
          >
            {formatWeekLabel(w.weekStart)}
          </text>
        ) : null
      )}
    </svg>
  );
}
