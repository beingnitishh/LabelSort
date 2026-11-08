export type JobState =
  | "queued"
  | "reading"
  | "scanning"
  | "done"
  | "error"
  | "cancelled";

export interface JobInfo {
  id: string;
  name: string;
  size: number;
  pages: number;
  state: JobState;
  error?: string;
}

export interface Label {
  id: string;
  jobId: string;
  fileName: string;
  fileKey: string;
  pageIndex: number;
  pageCount: number;
  text: string;
  ocrUsed: boolean;
  thumb: string;
  partnerId: string;
  manual: boolean;
  awb: string;
  orderId: string;
}

export interface Group {
  partner: Partner;
  labels: Label[];
  visible: Label[];
}

export interface HistoryEntry {
  ts: number;
  total: number;
  partners: number;
  note: string;
}

export type ToastKind = "success" | "error" | "warn" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  msg: string;
}

export interface Partner {
  id: string;
  name: string;
  code: string;
  aliases: string[];
  patterns: RegExp[];
  colors: { solid: string; tint: string; deep: string };
}
