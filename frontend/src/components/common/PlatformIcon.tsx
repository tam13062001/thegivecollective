// src/components/common/PlatformIcon.tsx

const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  tiktok: { bg: "bg-black", label: "TK" },
  facebook: { bg: "bg-blue-600", label: "FB" },
  instagram: { bg: "bg-pink-500", label: "IG" },
  twitter: { bg: "bg-sky-500", label: "TW" },
  youtube: { bg: "bg-red-600", label: "YT" },
  linkedin: { bg: "bg-blue-700", label: "LI" },
  threads: { bg: "bg-gray-800", label: "TH" },
};

export function PlatformIcon({ name }: { name: string }) {
  const p = PLATFORM_BADGES[name.toLowerCase()] ?? {
    bg: "bg-slate-500",
    label: name.slice(0, 2).toUpperCase(),
  };

  return (
    <span
      role="img"
      aria-label={`${name} platform`}
      title={name}
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white sm:h-7 sm:w-7 sm:text-[10px] ${p.bg}`}
    >
      {p.label}
    </span>
  );
}
