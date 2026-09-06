// src/components/insights/InstagramBigCard.tsx
// Instagram best time to post: monthly follower-activity grid (with post markers)
// plus the hour-aggregated row with recommended times. All hours shown in SGT.
import { PLATFORM_THEMES, WEEKDAY_LABELS } from "../../constants/insights";
import {
  useTimeEngagement,
  useTimeEngagementMonthly,
} from "../../hooks/insights/useInsightsData";
import {
  useInstagramDailyRow,
  useInstagramMonthlyGrid,
} from "../../hooks/insights/useInstagramTimeEngagement";
import { fmtNum } from "../../utils/insights";
import type { Post } from "../../types/insights";
import { HeatScaleLegend } from "./HeatScaleLegend";
import { HourAxisLabels } from "./HourAxisLabels";
import { PlatformIcon } from "./PlatformIcon";

const theme = PLATFORM_THEMES.instagram;
const heatColors = theme.heatColors;

function heatColor(value: number, hasData: boolean, min: number, max: number) {
  if (!hasData) return heatColors[0];
  if (max === min) return heatColors[4];
  const normalized = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return heatColors[Math.round(normalized * (heatColors.length - 1))];
}

export function InstagramBigCard({ posts }: { posts: Post[] }) {
  const {
    monthlyData,
    availableMonths,
    selectedMonth,
    setSelectedMonth,
    loading: monthlyLoading,
    error: monthlyError,
  } = useTimeEngagementMonthly();

  const {
    dailyData,
    loading: dailyLoading,
    error: dailyError,
  } = useTimeEngagement();

  const monthly = useInstagramMonthlyGrid(monthlyData, selectedMonth, posts);
  const daily = useInstagramDailyRow(dailyData);

  const bothLoading = monthlyLoading && dailyLoading;
  const bothError = monthlyError && dailyError;

  return (
    <div
      className="signal-panel overflow-hidden rounded-2xl border border-signal-border border-t-4"
      style={{ borderTopColor: theme.accent }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-signal-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <PlatformIcon name="instagram" />
          <span
            className="font-signal-display text-lg font-semibold"
            style={{ color: theme.accent }}
          >
            Best time to post (SGT)
          </span>
        </div>
        <span className="font-signal-mono text-[10px] uppercase tracking-wide text-signal-muted">
          Monthly + hourly follower activity
        </span>
      </div>

      <div className="p-4 sm:p-6">
        {bothError ? (
          <div className="flex h-24 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
            Failed to load data. Please try again later.
          </div>
        ) : !monthly.hasData && !daily.hasData && !bothLoading ? (
          <div className="flex h-24 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
            Not enough data.
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {/* ===== Table 1: by month (7 days x 24 hours) ===== */}
            {monthlyError ? (
              <div className="flex h-20 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
                Failed to load monthly data.
              </div>
            ) : availableMonths.length === 0 && !monthlyLoading ? (
              <div className="flex h-20 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
                Not enough monthly data.
              </div>
            ) : (
              <div>
                {availableMonths.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5 sm:mb-4 sm:gap-2">
                    {availableMonths.map((m) => {
                      const isActive = selectedMonth === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSelectedMonth(m)}
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors sm:text-[11px] ${isActive ? "text-white" : "bg-signal-surface"}`}
                          style={
                            isActive
                              ? {
                                backgroundColor: theme.accent,
                                borderColor: theme.accent,
                              }
                              : {
                                color: theme.accent,
                                borderColor: `${theme.accent}55`,
                              }
                          }
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                )}

                <HeatScaleLegend
                  min={monthly.min}
                  max={monthly.max}
                  heatColors={heatColors}
                  markerColor={theme.marker}
                  markerLabel="Your posts"
                />

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[650px] sm:min-w-[720px]">
                    {WEEKDAY_LABELS.map((day, dayIdx) => (
                      <div
                        key={day}
                        className="mb-1.5 flex items-center gap-1 sm:gap-1.5"
                      >
                        <span className="w-8 shrink-0 pr-1 text-right text-[10px] text-signal-muted sm:w-9 sm:pr-2 sm:text-[11px]">
                          {day}
                        </span>
                        <div className="flex flex-1 gap-[3px] sm:gap-[4px]">
                          {monthly.grid[dayIdx].map((value, hourIdx) => {
                            const postCount =
                              monthly.postCountGrid[dayIdx][hourIdx];
                            return (
                              <div
                                key={hourIdx}
                                role="img"
                                tabIndex={postCount > 0 ? 0 : -1}
                                title={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT — ${fmtNum(value)} followers online, ${postCount} post${postCount === 1 ? "" : "s"} (${selectedMonth})`}
                                aria-label={`${day} ${String(hourIdx).padStart(2, "0")}:00 SGT, ${fmtNum(value)} followers online, ${postCount} posts, ${selectedMonth}`}
                                className="relative aspect-square flex-1 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                                style={{
                                  backgroundColor: heatColor(
                                    value,
                                    monthly.hasData,
                                    monthly.min,
                                    monthly.max,
                                  ),
                                }}
                              >
                                {postCount > 0 && (
                                  <span className="absolute inset-0 flex items-center justify-center">
                                    <span
                                      className="flex min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8px] font-bold leading-none text-white shadow-sm sm:min-w-[16px] sm:text-[9px]"
                                      style={{ backgroundColor: theme.marker }}
                                    >
                                      {postCount}
                                    </span>
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <HourAxisLabels />
                  </div>
                </div>
              </div>
            )}

            <div
              className="border-t"
              style={{ borderColor: `${theme.accent}33` }}
            />

            {/* ===== Table 2: aggregated by hour, not split by weekday ===== */}
            {dailyError ? (
              <div className="flex h-20 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
                Failed to load hourly aggregated data.
              </div>
            ) : !daily.hasData && !dailyLoading ? (
              <div className="flex h-20 items-center justify-center text-[13px] text-signal-muted sm:text-sm">
                Not enough hourly aggregated data.
              </div>
            ) : (
              <div>
                <HeatScaleLegend
                  min={daily.min}
                  max={daily.max}
                  heatColors={heatColors}
                  markerColor={theme.marker}
                  markerLabel="Recommended"
                />

                <div className="overflow-x-auto pb-2">
                  <div className="min-w-[650px] sm:min-w-[720px]">
                    <div className="flex gap-[3px] sm:gap-[4px]">
                      {daily.row.map((value, hourIdx) => (
                        <div
                          key={hourIdx}
                          role="img"
                          tabIndex={daily.recommendedHours.has(hourIdx) ? 0 : -1}
                          title={`${String(hourIdx).padStart(2, "0")}:00 SGT — ${fmtNum(value)} followers online`}
                          aria-label={`${String(hourIdx).padStart(2, "0")}:00 SGT, ${fmtNum(value)} followers online`}
                          className="relative aspect-square flex-1 rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan sm:rounded-[4px]"
                          style={{
                            backgroundColor: heatColor(
                              value,
                              daily.hasData,
                              daily.min,
                              daily.max,
                            ),
                          }}
                        >
                          {daily.recommendedHours.has(hourIdx) && (
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

                    <HourAxisLabels withGutter={false} />
                  </div>
                </div>

                {daily.recommendedSgtTimes.length > 0 && (
                  <div
                    className="mt-4 rounded-xl border p-3 sm:mt-5"
                    style={{
                      backgroundColor: theme.soft,
                      borderColor: `${theme.accent}55`,
                    }}
                  >
                    <p
                      className="mb-1.5 text-[11px] font-semibold sm:text-xs"
                      style={{ color: theme.accent }}
                    >
                      Best times to post:
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {daily.recommendedSgtTimes.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border bg-signal-surface px-2 py-0.5 text-[10px] font-bold sm:px-2.5 sm:text-xs"
                          style={{
                            color: theme.accent,
                            borderColor: `${theme.accent}55`,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-3 text-[10px] leading-relaxed text-signal-muted sm:text-[11px]">
                  Actual online followers (SGT time) — not separated by day of
                  the week.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
