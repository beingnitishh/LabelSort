import type { Label, Partner } from "@/lib/types";
import { PARTNERS, UNKNOWN_ID } from "@/lib/partners";
import { Reveal } from "./bits";
import { IconCopy, IconDownload, IconPrinter, IconScan, IconTrash } from "./icons";

export function LabelCard({
  label,
  partner,
  index,
  onReassign,
  onRemove,
  onDownload,
  onPrint,
  onCopy,
}: {
  label: Label;
  partner: Partner;
  index: number;
  onReassign: (labelId: string, partnerId: string) => void;
  onRemove: (labelId: string) => void;
  onDownload: (label: Label) => void;
  onPrint: (label: Label) => void;
  onCopy: (text: string) => void;
}) {
  const isUnknown = label.partnerId === UNKNOWN_ID;

  return (
    <Reveal delay={Math.min(index, 8) * 45} className="h-full">
      <article
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-card transition-all duration-200 hover:-translate-y-1 hover:border-ink/40 hover:shadow-[6px_6px_0_rgba(32,28,20,0.12)]"
        style={{ borderTop: isUnknown ? undefined : `4px solid ${partner.colors.solid}` }}
      >
        {isUnknown && (
          <div
            className="h-1.5 w-full"
            style={{
              background:
                "repeating-linear-gradient(-45deg, #f0a400 0 10px, #201c14 10px 20px)",
            }}
          />
        )}

        <div className="relative border-b border-line bg-white">
          <img
            src={label.thumb}
            alt={`Shipping label, page ${label.pageIndex + 1} of ${label.fileName}`}
            loading="lazy"
            className="aspect-[7/9] w-full object-cover object-top"
          />
          <span
            className="absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide"
            style={{ background: partner.colors.tint, color: partner.colors.deep }}
          >
            {partner.code}
          </span>
          {label.ocrUsed && (
            <span
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-ink/85 px-1.5 py-0.5 font-mono text-[10px] font-medium text-paper"
              title="Text was read with OCR (scanned label)"
            >
              <IconScan className="text-[11px]" /> OCR
            </span>
          )}
          {label.manual && (
            <span className="absolute bottom-2 left-2 rounded bg-amber px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink">
              manual
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex items-center gap-1">
            <span className="truncate font-mono text-xs font-semibold" title={label.awb || "No AWB detected"}>
              {label.awb || "AWB —"}
            </span>
            {label.awb && (
              <button
                className="icon-btn ml-auto h-6 w-6"
                title="Copy AWB number"
                onClick={() => onCopy(label.awb)}
              >
                <IconCopy className="text-xs" />
              </button>
            )}
          </div>

          <p className="truncate text-[11px] text-ink2" title={`Order ${label.orderId || "not detected"} · ${label.fileName}`}>
            {label.orderId ? `Order ${label.orderId}` : "Order not detected"}
            {label.pageCount > 1 && ` · p.${label.pageIndex + 1}/${label.pageCount}`}
          </p>

          <label className="mt-auto block">
            <span className="sr-only">Assign delivery partner</span>
            <select
              value={label.partnerId}
              onChange={(e) => onReassign(label.id, e.target.value)}
              className="h-8 w-full cursor-pointer rounded border border-line bg-white px-2 text-xs font-medium outline-none transition-colors focus:border-ink"
              style={isUnknown ? { borderColor: "#f0a400", background: "#fdf6e3" } : undefined}
            >
              <option value={UNKNOWN_ID}>Not sure — needs review</option>
              {PARTNERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-end gap-0.5 border-t border-line pt-2">
            <button className="icon-btn" title="Download this label as PDF" onClick={() => onDownload(label)}>
              <IconDownload className="text-sm" />
            </button>
            <button className="icon-btn" title="Print this label" onClick={() => onPrint(label)}>
              <IconPrinter className="text-sm" />
            </button>
            <button
              className="icon-btn hover:!bg-danger/10 hover:!text-danger"
              title="Remove this label"
              onClick={() => onRemove(label.id)}
            >
              <IconTrash className="text-sm" />
            </button>
          </div>
        </div>
      </article>
    </Reveal>
  );
}
