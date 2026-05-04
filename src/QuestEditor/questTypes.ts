export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  triggered_if_flag: string;
  completion_flags: string[];
}

export interface QuestFile {
  version: number;
  quests: QuestDefinition[];
}
