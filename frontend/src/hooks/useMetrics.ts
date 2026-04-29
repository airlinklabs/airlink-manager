import { useMemo, useRef } from "react";

export type MetricPoint = {
  ts: number;
  cpu: number;
  memory: number;
};

export function useMetrics() {
  const points = useRef<MetricPoint[]>([]);
  return useMemo(
    () => ({
      points: points.current,
      push(point: MetricPoint) {
        points.current = [...points.current.slice(-59), point];
      }
    }),
    []
  );
}
