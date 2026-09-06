// src/components/insights/ContentTypeBadge.tsx
import { CircleDot, FileText, Image as ImageIcon, Layers3, Video } from "lucide-react";
import { CONTENT_TYPE_META } from "../../constants/insights";
import type { ContentType } from "../../types/insights";

export function ContentTypeGlyph({ type }: { type: ContentType }) {
  const Icon =
    type === "video"
      ? Video
      : type === "image"
        ? ImageIcon
        : type === "carousel"
          ? Layers3
          : type === "text"
            ? FileText
            : CircleDot;

  return <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={2.2} />;
}

export function ContentTypeBadge({ type }: { type: ContentType }) {
  const meta = CONTENT_TYPE_META[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border border-signal-border bg-signal-track px-1.5 py-0.5 text-[9px] font-semibold text-signal-muted sm:text-[10px]"
      title={meta.label}
    >
      <ContentTypeGlyph type={type} />
      {meta.label}
    </span>
  );
}
