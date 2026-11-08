import { useState } from "react";
import type { Group, Label } from "@/lib/types";
import { PARTNERS, UNKNOWN_ID } from "@/lib/partners";
import { Reveal } from "./bits";
import { LabelCard } from "./LabelCard";
import { IconAlert, IconArchive, IconDownload, IconPrinter, IconSpinner, IconTruck } from "./icons";

export function PartnerGroup({
  group,
  onGroupPdf,
  onGroupZip,
  onGroupPrint,
  onReassign,
  onRemove,
  onDownloadLabel,
  onPrintLabel,
  onCopy,
  onBulkAssign,
  busyZip,
}: {
  group: Group;
  onGroupPdf: (g: Group) => void;
  onGroupZip: (g: Group) => void;
  onGroupPrint: (g: Group) => void;
  onReassign: (labelId: string, partnerId: string) => void;
  onRemove: (labelId: string) => void;
  onDownloadLabel: (l: Label) => void;
  onPrintLabel: (l: Label) => void;
  onCopy: (text: string) => void;
  onBulkAssign: (partnerId: string) => void;
  busyZip: boolean;
}) {
  const { partner, visible } = group;
  const isUnknown = partner.id === UNKNOWN_ID;
  const [bulkTarget, setBulkTarget] = useState(PARTNERS[0].id);
  const c = partner.colors;

  return (
    <Reveal>
      <section
        id={`group-${partner.id}`}
        className="scroll-mt-28 overflow-hidden rounded-lg border border-line bg-card"
        style={{ borderLeft: `6px solid ${c.solid}` }}
      >
        <header
          className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3"
          style={{ background: c.tint }}
        >
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md font-mono text-xs font-bold text-paper shadow-[2px_2px_0_rgba(32,28,20,0.35)]"
            style={{ background: c.solid }}
          >
            {isUnknown ? <IconAlert className="text-lg" /> : partner.code}
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold leading-tight sm:text-xl" style={{ color: c.deep }}>
              {partner.name}
            </h3>
            <p className="truncate font-mono text-[11px] text-ink2">
              {isUnknown ? "could not auto-detect the courier" : `also matches: ${partner.aliases.join(" · ")}`}
            </p>
          </div>
          <span
            className="ml-1 rounded-full px-2.5 py-1 font-mono text-xs font-bold"
            style={{ background: c.solid, color: "#fffdf6" }}
          >
            {visible.length} label{visible.length !== 1 && "s"}
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              className="btn-outline btn-sm bg-card"
              onClick={() => onGroupPdf(group)}
              title={`Download all ${partner.name} labels as one PDF`}
            >
              <IconDownload /> PDF
            </button>
            <button
              className="btn-outline btn-sm hidden bg-card sm:inline-flex"
              onClick={() => onGroupZip(group)}
              disabled={busyZip}
              title={`Download ${partner.name} labels as a ZIP folder`}
            >
              {busyZip ? <IconSpinner /> : <IconArchive />} ZIP
            </button>
            <button
              className="btn btn-sm bg-ink text-paper shadow-[0_2px_0_rgba(0,0,0,0.25)] hover:bg-[#3b3424]"
              onClick={() => onGroupPrint(group)}
              title={`Print all ${partner.name} labels`}
            >
              <IconPrinter /> Print
            </button>
          </div>
        </header>

        {isUnknown && (
          <div className="flex flex-wrap items-center gap-2 border-b border-amber/60 bg-[#fdf3d8] px-4 py-2.5">
            <IconAlert className="text-base text-amberdeep" />
            <p className="text-xs font-medium text-amberdeep">
              These labels didn't match any known courier. Pick a partner below, or assign each one individually.
            </p>
            <div className="ml-auto flex items-center gap-1.5">
              <select
                value={bulkTarget}
                onChange={(e) => setBulkTarget(e.target.value)}
                className="h-8 cursor-pointer rounded border border-ink/30 bg-white px-2 text-xs font-medium outline-none focus:border-ink"
                aria-label="Partner to assign to all unknown labels"
              >
                {PARTNERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                className="btn-amber btn-sm"
                onClick={() => onBulkAssign(bulkTarget)}
                disabled={visible.length === 0}
              >
                <IconTruck /> Assign all
              </button>
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink2">No labels match your search in this bin.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((label, i) => (
              <LabelCard
                key={label.id}
                label={label}
                partner={partner}
                index={i}
                onReassign={onReassign}
                onRemove={onRemove}
                onDownload={onDownloadLabel}
                onPrint={onPrintLabel}
                onCopy={onCopy}
              />
            ))}
          </div>
        )}
      </section>
    </Reveal>
  );
}
