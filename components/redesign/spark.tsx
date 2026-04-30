"use client";

interface SparkProps {
  values: number[];
}

export function Spark({ values }: SparkProps) {
  if (values.length === 0) {
    return <div className="spark" aria-hidden />;
  }
  const max = Math.max(...values, 1);
  return (
    <div className="spark" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className={"bar" + (i === values.length - 1 ? " now" : "")}
          style={{ height: `${(v / max) * 100}%` }}
        />
      ))}
    </div>
  );
}
