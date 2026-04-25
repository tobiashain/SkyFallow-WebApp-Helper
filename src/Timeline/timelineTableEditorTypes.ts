import type { Condition } from "../types";

export interface TimelineConditions {
  day_from?: number;
  hour_range?: [number, number];
  seen_first?: string;
  condition?: Condition | null;
}

export interface TimelineEntry {
  timeline: string;
  weight: number;
  conditions: TimelineConditions;
}

export interface ExportedTimelineEntry {
  timeline: string;
  weight: number;
  condition?: Condition | null;
}

export interface TimelineTableFile {
  timeline_table: Record<string, TimelineEntry[] | ExportedTimelineEntry[]>;
  fallback_table: Record<string, string[]>;
}
