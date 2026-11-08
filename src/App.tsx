import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group, HistoryEntry, JobInfo, Label, ToastItem, ToastKind } from "@/lib/types";
import { PARTNERS, UNKNOWN_ID, getPartner } from "@/lib/partners";
import { runBatch, type BatchCallbacks } from "@/lib/processing";
import {
  allZip,
  clearDocCache,
  downloadBlob,
  groupZip,
  labelFileName,
  mergedPdf,
  printBlob,
  singleLabelPdf,
} from "@/lib/exports";
import { makeDemoFiles } from "@/lib/demo";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingPanel } from "@/components/ProcessingPanel";
import { SummaryTable } from "@/components/SummaryTable";
import { PartnerGroup } from "@/components/PartnerGroup";
import { ToastStack } from "@/components/Toasts";
import { ConfirmModal, Reveal, useCountUp } from "@/components/bits";
import {
  IconAlert,
  IconArchive,
  IconBarcode,
  IconBox,
  IconChevronDown,
  IconPrinter,
  IconRefresh,
  IconScan,
  IconSearch,
  IconSpark,
  IconSpinner,
  IconTruck,
  IconUpload,
} from "@/components/icons";

type Phase = "idle" | "working" | "done";

const HISTORY_KEY = "labelsort.history.v1";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 4)));
  } catch {
    /* storage unavailable */
  }
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString();
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Stat({ n, label, warn }: { n: number; label: string; warn?: boolean }) {
  const v = useCountUp(n);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        warn && n > 0 ? "border-amberdeep/50 bg-[#fdf3d8] text-amberdeep" : "border-line bg-card text-ink"
      }`}
    >
      <span className="font-mono text-sm font-bold">{v}</span> {label}
    </span>
  );
}

function SideBarcode() {
  const bars = [5, 2, 7, 3, 2, 9, 2, 4, 6, 2, 8, 3, 2, 5, 3, 7, 2, 4];
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed right-4 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-[5px] opacity-[0.08] xl:flex"
    >
      {bars.map((w, i) => (
        <span key={i} className="h-[7px] rounded-sm bg-ink" style={{ width: `${w * 9}px` }} />
      ))}
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [labels, setLabels] = useState<Label[]>([]);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [query, setQuery] = useState("");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [zipping, setZipping] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  const bytesRef = useRef(new Map<string, ArrayBuffer>());
  const cancelledRef = useRef(false);
  const labelsRef = useRef<Label[]>([]);
  const toastSeq = useRef(0);

  useEffect(() => {
    labelsRef.current = labels;
  }, [labels]);

  const toast = useCallback((kind: ToastKind, msg: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  /* ---------------- batch intake ---------------- */

  const startBatch = useCallback(
    async (files: File[]) => {
      const pdfs = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === "application/pdf");
      const rejected = files.length - pdfs.length;
      if (rejected > 0)
        toast("warn", `${rejected} file${rejected > 1 ? "s" : ""} skipped — only PDF labels are supported.`);
      if (pdfs.length === 0) return;

      cancelledRef.current = false;
      setPhase("working");
      setProgress({ done: 0, total: 0 });

      const cb: BatchCallbacks = {
        onJobs: (js) => setJobs((prev) => [...prev, ...js]),
        onJob: (id, patch) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j))),
        onLabel: (l) => setLabels((prev) => [...prev, l]),
        onTotalPages: (n) => setProgress((p) => ({ ...p, total: p.total + n })),
        onPageDone: () => setProgress((p) => ({ ...p, done: p.done + 1 })),
        isCancelled: () => cancelledRef.current,
      };

      await runBatch(pdfs, bytesRef.current, cb);

      const all = labelsRef.current;
      const partnersSeen = new Set(all.map((l) => l.partnerId));
      const unknowns = all.filter((l) => l.partnerId === UNKNOWN_ID).length;

      if (cancelledRef.current) {
        toast("info", all.length ? "Cancelled — kept everything read so far." : "Cancelled before any label was read.");
      } else {
        const newOnes = all.length;
        toast(
          unknowns > 0 ? "warn" : "success",
          unknowns > 0
            ? `Sorted ${newOnes} labels into ${partnersSeen.size - (partnersSeen.has(UNKNOWN_ID) ? 1 : 0)} partner${
                partnersSeen.size > 2 ? "s" : ""
              } — ${unknowns} need${unknowns > 1 ? "" : "s"} a manual look.`
            : `All ${newOnes} labels sorted into ${partnersSeen.size} partner bin${partnersSeen.size > 1 ? "s" : ""}.`
        );
        if (newOnes > 0) {
          const entry: HistoryEntry = {
            ts: Date.now(),
            total: newOnes,
            partners: partnersSeen.size,
            note: pdfs.length === 1 ? pdfs[0].name : `${pdfs.length} files`,
          };
          setHistory((h) => {
            const next = [entry, ...h].slice(0, 4);
            saveHistory(next);
            return next;
          });
        }
      }
      setPhase(all.length > 0 ? "done" : "idle");
    },
    [toast]
  );

  const cancelBatch = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const resetAll = useCallback(() => {
    setLabels([]);
    setJobs([]);
    setProgress({ done: 0, total: 0 });
    setQuery("");
    setPhase("idle");
    setZipping(null);
    setPrinting(false);
    bytesRef.current.clear();
    clearDocCache();
  }, []);

  const loadDemo = useCallback(async () => {
    toast("info", "Generating 12 sample labels across 7 files…");
    try {
      const files = await makeDemoFiles();
      await startBatch(files);
    } catch {
      toast("error", "Could not generate the sample batch.");
    }
  }, [startBatch, toast]);

  /* ---------------- grouping ---------------- */

  const groupsAll = useMemo<Group[]>(() => {
    const map = new Map<string, Label[]>();
    for (const l of labels) {
      const arr = map.get(l.partnerId);
      if (arr) arr.push(l);
      else map.set(l.partnerId, [l]);
    }
    return [...map.entries()]
      .map(([pid, ls]) => ({ partner: getPartner(pid), labels: ls, visible: ls }))
      .sort((a, b) =>
        a.partner.id === UNKNOWN_ID ? 1 : b.partner.id === UNKNOWN_ID ? -1 : b.labels.length - a.labels.length
      );
  }, [labels]);

  const groupsShown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupsAll;
    return groupsAll
      .map((g) => ({
        ...g,
        visible: g.labels.filter(
          (l) =>
            l.awb.toLowerCase().includes(q) ||
            l.orderId.toLowerCase().includes(q) ||
            l.fileName.toLowerCase().includes(q) ||
            g.partner.name.toLowerCase().includes(q) ||
            g.partner.code.toLowerCase().includes(q)
        ),
      }))
      .filter((g) => g.visible.length > 0);
  }, [groupsAll, query]);

  const unknownCount = useMemo(() => labels.filter((l) => l.partnerId === UNKNOWN_ID).length, [labels]);
  const partnerCount = groupsAll.filter((g) => g.partner.id !== UNKNOWN_ID).length;

  /* ---------------- label actions ---------------- */

  const reassign = useCallback(
    (labelId: string, partnerId: string) => {
      setLabels((prev) => prev.map((l) => (l.id === labelId ? { ...l, partnerId, manual: true } : l)));
      toast("success", `Label moved to ${getPartner(partnerId).name}.`);
    },
    [toast]
  );

  const bulkAssignUnknown = useCallback(
    (partnerId: string) => {
      const n = labelsRef.current.filter((l) => l.partnerId === UNKNOWN_ID).length;
      setLabels((prev) => prev.map((l) => (l.partnerId === UNKNOWN_ID ? { ...l, partnerId, manual: true } : l)));
      toast("success", `Assigned ${n} label${n !== 1 ? "s" : ""} to ${getPartner(partnerId).name}.`);
    },
    [toast]
  );

  const removeLabel = useCallback(
    (labelId: string) => {
      setLabels((prev) => {
        const next = prev.filter((l) => l.id !== labelId);
        if (next.length === 0) {
          setJobs([]);
          setProgress({ done: 0, total: 0 });
          setPhase("idle");
          bytesRef.current.clear();
          clearDocCache();
        }
        return next;
      });
      toast("info", "Label removed from the batch.");
    },
    [toast]
  );

  const copyText = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast("success", `Copied ${text} to clipboard.`);
      } catch {
        toast("error", "Clipboard is not available in this browser.");
      }
    },
    [toast]
  );

  /* ---------------- exports ---------------- */

  const downloadGroupPdf = useCallback(
    async (g: Group) => {
      try {
        const blob = await mergedPdf(g.labels, bytesRef.current);
        downloadBlob(`${slug(g.partner.name)}_${g.labels.length}_labels.pdf`, blob);
        toast("success", `Downloading ${g.labels.length} ${g.partner.name} label${g.labels.length > 1 ? "s" : ""} as one PDF.`);
      } catch (e: any) {
        toast("error", e?.message || "Could not build that PDF.");
      }
    },
    [toast]
  );

  const downloadGroupZip = useCallback(
    async (g: Group) => {
      setZipping(g.partner.id);
      try {
        const blob = await groupZip(g, bytesRef.current);
        downloadBlob(`${slug(g.partner.name)}_${g.labels.length}_labels.zip`, blob);
        toast("success", `ZIP ready — one folder with ${g.labels.length} individual ${g.partner.name} PDFs.`);
      } catch (e: any) {
        toast("error", e?.message || "Could not build that ZIP.");
      } finally {
        setZipping(null);
      }
    },
    [toast]
  );

  const printGroup = useCallback(
    async (g: Group) => {
      setPrinting(true);
      try {
        toast("info", `Bundling ${g.labels.length} ${g.partner.name} label${g.labels.length > 1 ? "s" : ""} for print…`);
        const blob = await mergedPdf(g.labels, bytesRef.current);
        await printBlob(blob);
        toast("success", "Print dialog opened — labels are grouped in one document.");
      } catch (e: any) {
        toast("error", e?.message || "Printing failed.");
      } finally {
        setPrinting(false);
      }
    },
    [toast]
  );

  const downloadAllZip = useCallback(async () => {
    setZipping("all");
    try {
      const blob = await allZip(groupsAll, bytesRef.current);
      const d = new Date().toISOString().slice(0, 10);
      downloadBlob(`meesho_labels_sorted_${d}.zip`, blob);
      toast("success", "ZIP ready — one folder per delivery partner.");
    } catch (e: any) {
      toast("error", e?.message || "Could not build the ZIP.");
    } finally {
      setZipping(null);
    }
  }, [groupsAll, toast]);

  const printAll = useCallback(async () => {
    setPrinting(true);
    try {
      const ordered = groupsAll.flatMap((g) => g.labels);
      toast("info", `Bundling all ${ordered.length} labels for print…`);
      const blob = await mergedPdf(ordered, bytesRef.current);
      await printBlob(blob);
      toast("success", "Print dialog opened — every label, partner by partner.");
    } catch (e: any) {
      toast("error", e?.message || "Printing failed.");
    } finally {
      setPrinting(false);
    }
  }, [groupsAll, toast]);

  const downloadSingle = useCallback(
    async (l: Label) => {
      try {
        const blob = await singleLabelPdf(l, bytesRef.current);
        downloadBlob(labelFileName(l, l.pageIndex), blob);
        toast("success", "Label PDF downloading.");
      } catch (e: any) {
        toast("error", e?.message || "Could not extract that label.");
      }
    },
    [toast]
  );

  const printSingle = useCallback(
    async (l: Label) => {
      setPrinting(true);
      try {
        const blob = await singleLabelPdf(l, bytesRef.current);
        await printBlob(blob);
        toast("success", "Print dialog opened for this label.");
      } catch (e: any) {
        toast("error", e?.message || "Printing failed.");
      } finally {
        setPrinting(false);
      }
    },
    [toast]
  );

  const hasResults = labels.length > 0;

  /* ---------------- render ---------------- */

  return (
    <div className="min-h-screen">
      {/* hazard strip */}
      <div className="belt belt-slow fixed inset-x-0 top-0 z-40 h-1.5" aria-hidden />

      <SideBarcode />

      {/* header */}
      <header className="sticky top-1.5 z-30 border-b-2 border-ink bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <button className="flex items-center gap-2.5" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <span className="grid h-9 w-9 place-items-center rounded-md bg-ink text-amber shadow-[2px_2px_0_rgba(32,28,20,0.3)]">
              <IconBarcode className="text-lg" />
            </span>
            <span className="text-left">
              <span className="block font-display text-lg font-extrabold leading-none tracking-tight">LabelSort</span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.22em] text-ink2">
                meesho label sorter
              </span>
            </span>
          </button>

          {hasResults && (
            <span className="flex flex-wrap items-center gap-1.5">
              <Stat n={labels.length} label="labels" />
              <Stat n={partnerCount} label="partners" />
              {unknownCount > 0 && <Stat n={unknownCount} label="to review" warn />}
            </span>
          )}

          <span className="ml-auto flex flex-wrap items-center gap-2">
            {!hasResults && phase !== "working" && (
              <span className="chip !cursor-default !border-okgreen/40 !bg-[#e4f2e9] !text-okgreen">
                <span className="h-1.5 w-1.5 rounded-full bg-okgreen" /> 100% in-browser
              </span>
            )}
            {hasResults && (
              <>
                <button className="btn-primary btn-sm h-9" onClick={downloadAllZip} disabled={zipping !== null}>
                  {zipping === "all" ? <IconSpinner /> : <IconArchive />} Download all ZIP
                </button>
                <button className="btn-outline btn-sm h-9 hidden sm:inline-flex" onClick={printAll} disabled={printing}>
                  <IconPrinter /> Print all
                </button>
                <button className="btn-ghost btn-sm h-9" onClick={() => setConfirmClear(true)}>
                  <IconRefresh /> New batch
                </button>
              </>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {/* ---------- WORKING ---------- */}
        {phase === "working" && (
          <div className="space-y-4">
            <ProcessingPanel
              jobs={jobs}
              labels={labels}
              donePages={progress.done}
              totalPages={progress.total}
              onCancel={cancelBatch}
            />
            <UploadZone onFiles={startBatch} busy compact />
          </div>
        )}

        {/* ---------- IDLE ---------- */}
        {phase === "idle" && (
          <div className="anim-rise grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:gap-10">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.22em] text-amberdeep">
                // for meesho sellers<span className="blink-cursor ml-1 inline-block h-3.5 w-2 translate-y-0.5 bg-amber" />
              </p>
              <h1 className="mt-4 font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                One pile of labels in.
                <br />
                <span className="relative inline-block">
                  Sorted stacks
                  <span className="absolute inset-x-0 bottom-1 -z-10 h-3.5 -rotate-1 bg-amber" aria-hidden />
                </span>{" "}
                out.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink2">
                Drop in the shipping-label PDFs Meesho gives you. LabelSort reads every page — text layer first, OCR for
                scans — detects the courier, and bins <strong className="text-ink">Shadowfax, Delhivery, XpressBees, Ecom Express</strong>{" "}
                and 13 other partners (Valmo and ValmoPlus share one bin) into print-ready bundles. No uploading to
                servers; everything runs right here.
              </p>

              <div className="mt-7">
                <UploadZone onFiles={startBatch} />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="btn-amber" onClick={loadDemo}>
                  <IconSpark /> Try it — load 12 sample labels
                </button>
                <p className="font-mono text-[11px] text-ink2">free forever · nothing leaves your device</p>
              </div>
            </div>

            {/* right rail */}
            <aside className="space-y-4">
              <Reveal delay={80}>
                <div className="overflow-hidden rounded-lg border border-line bg-card">
                  <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                    <IconTruck className="text-lg text-ink2" />
                    <h2 className="font-display text-base font-bold">Sorting bins</h2>
                    <span className="ml-auto font-mono text-[11px] text-ink2">{PARTNERS.length} couriers</span>
                  </div>
                  <ul className="divide-y divide-line/70">
                    {(legendOpen ? PARTNERS : PARTNERS.slice(0, 7)).map((p) => (
                      <li key={p.id} className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-paper/70">
                        <span className="h-3 w-3 shrink-0 rounded-[3px] border border-ink/20" style={{ background: p.colors.solid }} />
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="ml-auto hidden truncate font-mono text-[10px] text-ink2 sm:block">
                          {p.aliases.slice(0, 2).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <button
                    className="flex w-full items-center justify-center gap-1 border-t border-line py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-ink2 transition-colors hover:bg-paper/70 hover:text-ink"
                    onClick={() => setLegendOpen((v) => !v)}
                  >
                    {legendOpen ? "Show fewer" : `Show all ${PARTNERS.length} partners`}
                    <IconChevronDown className={`transition-transform ${legendOpen ? "rotate-180" : ""}`} />
                  </button>
                </div>
              </Reveal>

              <Reveal delay={160}>
                <div className="rounded-lg border border-line bg-card p-4">
                  <h2 className="font-display text-base font-bold">How the line runs</h2>
                  <ol className="mt-3 space-y-3">
                    {[
                      { icon: <IconUpload />, t: "Feed the belt", d: "Drop any number of label PDFs — multi-page files split automatically." },
                      { icon: <IconScan />, t: "Read & detect", d: "Embedded text is parsed instantly; scanned labels go through on-device OCR." },
                      { icon: <IconBox />, t: "Bin & bundle", d: "Each courier gets its own bin with ZIP folders, merged PDFs and one-tap print." },
                    ].map((s, i) => (
                      <li key={s.t} className="flex gap-3">
                        <span className="flex flex-col items-center">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 border-ink bg-paper text-sm">
                            {s.icon}
                          </span>
                          {i < 2 && <span className="mt-1 w-0.5 flex-1 bg-line" />}
                        </span>
                        <span className="pb-1">
                          <span className="flex items-baseline gap-2">
                            <span className="font-mono text-[10px] font-bold text-amberdeep">0{i + 1}</span>
                            <span className="text-sm font-bold">{s.t}</span>
                          </span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-ink2">{s.d}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </Reveal>

              {history.length > 0 && (
                <Reveal delay={240}>
                  <div className="rounded-lg border border-line bg-card p-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-bold">Recent sorts</h2>
                      <button
                        className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink2 underline-offset-2 hover:text-ink hover:underline"
                        onClick={() => {
                          setHistory([]);
                          saveHistory([]);
                        }}
                      >
                        clear
                      </button>
                    </div>
                    <ul className="mt-2 divide-y divide-line/70">
                      {history.map((h, i) => (
                        <li key={`${h.ts}-${i}`} className="flex items-baseline gap-2 py-1.5 text-xs">
                          <span className="font-mono font-bold text-ink">{h.total}</span>
                          <span className="text-ink2">
                            labels · {h.partners} bin{h.partners > 1 ? "s" : ""}
                          </span>
                          <span className="ml-auto truncate font-mono text-[10px] text-ink2" title={h.note}>
                            {timeAgo(h.ts)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              )}
            </aside>
          </div>
        )}

        {/* ---------- DONE ---------- */}
        {phase === "done" && (
          <div className="space-y-5">
            {/* toolbar */}
            <div className="anim-rise flex flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search AWB, order no, file…"
                  className="h-10 w-full rounded-md border border-line bg-card pl-9 pr-3 text-sm outline-none transition-all placeholder:text-ink2/70 focus:border-ink focus:shadow-[3px_3px_0_rgba(32,28,20,0.08)]"
                />
              </label>

              <div className="flex flex-1 items-center gap-1.5 overflow-x-auto py-1 thin-scroll">
                {groupsAll.map((g) => (
                  <button
                    key={g.partner.id}
                    className="chip shrink-0"
                    onClick={() =>
                      document.getElementById(`group-${g.partner.id}`)?.scrollIntoView({ behavior: "smooth" })
                    }
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: g.partner.colors.solid }} />
                    {g.partner.id === UNKNOWN_ID ? "Unknown" : g.partner.name}
                    <span className="font-mono font-bold">{g.labels.length}</span>
                  </button>
                ))}
              </div>
            </div>

            {unknownCount > 0 && (
              <Reveal>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border-2 border-amberdeep/50 bg-[#fdf3d8] px-4 py-3 text-left transition-transform hover:-translate-y-0.5"
                  onClick={() =>
                    document.getElementById(`group-${UNKNOWN_ID}`)?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  <IconAlert className="shrink-0 text-xl text-amberdeep" />
                  <span className="text-sm font-semibold text-amberdeep">
                    {unknownCount} label{unknownCount > 1 ? "s" : ""} couldn't be matched to a courier — assign{" "}
                    {unknownCount > 1 ? "them" : "it"} manually before printing.
                  </span>
                  <span className="ml-auto font-mono text-xs font-bold uppercase tracking-wider text-amberdeep">
                    review ↓
                  </span>
                </button>
              </Reveal>
            )}

            <SummaryTable
              groups={groupsAll}
              total={labels.length}
              onGroupPdf={downloadGroupPdf}
              onGroupZip={downloadGroupZip}
              onGroupPrint={printGroup}
              onAllZip={downloadAllZip}
              onAllPrint={printAll}
              zipping={zipping}
            />

            {groupsShown.length === 0 ? (
              <div className="rounded-lg border border-line bg-card px-4 py-10 text-center">
                <p className="font-display text-lg font-bold">No labels match “{query}”</p>
                <p className="mt-1 text-sm text-ink2">Try a shorter AWB fragment or clear the search.</p>
                <button className="btn-outline btn-sm mt-4" onClick={() => setQuery("")}>
                  Clear search
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {groupsShown.map((g) => (
                  <PartnerGroup
                    key={g.partner.id}
                    group={g}
                    onGroupPdf={downloadGroupPdf}
                    onGroupZip={downloadGroupZip}
                    onGroupPrint={printGroup}
                    onReassign={reassign}
                    onRemove={removeLabel}
                    onDownloadLabel={downloadSingle}
                    onPrintLabel={printSingle}
                    onCopy={copyText}
                    onBulkAssign={bulkAssignUnknown}
                    busyZip={zipping === g.partner.id}
                  />
                ))}
              </div>
            )}

            <Reveal>
              <UploadZone onFiles={startBatch} compact />
            </Reveal>
          </div>
        )}
      </main>

      {/* partner marquee */}
      <div className="marquee overflow-hidden border-y-2 border-ink bg-ink py-2.5" aria-hidden>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center">
              {PARTNERS.map((p) => (
                <span key={`${dup}-${p.id}`} className="flex items-center font-mono text-xs font-semibold uppercase tracking-[0.2em] text-paper/85">
                  <span className="mx-5 h-2 w-2 rounded-full" style={{ background: p.colors.solid }} />
                  {p.name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* footer */}
      <footer className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-amber text-ink">
                <IconBarcode className="text-lg" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">LabelSort</span>
            </span>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-paper/70">
              Built for Meesho sellers who ship in batches. Reads, sorts and bundles your shipping labels so the
              courier pile never touches the packing table.
            </p>
          </div>
          <div>
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-amber">Privacy</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/70">
              Your labels are processed entirely in this browser tab — parsed with PDF.js, scanned with on-device OCR.
              Nothing is uploaded, stored or tracked.
            </p>
          </div>
          <div>
            <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-amber">Bins covered</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/70">
              {PARTNERS.map((p) => p.name).join(" · ")} — plus anything else, filed under “Unknown” for a quick manual
              sort.
            </p>
          </div>
        </div>
        <div className="border-t border-paper/15">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 font-mono text-[11px] text-paper/50 sm:px-6">
            <span>LabelSort · sorting desk for Indian e-commerce</span>
            <span>AWB numbers stay yours</span>
          </div>
        </div>
      </footer>

      <ConfirmModal
        open={confirmClear}
        title="Start a new batch?"
        body={`This clears all ${labels.length} sorted label${labels.length !== 1 ? "s" : ""} from the desk. Downloaded files are safe — only this session is reset.`}
        confirmLabel="Clear the desk"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          resetAll();
          toast("info", "Desk cleared — drop the next batch whenever you're ready.");
        }}
      />

      <ToastStack toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
