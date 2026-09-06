// src/components/insights/PostHistoryGridView.tsx
import { PLATFORM_THEMES, WEEKDAY_LABELS } from "../../constants/insights";
import { fmtNum } from "../../utils/insights";
import type { HeatCell, PlatformKey } from "../../types/insights";
import { HeatScaleLegend } from "./HeatScaleLegend";
import { HourAxisLabels } from "./HourAxisLabels";

export function PostHistoryGridView({
  grid,
  minAvg,
  maxAvg,
  hasData,
  loading,
  platform,
}: {
  grid: HeatCell[][];
  minAvg: number;
  maxAvg: number;
  hasData: boolean;
  loading: boolean;
  platform: PlatformKey;
}) {
  const theme = PLATFORM_THEMES[platform];
  const heatColors = theme.heatColors;

  const cellColor = (cell: HeatCell) => {
    if (cell.count === 0) return heatColors[0];
    if (maxAvg === minAvg) return heatColors[4];
    const avg = cell.totalViews / cell.count;
    const normalized = Math.max(
      0,
      Math.min(1, (avg - minAvg) / (maxAvg - minAvg)),
    );
    const colorIndex = Math.round(normalized * (heatColors.length - 1));
    return heatColors[colorIndex];
  };

  if (!hasData && !loading) {
    return (
      <div className="flex h-32 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
        Not enough post time data to display.
      </div>
    );
  }

  return (
    <>
      <HeatScaleLegend
        min={minAvg}
        max={maxAvg}
        heatColors={heatColors}
        markerColor={theme.marker}
        markerLabel="Your posts (SGT)"
      />

      <div className="overflow-x-auto pb-2">
        <div className="min-w-[650px] sm:min-w-[720px]">
          {WEEKDAY_LABELS.map((day, dayIdx) => (
            <div key={day} className="mb-1.5 flex items-center gap-1 sm:gap-1.5">
              <span className="w-8 shrink-0 pr-1 text-right text-[10px] text-signal-muted sm:w-9 sm:pr-2 sm:text-[11px]">
                {day}
              </span>
              <div className="flex flex-1 gap-[3px] sm:gap-[4px]">
                {grid[dayIdx].map((cell, hourIdx) => (
                  <div
                    key={hourIdx}
                    role="img"
                    tabIndex={cell.count > 0 ? 0 : -1}
                    title={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT — ${cell.count} posts, ${fmtNum(cell.totalViews)} views`}
                    aria-label={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT, ${cell.count} posts, ${fmtNum(cell.totalViews)} views`}
                    className="relative aspect-square flex-1 rounded-[3px] outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                    style={{ backgroundColor: cellColor(cell) }}
                  >
                    {cell.count > 0 && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="h-2.5 w-2.5 rounded-full sm:h-3.5 sm:w-3.5"
                          style={{ backgroundColor: theme.marker }}
                        />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <HourAxisLabels />
        </div>
      </div>
    </>
  );
}
