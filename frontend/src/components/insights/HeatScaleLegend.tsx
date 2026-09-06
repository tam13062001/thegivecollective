// src/components/insights/HeatScaleLegend.tsx
// min → max gradient plus the marker legend shown above each heatmap.
import { fmtNum } from "../../utils/insights";

export function HeatScaleLegend({
  min,
  max,
  heatColors,
  markerColor,
  markerLabel,
}: {
  min: number;
  max: number;
  heatColors: readonly string[];
  markerColor: string;
  markerLabel: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-signal-muted sm:mb-4 sm:gap-3 sm:text-xs">
      <span className="tabular-nums">{fmtNum(min)}</span>
      <span
        className="h-2 w-24 rounded-full sm:h-2.5 sm:w-32"
        style={{
          background: `linear-gradient(to right, ${heatColors[0]}, ${heatColors[heatColors.length - 1]})`,
        }}
      />
      <span className="tabular-nums">{fmtNum(max)}</span>
      <span className="ml-1 flex items-center gap-1 sm:ml-2 sm:gap-1.5">
        <span
          className="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
          style={{ backgroundColor: markerColor }}
        />
        {markerLabel}
      </span>
    </div>
  );
}
