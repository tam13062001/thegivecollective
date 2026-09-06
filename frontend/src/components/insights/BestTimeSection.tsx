// src/components/insights/BestTimeSection.tsx
// Section 2: platform switcher + the matching best-time card.
import { useMemo, useState } from "react";
import { PLATFORM_THEMES } from "../../constants/insights";
import type { PlatformKey, Post } from "../../types/insights";
import { BestTimeBigCard } from "./BestTimeBigCard";
import { InstagramBigCard } from "./InstagramBigCard";
import { PlatformSwitcher } from "./PlatformSwitcher";

export function BestTimeSection({
  posts,
  loading,
}: {
  posts: Post[];
  loading: boolean;
}) {
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("tiktok");
  const accent = PLATFORM_THEMES[activePlatform].accent;

  const platformPosts = useMemo(
    () =>
      posts.filter((p) => p.platform?.toLowerCase() === activePlatform),
    [posts, activePlatform],
  );

  return (
    <section
      id="time-signals"
      aria-labelledby="time-signals-heading"
      className="space-y-4 sm:space-y-6"
    >
      <div className="flex flex-col justify-between gap-5 border-t border-signal-border pt-10 sm:flex-row sm:items-end sm:pt-14">
        <div className="w-full sm:w-auto">
          <div
            className="mb-3 flex items-center gap-3 font-signal-mono text-[10px] uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            <span>04</span>
            <span
              className="h-px w-8"
              aria-hidden="true"
              style={{ backgroundColor: accent }}
            />
            Time signals · SGT
          </div>
          <h2
            id="time-signals-heading"
            className="font-signal-display text-3xl font-semibold sm:text-4xl"
            style={{ color: accent }}
          >
            When to post
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-signal-muted sm:text-base">
            Darker cells indicate stronger historical performance. Accent
            markers show your published posts.
          </p>
        </div>
        <PlatformSwitcher
          active={activePlatform}
          onChange={setActivePlatform}
        />
      </div>

      {activePlatform === "instagram" ? (
        <InstagramBigCard posts={platformPosts} />
      ) : (
        <BestTimeBigCard
          platform={activePlatform}
          posts={platformPosts}
          loading={loading}
        />
      )}
    </section>
  );
}
