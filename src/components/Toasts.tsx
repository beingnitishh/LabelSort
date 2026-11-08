import type { ToastItem, ToastKind } from "@/lib/types";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";

const KIND_STYLE: Record<ToastKind, { bar: string; icon: string }> = {
  success: { bar: "bg-okgreen", icon: "text-okgreen" },
  error: { bar: "bg-danger", icon: "text-danger" },
  warn: { bar: "bg-amber", icon: "text-amberdeep" },
  info: { bar: "bg-ink", icon: "text-ink" },
};

function KindIcon({ kind, className }: { kind: ToastKind; className?: string }) {
  if (kind === "success") return <IconCheck className={className} />;
  if (kind === "info") return <IconInfo className={className} />;
  return <IconAlert className={className} />;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const s = KIND_STYLE[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className="anim-toast pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-md border-2 border-ink bg-card py-3 pl-4 pr-9 shadow-[5px_5px_0_rgba(32,28,20,0.18)]"
          >
            <span className={`absolute inset-y-0 left-0 w-1.5 ${s.bar}`} />
            <KindIcon kind={t.kind} className={`mt-0.5 shrink-0 text-base ${s.icon}`} />
            <p className="text-sm font-medium leading-snug">{t.msg}</p>
            <button
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded text-ink2 transition-colors hover:bg-ink/5 hover:text-ink"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <IconX className="text-xs" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
