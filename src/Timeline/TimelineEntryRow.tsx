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
            min={-1}
            value={entry.weight}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              let val = Number(e.target.value);
              if (isNaN(val)) val = 1;
              else if (val !== -1 && val < 1) val = 1;
              onChange({ ...entry, weight: val });
            }}
          />
        </div>
        {entry.sets_flag && (
          <span className="tl-entry__badge tl-entry__badge--flag">
            🚩 {entry.sets_flag}
          </span>
        )}
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
          <div className="cond-grid">
            <div className="cond-row">
              <label className="cond-key">sets_flag</label>
              <input
                className="cond-val"
                type="text"
                placeholder="e_met_farmer"
                value={entry.sets_flag ?? ""}
                onChange={(e) =>
                  onChange({
                    ...entry,
                    sets_flag: e.target.value || undefined,
                  })
                }
              />
            </div>
            <ConditionsEditor
              conds={entry.conditions}
              onChange={(c) => onChange({ ...entry, conditions: c })}
              npcOptions={npcOptions}
            />
          </div>
        </div>
      )}
    </div>
  );
}
