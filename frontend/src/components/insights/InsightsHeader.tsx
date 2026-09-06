// src/components/insights/InsightsHeader.tsx

export function InsightsHeader() {
  return (
    <header className="border-b border-signal-border pb-10 sm:pb-14">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-5 flex items-center gap-3 font-signal-mono text-[10px] uppercase tracking-[0.18em] text-signal-muted sm:text-[11px]">
            <span className="h-0.5 w-8 bg-signal-coral" aria-hidden="true" />
            Signals at a glance
          </div>
          <h1 className="max-w-3xl font-signal-display text-4xl font-semibold leading-[0.95] tracking-[-0.04em] text-signal-text sm:text-6xl">
            Insights &amp;{" "}
            <span className="text-signal-cyan">performance</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-signal-muted sm:text-lg">
            Read the audience, compare what landed, then choose when to post.
          </p>
        </div>
        <div className="border-l-2 border-signal-cyan pl-4 font-signal-mono text-[10px] uppercase tracking-[0.12em] text-signal-muted sm:max-w-sm">
          <span className="text-signal-text">Top-post cohort</span>
          <span className="mx-2 text-signal-slate">•</span>
          all available loaded data
          <span className="mx-2 text-signal-slate">•</span>
          4 platforms
        </div>
      </div>
    </header>
  );
}
