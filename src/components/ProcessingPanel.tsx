import type { JobInfo, Label } from "@/lib/types";
import { getPartner } from "@/lib/partners";
import { useCountUp } from "./bits";
import { IconAlert, IconCheck, IconFile, IconScan, IconSpinner, IconX } from "./icons";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StateBadge({ job }: { job: JobInfo }) {
  switch (job.state) {
    case "queued":
      return <span className="chip !cursor-default !text-ink2">in queue</span>;
    case "reading":
      return (
        <span className="chip !cursor-default !border-ink/40 !text-ink">
          <IconSpinner className="text-sm" /> reading
        </span>
      );
    case "scanning":
      return (
        <span className="chip anim-pulse-soft !cursor-default !border-amberdeep/50 !bg-[#fdf3d8] !text-amberdeep">
          <IconScan className="text-sm" /> OCR scan
        </span>
      );
    case "done":
      return (
        <span className="chip !cursor-default !border-okgreen/40 !bg-[#e4f2e9] !text-okgreen">
          <IconCheck className="text-sm" /> sorted
        </span>
      );
    case "cancelled":
      return (
        <span className="chip !cursor-default !text-ink2">
          <IconX className="text-sm" /> cancelled
        </span>
      );
    case "error":
      return (
        <span className="chip !cursor-default !border-danger/40 !bg-[#f9e6e2] !text-danger">
          <IconAlert className="text-sm" /> unreadable
        </span>
      );
  }
}

export function ProcessingPanel({
  jobs,
  labels,
  donePages,
  totalPages,
  onCancel,
}: {
  jobs: JobInfo[];
  labels: Label[];
  donePages: number;
  totalPages: number;
  onCancel: () => void;
}) {
  const pct = totalPages > 0 ? Math.min(100, Math.round((donePages / totalPages) * 100)) : 0;
  const shownPct = useCountUp(pct, 400);
  const doneLabels = useCountUp(donePages, 400);

  return (
    <section className="anim-rise overflow-hidden rounded-lg border-2 border-ink bg-card shadow-[10px_10px_0_rgba(32,28,20,0.12)]">
      <div className="belt h-3" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-amberdeep">
              Sorting in progress
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {doneLabels}
              <span className="text-ink2"> / {totalPages || "…"} pages read</span>
            </h2>
          </div>
          <button className="btn-outline btn-sm h-9" onClick={onCancel}>
            <IconX /> Cancel
          </button>
        </div>

        <div className="mt-5">
          <div className="flex items-baseline justify-between font-mono text-xs text-ink2">
            <span>{shownPct}%</span>
            <span>
              {jobs.filter((j) => j.state === "done").length}/{jobs.length} files
            </span>
          </div>
          <div className="mt-1.5 h-3.5 overflow-hidden rounded-full border border-ink/25 bg-paper2">
            <div
              className="progress-stripes h-full rounded-full bg-amber transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <ul className="mt-5 max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line bg-paper/60 thin-scroll">
          {jobs.map((job) => {
            const jobLabels = labels.filter((l) => l.jobId === job.id);
            const byPartner = new Map<string, number>();
            for (const l of jobLabels) byPartner.set(l.partnerId, (byPartner.get(l.partnerId) ?? 0) + 1);
            return (
              <li key={job.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                <IconFile className="shrink-0 text-lg text-ink2" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{job.name}</p>
                  <p className="font-mono text-[11px] text-ink2">
                    {fmtSize(job.size)}
                    {job.pages > 0 && ` · ${job.pages} page${job.pages > 1 ? "s" : ""}`}
                    {job.state === "error" && job.error && ` · ${job.error}`}
                  </p>
                </div>
                {jobLabels.length > 0 && (
                  <span className="hidden items-center gap-1 sm:flex">
                    {[...byPartner.entries()].map(([pid, n]) => {
                      const p = getPartner(pid);
                      return (
                        <span
                          key={pid}
                          title={`${p.name}: ${n}`}
                          className="grid h-5 min-w-5 place-items-center rounded-full px-1 font-mono text-[10px] font-semibold"
                          style={{ background: p.colors.tint, color: p.colors.deep }}
                        >
                          {n}
                        </span>
                      );
                    })}
                  </span>
                )}
                <StateBadge job={job} />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
