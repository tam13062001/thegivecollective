// src/components/home/HomeTabs.tsx
// Underline tab switcher for the Homepage's content sections, matching
// InsightsPage's PlatformSwitcher visual language.
import type { HomeTabKey } from "../../types/home";

export function HomeTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: HomeTabKey; label: string }[];
  active: HomeTabKey;
  onChange: (key: HomeTabKey) => void;
}) {
  return (
    <div
      className="w-full overflow-x-auto pb-1 sm:w-auto"
      role="tablist"
      aria-label="Homepage sections"
    >
      <div className="inline-flex min-w-max items-stretch gap-1 border-b border-signal-border">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              id={`home-tab-${tab.key}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.key)}
              className={`relative flex min-h-11 items-center gap-2 px-3 text-xs font-semibold transition-colors focus-visible:outline-none sm:px-4 ${isActive
                ? "text-signal-text"
                : "text-signal-muted hover:text-signal-text"
                }`}
            >
              {tab.label}
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 bottom-0 h-0.5 sm:inset-x-3 ${isActive ? "bg-signal-coral" : "bg-transparent"
                  }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
