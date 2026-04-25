interface SparklineSession {
  cost: number;
  mtimeMs: number;
}

interface SparklineChartProps {
  sessions: SparklineSession[];
  className?: string;
}

const VIEW_W = 200;
const VIEW_H = 48;
const PADDING_X = 4;
const PADDING_TOP = 4;
const PADDING_BOTTOM = 14; // reserve room for date labels

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

function formatDate(mtimeMs: number): string {
  const d = new Date(mtimeMs);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Pure-SVG sparkline chart. Renders nothing when fewer than 2 sessions
 * are provided. Uses currentColor so it adapts to dark/light mode via
 * Tailwind text-color utilities on a parent.
 */
export function SparklineChart({ sessions, className }: SparklineChartProps) {
  if (sessions.length < 2) return null;

  const costs = sessions.map((s) => s.cost);
  const min = Math.min(...costs);
  const max = Math.max(...costs);
  const range = max - min;

  const innerW = VIEW_W - PADDING_X * 2;
  const innerH = VIEW_H - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = VIEW_H - PADDING_BOTTOM;

  const points = sessions.map((s, i) => {
    const x = PADDING_X + (i / (sessions.length - 1)) * innerW;
    // When all values equal, place flat near middle
    const norm = range === 0 ? 0.5 : (s.cost - min) / range;
    const y = PADDING_TOP + (1 - norm) * innerH;
    return { x, y, mtimeMs: s.mtimeMs };
  });

  const polylinePoints = points
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  // Show at most ~5 date labels to avoid overlap; pick first, last, and evenly spaced
  const maxLabels = 5;
  const step = Math.max(1, Math.ceil(sessions.length / maxLabels));
  const labelIndexes = new Set<number>();
  for (let i = 0; i < sessions.length; i += step) labelIndexes.add(i);
  labelIndexes.add(sessions.length - 1);

  return (
    <svg
      data-testid="sparkline"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={`Cost sparkline for last ${sessions.length} sessions`}
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

      {/* Polyline */}
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polylinePoints}
      />

      {/* Data point dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="1.75"
          fill="currentColor"
        />
      ))}

      {/* Date labels under selected points */}
      {points.map((p, i) =>
        labelIndexes.has(i) ? (
          <text
            key={`l-${i}`}
            x={p.x}
            y={VIEW_H - 2}
            fontSize="8"
            textAnchor="middle"
            fill="currentColor"
            fillOpacity="0.55"
          >
            {formatDate(p.mtimeMs)}
          </text>
        ) : null
      )}
    </svg>
  );
}
