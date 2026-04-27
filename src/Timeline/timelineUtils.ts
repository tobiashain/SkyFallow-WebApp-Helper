import type { Condition } from "../types";
import type {
  TimelineEntry,
  ExportedTimelineEntry,
  TimelineConditions,
} from "./timelineTableEditorTypes";

const SPECIAL_TYPES = [
  "DayFromCondition",
  "HourRangeCondition",
  "SeenFirstCondition",
] as const;

// ---------------------------------------------------------------------------
//  Import helpers – convert external JSON → internal TimelineEntry
// ---------------------------------------------------------------------------

function extractSpecialConditions(cond: Condition | null): {
  extracted: Partial<
    Pick<TimelineConditions, "day_from" | "hour_range" | "seen_first">
  >;
  remainingCondition: Condition | null;
} {
  const extracted: any = {};

  function prune(node: Condition): Condition | null {
    if (SPECIAL_TYPES.includes(node.type as any)) {
      switch (node.type) {
        case "DayFromCondition":
          extracted.day_from = (node as any).day_from;
          break;
        case "HourRangeCondition":
          extracted.hour_range = [
            (node as any).hour_from,
            (node as any).hour_to,
          ] as [number, number];
          break;
        case "SeenFirstCondition":
          extracted.seen_first = (node as any).timeline_id;
          break;
      }
      return null; // remove special node
    }

    if (node.type === "AndCondition" || node.type === "OrCondition") {
      const subs = (node.sub_conditions ?? [])
        .map(prune)
        .filter(Boolean) as Condition[];
      if (subs.length === 0) return null;
      return { ...node, sub_conditions: subs } as Condition;
    }

    if (node.type === "NotCondition") {
      const inner = prune((node as any).condition);
      if (!inner) return null;
      return { ...node, condition: inner } as Condition;
    }

    return node; // ordinary leaf
  }

  const remaining = cond ? prune(cond) : null;
  return { extracted, remainingCondition: remaining };
}

/**
 * Normalise a single entry (from either the old or new external format)
 * into the internal representation.
 */
export function normalizeEntry(
  entry: TimelineEntry | ExportedTimelineEntry,
): TimelineEntry {
  // If it already has a `conditions` property, assume it's already in the internal shape
  // (or it's an old-format entry where the wrappers are still separate).
  if ("conditions" in entry) {
    const c = entry.conditions;
    // Already flat? (day_from/hour_range/seen_first exist)
    if (
      c.day_from !== undefined ||
      c.hour_range ||
      c.seen_first !== undefined
    ) {
      return entry as TimelineEntry;
    }
    // Otherwise 'conditions' only contains 'condition' – extract specials from the tree
    const { extracted, remainingCondition } = extractSpecialConditions(
      c.condition ?? null,
    );
    return {
      ...entry,
      conditions: {
        ...extracted,
        condition: remainingCondition,
      },
      sets_flag: (entry as any).sets_flag || undefined,
    } as TimelineEntry;
  }

  // New external format: `condition` directly on the entry
  const { extracted, remainingCondition } = extractSpecialConditions(
    (entry as ExportedTimelineEntry).condition ?? null,
  );
  return {
    timeline: entry.timeline,
    weight: entry.weight,
    conditions: {
      ...extracted,
      condition: remainingCondition,
    },
    sets_flag: (entry as any).sets_flag || undefined,
  };
}

// ---------------------------------------------------------------------------
//  Export helpers – convert internal TimelineEntry → compact external format
// ---------------------------------------------------------------------------

/**
 * Convert a single internal entry into the compact external shape.
 */
export function unflattenEntry(entry: TimelineEntry): ExportedTimelineEntry {
  const conds = entry.conditions;
  const specials: any[] = [];

  if (conds.day_from !== undefined) {
    specials.push({ type: "DayFromCondition", day_from: conds.day_from });
  }
  if (conds.hour_range) {
    specials.push({
      type: "HourRangeCondition",
      hour_from: conds.hour_range[0],
      hour_to: conds.hour_range[1],
    });
  }
  if (conds.seen_first !== undefined && conds.seen_first !== "") {
    specials.push({
      type: "SeenFirstCondition",
      timeline_id: conds.seen_first,
    });
  }

  const allConditions: any[] = [...specials];
  if (conds.condition) {
    allConditions.push(conds.condition);
  }

  let merged: Condition | null = null;
  if (allConditions.length === 1) {
    merged = allConditions[0];
  } else if (allConditions.length > 1) {
    merged = { type: "AndCondition", sub_conditions: allConditions };
  }

  return {
    timeline: entry.timeline,
    weight: entry.weight,
    condition: merged,
    ...(entry.sets_flag ? { sets_flag: entry.sets_flag } : {}),
  };
}

// ---------------------------------------------------------------------------
//  General helpers
// ---------------------------------------------------------------------------

export function emptyEntry(): TimelineEntry {
  return { timeline: "", weight: 1, conditions: {}, sets_flag: undefined };
}

export function exportJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
