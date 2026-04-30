interface TrendSession {
  cost: number;
  mtimeMs: number;
}

interface ProjectedPoint {
  sessionIndex: number;
  cost: number;
}

interface CostTrendChartProps {
  sessions: TrendSession[];
  projectedSessions: ProjectedPoint[];
  className?: string;
}

const VIEW_W = 280;
const VIEW_H = 100;
const PADDING_X = 6;
const PADDING_TOP = 6;
const PADDING_BOTTOM = 18; // reserve room for date labels

const PROJECTION_COLOR = "#f59e0b"; // amber-500

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
 * Pure-SVG cost trend chart with a 5-point projection line.
 *
 * Real sessions render as filled bars in `currentColor`. The projection
 * extends as a dashed amber polyline at reduced opacity. A vertical dashed
 * separator divides the historical area from the projection.
 *
 * Renders nothing when fewer than 2 real sessions are available — the
 * sparkline degrades gracefully like its predecessor.
 */
export function CostTrendChart({
  sessions,
  projectedSessions,
  className,
}: CostTrendChartProps) {
  if (sessions.length < 2) return null;

  const totalPoints = sessions.length + projectedSessions.length;
  const innerW = VIEW_W - PADDING_X * 2;
  const innerH = VIEW_H - PADDING_TOP - PADDING_BOTTOM;
  const baselineY = VIEW_H - PADDING_BOTTOM;

  const realCosts = sessions.map((s) => s.cost);
  const projectedCosts = projectedSessions.map((p) => p.cost);
  const maxCost = Math.max(0, ...realCosts, ...projectedCosts);
  // 10% headroom so bars never touch the very top edge.
  const yMax = maxCost === 0 ? 1 : maxCost * 1.1;

  const xFor = (index: number): number => {
    if (totalPoints <= 1) return PADDING_X + innerW / 2;
    return PADDING_X + (index / (totalPoints - 1)) * innerW;
  };

  const yFor = (cost: number): number => {
    const norm = cost / yMax;
    return PADDING_TOP + (1 - norm) * innerH;
  };

  // Real session bar width: half the spacing between adjacent points,
  // capped so we never overflow into the projection area.
  const spacing = totalPoints > 1 ? innerW / (totalPoints - 1) : innerW;
  const barWidth = Math.max(2, Math.min(18, spacing * 0.6));

  // Projected polyline starts from the last real session's point and
  // extends through each projected point — visually anchors the dashed
  // line to the last bar.
  const projectedLinePoints: Array<{ x: number; y: number }> = [];
  if (sessions.length > 0) {
    const lastRealIdx = sessions.length - 1;
    projectedLinePoints.push({
      x: xFor(lastRealIdx),
      y: yFor(sessions[lastRealIdx].cost),
    });
  }
  projectedSessions.forEach((p, i) => {
    const idx = sessions.length + i;
    projectedLinePoints.push({ x: xFor(idx), y: yFor(p.cost) });
  });

  const projectedPolyline = projectedLinePoints
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");

  // Vertical separator at the boundary between real and projected.
  const separatorX =
    sessions.length > 0 && projectedSessions.length > 0
      ? (xFor(sessions.length - 1) + xFor(sessions.length)) / 2
      : null;

  // Date labels: max 5, evenly spaced over real sessions.
  const maxLabels = 5;
  const step = Math.max(1, Math.ceil(sessions.length / maxLabels));
  const labelIndexes = new Set<number>();
  for (let i = 0; i < sessions.length; i += step) labelIndexes.add(i);
  labelIndexes.add(sessions.length - 1);

  return (
    <svg
      data-testid="cost-trend-chart"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="Cost trend chart with projection"
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

      {/* Real session bars */}
      {sessions.map((s, i) => {
        const x = xFor(i);
        const y = yFor(s.cost);
        const h = Math.max(0, baselineY - y);
        return (
          <rect
            key={`bar-${i}`}
            data-testid="trend-bar"
            x={x - barWidth / 2}
            y={y}
            width={barWidth}
            height={h}
            fill="currentColor"
            fillOpacity="0.8"
          />
        );
      })}

      {/* Vertical separator between real and projected sections */}
      {separatorX !== null && (
        <line
          data-testid="trend-separator"
          x1={separatorX}
          y1={PADDING_TOP}
          x2={separatorX}
          y2={baselineY}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* Projected dashed polyline (amber) */}
      {projectedLinePoints.length >= 2 && (
        <polyline
          data-testid="trend-projection"
          fill="none"
          stroke={PROJECTION_COLOR}
          strokeOpacity="0.6"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={projectedPolyline}
        />
      )}

      {/* Projected dots */}
      {projectedLinePoints.slice(1).map((p, i) => (
        <circle
          key={`pdot-${i}`}
          cx={p.x}
          cy={p.y}
          r="1.75"
          fill={PROJECTION_COLOR}
          fillOpacity="0.7"
        />
      ))}

      {/* Y-axis max label (top right) */}
      <text
        x={VIEW_W - PADDING_X}
        y={PADDING_TOP + 8}
        fontSize="8"
        textAnchor="end"
        fill="currentColor"
        fillOpacity="0.55"
      >
        ${maxCost.toFixed(2)}
      </text>

      {/* Y-axis min label (bottom right) */}
      <text
        x={VIEW_W - PADDING_X}
        y={baselineY - 2}
        fontSize="8"
        textAnchor="end"
        fill="currentColor"
        fillOpacity="0.55"
      >
        $0
      </text>

      {/* Date labels under selected real session bars */}
      {sessions.map((s, i) =>
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
            {formatDate(s.mtimeMs)}
          </text>
        ) : null
      )}
    </svg>
  );
}
