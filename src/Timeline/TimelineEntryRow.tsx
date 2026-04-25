import type { TimelineEntry } from "./timelineTableEditorTypes";
import { ConditionsEditor } from "./ConditionsEditor";

interface Props {
  entry: TimelineEntry;
  index: number;
  onChange: (e: TimelineEntry) => void;
  onDelete: () => void;
  npcOptions: string[];
  isExpanded: boolean;
  onToggle: () => void;
}

export function TimelineEntryRow({
  entry,
  index,
  onChange,
  onDelete,
  npcOptions,
  isExpanded,
  onToggle,
}: Props) {
  const hasConditions = Object.keys(entry.conditions).length > 0;

  return (
    <div className={`tl-entry ${isExpanded ? "tl-entry--expanded" : ""}`}>
      <div className="tl-entry__header" onClick={onToggle}>
        <span className="tl-entry__index">#{index + 1}</span>
        <input
          className="tl-entry__name"
          type="text"
          placeholder="timeline_id"
          value={entry.timeline}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ ...entry, timeline: e.target.value })}
        />
        <div className="tl-entry__weight-wrap">
          <label>w</label>
          <input
            className="tl-entry__weight"
            type="number"
            min={1}
            value={entry.weight}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              onChange({ ...entry, weight: Number(e.target.value) || 1 })
            }
          />
        </div>
        {hasConditions && (
          <span className="tl-entry__badge">
            {Object.keys(entry.conditions).length} cond
          </span>
        )}
        <span className="tl-entry__chevron">{isExpanded ? "▲" : "▼"}</span>
        <button
          className="delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      </div>

      {isExpanded && (
        <div className="tl-entry__body">
          <ConditionsEditor
            conds={entry.conditions}
            onChange={(c) => onChange({ ...entry, conditions: c })}
            npcOptions={npcOptions}
          />
        </div>
      )}
    </div>
  );
}
