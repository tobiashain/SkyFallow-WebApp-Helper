export interface BakedTile {
  w: number;
  p: number;
}

export interface BakedExit {
  pos: [number, number];
  target_scene: number;
  target_entry: string;
}

export interface BakedEntry {
  id: string;
  pos: [number, number];
}

export interface BakedTarget {
  path: string;
  pos: [number, number];
}

export interface BakedNPC {
  id: string;
  home_scene: number;
  pos: [number, number];
  schedule: string;
}

export interface BakedScene {
  scene_name?: string;
  tiles: Record<string, BakedTile>;
  exits: BakedExit[];
  entries: BakedEntry[];
  targets: BakedTarget[];
  npcs: BakedNPC[];
}

export interface NpcNavBaked {
  scenes: Record<string, BakedScene>;
}

// ---------- Schedule types ----------

export type ConditionType =
  | "DayCondition"
  | "WeekdayCondition"
  | "FlagCondition"
  | "FriendshipCondition"
  | "DayFromCondition"
  | "SeenFirstCondition"
  | "HourRangeCondition"
  | "AndCondition"
  | "OrCondition"
  | "NotCondition";

export interface Condition {
  type: ConditionType;
  day?: number;
  weekday?: number;
  flag_name?: string;
  npc_id?: string;
  required_hearts?: number;
  sub_conditions?: Condition[];
  condition?: Condition;
}

export interface SchedulePoint {
  time: number;
  scene: number;
  target_node: string;
  point_condition?: Condition | null;
}

export interface ScheduleEntry {
  description?: string;
  entry_condition?: Condition | null;
  points: SchedulePoint[];
}

export interface NPCScheduleData {
  id: string;
  entries: ScheduleEntry[];
}

export interface NpcSchedulesFile {
  npc_schedules: NPCScheduleData[];
}

export interface TransformedScene {
  id: number;
  name: string;
  tiles: Record<string, { w: number; p: number }>;
  npcs: {
    id: string;
    home_scene: number;
    pos: [number, number];
    schedule: string;
  }[];
  targets: { path: string; pos: [number, number] }[];
}
