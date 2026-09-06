// src/components/insights/PlatformSwitcher.tsx
import { PLATFORM_TABS, PLATFORM_THEMES } from "../../constants/insights";
import type { PlatformKey } from "../../types/insights";
import { PlatformIcon } from "./PlatformIcon";

export function PlatformSwitcher({
  active,
  onChange,
}: {
  active: PlatformKey;
  onChange: (p: PlatformKey) => void;
}) {
  return (
    <div
      className="w-full overflow-x-auto pb-1 sm:w-auto"
      role="tablist"
      aria-label="Best time platform"
    >
      <div className="inline-flex min-w-max items-stretch gap-1 border-b border-signal-border">
        {PLATFORM_TABS.map((p) => {
          const theme = PLATFORM_THEMES[p.key];
          const isActive = active === p.key;

          return (
            <button
              key={p.key}
              id={`timing-tab-${p.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(p.key)}
              className={`relative flex min-h-11 items-center gap-2 px-3 text-xs font-semibold transition-colors focus-visible:outline-none sm:px-4 ${isActive
                ? "text-signal-text"
                : "text-signal-muted hover:text-signal-text"
                }`}
              style={{ color: isActive ? theme.accent : undefined }}
            >
              <PlatformIcon name={p.key} />
              {p.label}
              <span
                aria-hidden="true"
                className="absolute inset-x-2 bottom-0 h-0.5"
                style={{
                  backgroundColor: isActive ? theme.accent : "transparent",
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
