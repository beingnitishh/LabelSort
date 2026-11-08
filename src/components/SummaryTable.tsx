import type { Group } from "@/lib/types";
import { UNKNOWN_ID } from "@/lib/partners";
import { Reveal, useCountUp } from "./bits";
import { IconArchive, IconDownload, IconPrinter, IconSpinner } from "./icons";

function CountCell({ n }: { n: number }) {
  const v = useCountUp(n);
  return <span className="font-mono text-sm font-bold">{v}</span>;
}

export function SummaryTable({
  groups,
  total,
  onGroupPdf,
  onGroupZip,
  onGroupPrint,
  onAllZip,
  onAllPrint,
  zipping,
}: {
  groups: Group[];
  total: number;
  onGroupPdf: (g: Group) => void;
  onGroupZip: (g: Group) => void;
  onGroupPrint: (g: Group) => void;
  onAllZip: () => void;
  onAllPrint: () => void;
  zipping: string | null;
}) {
  const max = Math.max(1, ...groups.map((g) => g.labels.length));

  return (
    <Reveal>
      <div className="overflow-hidden rounded-lg border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">Sorting manifest</h2>
          <span className="font-mono text-[11px] uppercase tracking-wider text-ink2">
            {total} labels · {groups.length} bin{groups.length !== 1 && "s"}
          </span>
        </div>

        <div className="overflow-x-auto thin-scroll">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-ink2">
                <th className="px-4 py-2.5 text-left font-semibold">Delivery partner</th>
                <th className="px-4 py-2.5 text-left font-semibold">Labels</th>
                <th className="hidden px-4 py-2.5 text-left font-semibold md:table-cell">Share</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isUnknown = g.partner.id === UNKNOWN_ID;
                const share = total > 0 ? Math.round((g.labels.length / total) * 100) : 0;
                return (
                  <tr
                    key={g.partner.id}
                    className="group/row cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-paper/70"
                    onClick={() => document.getElementById(`group-${g.partner.id}`)?.scrollIntoView({ behavior: "smooth" })}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="h-3.5 w-3.5 shrink-0 rounded-[4px] border border-ink/20"
                          style={{ background: g.partner.colors.solid }}
                        />
                        <span className="font-semibold">{g.partner.name}</span>
                        {isUnknown && (
                          <span className="rounded bg-amber/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amberdeep">
                            review
                          </span>
                        )}
                        <span className="hidden font-mono text-[11px] text-ink2 sm:inline">{g.partner.code}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <CountCell n={g.labels.length} />
                        <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-paper2 lg:block">
                          <span
                            className="block h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${(g.labels.length / max) * 100}%`, background: g.partner.colors.solid }}
                          />
                        </span>
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-ink2 md:table-cell">{share}%</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center justify-end gap-1">
                        <button
                          className="icon-btn"
                          title={`Download ${g.partner.name} labels as one PDF`}
                          onClick={() => onGroupPdf(g)}
                        >
                          <IconDownload className="text-sm" />
                        </button>
                        <button
                          className="icon-btn"
                          title={`Download ${g.partner.name} labels as ZIP folder`}
                          onClick={() => onGroupZip(g)}
                          disabled={zipping === g.partner.id}
                        >
                          {zipping === g.partner.id ? <IconSpinner className="text-sm" /> : <IconArchive className="text-sm" />}
                        </button>
                        <button
                          className="icon-btn"
                          title={`Print ${g.partner.name} labels`}
                          onClick={() => onGroupPrint(g)}
                        >
                          <IconPrinter className="text-sm" />
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink bg-paper/80">
                <td className="px-4 py-3 font-display font-bold">Total</td>
                <td className="px-4 py-3">
                  <CountCell n={total} />
                </td>
                <td className="hidden px-4 py-3 font-mono text-xs text-ink2 md:table-cell">100%</td>
                <td className="px-4 py-3">
                  <span className="flex items-center justify-end gap-2">
                    <button
                      className="btn-outline btn-sm"
                      onClick={onAllZip}
                      disabled={zipping === "all"}
                      title="Download every bin as a ZIP with one folder per partner"
                    >
                      {zipping === "all" ? <IconSpinner className="text-sm" /> : <IconArchive className="text-sm" />} ZIP all
                    </button>
                    <button className="btn-amber btn-sm" onClick={onAllPrint} title="Print every label, grouped">
                      <IconPrinter className="text-sm" /> Print all
                    </button>
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Reveal>
  );
}
