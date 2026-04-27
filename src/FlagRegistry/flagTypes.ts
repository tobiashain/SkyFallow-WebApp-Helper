export type FlagValueType = "bool" | "int" | "float" | "string";

export type FlagCategory = "event" | "world" | "quest" | "npc" | "other";

export interface FlagDefinition {
  id: string;
  type: FlagValueType;
  default: boolean | number | string;
  description?: string;
  category: FlagCategory;
  min?: number;
  max?: number;
}

export interface FlagRegistry {
  version: number;
  flags: FlagDefinition[];
}

export type SaveFlagValue = boolean | number | string;

export interface SaveFile {
  version: number;
  flags: Record<string, SaveFlagValue>;
}
