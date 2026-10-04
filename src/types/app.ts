import type { RankedCandidate, ResumeItem } from "../lib/ranking";

export type PageKey = "dashboard" | "analysis" | "candidates" | "how-it-works" | "settings";
export type SortKey = "rank" | "final" | "keyword" | "semantic" | "experience" | "impact" | "years" | "reqFit";
export type SortDir = "asc" | "desc";
export interface AppState {
  page: PageKey;
  jdText: string;
  jdPdfText: string;
  resumeItems: ResumeItem[];
  ranked: RankedCandidate[];
}
