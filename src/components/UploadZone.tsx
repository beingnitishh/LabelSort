import { useRef, useState, type DragEvent } from "react";
import logoUrl from "@/assets/logo.svg";
import { cn } from "@/utils/cn";
import { IconSpinner, IconUpload } from "./icons";

export function UploadZone({
  onFiles,
  busy,
  compact,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [hovering, setHovering] = useState(false);

  const pick = (list: FileList | null) => {
    if (!list || !list.length) return;
    onFiles(Array.from(list));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setHovering(false);
    if (busy) return;
    pick(e.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload shipping label PDFs"
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        setHovering(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setHovering(false);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border-2 border-dashed border-ink/45 bg-card text-center outline-none transition-all duration-200",
        "hover:border-ink hover:shadow-[8px_8px_0_rgba(32,28,20,0.10)] focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-amber",
        hovering && !busy && "scale-[1.01] border-solid border-amber bg-[#fdf6e3] shadow-[8px_8px_0_rgba(240,164,0,0.25)]",
        busy && "cursor-default opacity-90",
        compact ? "p-4" : "p-8 sm:p-10"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />

      {/* conveyor belt footer */}
      <div className={cn("belt belt-slow absolute inset-x-0 bottom-0 h-2.5", hovering && !busy && "[animation-duration:0.5s]")} />

      {busy ? (
        <div className={cn("flex items-center justify-center gap-3 text-ink2", compact ? "py-1" : "py-8")}>
          <IconSpinner className="text-xl text-amberdeep" />
          <span className="font-semibold">Reading labels… the belt is running</span>
        </div>
      ) : compact ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink/70 bg-paper text-ink transition-transform duration-200 group-hover:-translate-y-0.5">
            <IconUpload className="text-base" />
          </span>
          <div className="text-left">
            <p className="font-display text-base font-bold leading-tight">Add more label PDFs</p>
            <p className="text-xs text-ink2">Drop files anywhere in this box, or click to browse</p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-md">
          <div className="relative mx-auto flex w-fit">
            <span
              className={cn(
                "grid h-20 w-20 place-items-center overflow-hidden rounded-lg border-2 border-ink bg-paper shadow-[4px_4px_0_rgba(32,28,20,0.9)] transition-transform duration-200",
                hovering ? "-translate-y-1 rotate-3" : "group-hover:-translate-y-1"
              )}
            >
              <img
                src={logoUrl}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-contain p-1"
                draggable={false}
              />
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-amber text-ink shadow-[1px_1px_0_rgba(32,28,20,0.5)]">
              <IconUpload className="text-sm" />
            </span>
          </div>
          <p className="mt-5 font-display text-2xl font-bold leading-snug sm:text-[1.7rem]">
            {hovering ? "Let go — we'll take it from here" : "Drop your label PDFs here"}
          </p>
          <p className="mt-2 text-sm text-ink2">
            or <span className="font-semibold text-ink underline decoration-amber decoration-2 underline-offset-2">browse your device</span> — multiple
            files and multi-page PDFs welcome
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wider text-ink2">
            <span className="rounded border border-line bg-paper px-2 py-1">.pdf only</span>
            <span className="rounded border border-line bg-paper px-2 py-1">scans ok — OCR built in</span>
            <span className="rounded border border-line bg-paper px-2 py-1">stays on device</span>
          </div>
        </div>
      )}
    </div>
  );
}
