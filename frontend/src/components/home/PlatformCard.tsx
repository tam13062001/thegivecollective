// src/components/home/PlatformCard.tsx
// A single connected platform's latest snapshot (followers/posts/views) with
// a delete action, shown in the Homepage's platform grid.
import { X } from "lucide-react";
import { PlatformIcon } from "../common/PlatformIcon";
import { fmtNum } from "../../utils/insights";
import type { PlatformMetric } from "../../types/home";

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-signal-mono text-[9px] uppercase tracking-wide text-signal-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-signal-text">{value}</p>
    </div>
  );
}

export function PlatformCard({
  metric,
  onDelete,
}: {
  metric: PlatformMetric;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="signal-panel relative rounded-2xl border border-signal-border p-5">
      <button
        type="button"
        onClick={() => onDelete(metric._id)}
        aria-label={`Remove ${metric.platformName}`}
        title="Delete"
        className="absolute right-4 top-4 text-signal-muted transition-colors hover:text-signal-coral"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <div className="mb-4 flex items-center gap-2.5">
        <PlatformIcon name={metric.platformName} />
        <div>
          <h3 className="text-sm font-semibold leading-tight text-signal-text">
            {metric.platformName}
          </h3>
          <a
            href={metric.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-signal-muted transition-colors hover:text-signal-cyan"
          >
            {metric.accountHandle} ↗
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border border-signal-border bg-signal-track p-3 text-center">
        <MetricTile label="Followers" value={fmtNum(metric.followersCount ?? 0)} />
        <div className="border-x border-signal-border">
          <MetricTile label="Posts" value={fmtNum(metric.postsCount ?? 0)} />
        </div>
        <MetricTile label="Views" value={fmtNum(metric.viewsCount ?? 0)} />
      </div>
    </div>
  );
}
