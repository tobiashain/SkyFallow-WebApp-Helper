import React, { useState } from "react";
import type { Condition } from "./types";
import "./EditableCondition.scss";

interface Props {
  condition: Condition | null | undefined;
  onChange: (newCondition: Condition | null) => void;
  npcOptions?: string[];
}

const InlineInput: React.FC<{
  value: string;
  onSave: (value: string) => void;
  type?: string;
}> = ({ value, onSave, type = "text" }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <input
        className="inline-input"
        autoFocus
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <span className="click-to-edit" onClick={() => setEditing(true)}>
      {value || "—"}
    </span>
  );
};

export function EditableCondition({
  condition,
  onChange,
  npcOptions = [],
}: Props) {
  const typeOptions = [
    "Always",
    "DayCondition",
    "WeekdayCondition",
    "FlagCondition",
    "FriendshipCondition",
    "AndCondition",
    "OrCondition",
    "NotCondition",
  ];

  const currentType = condition ? condition.type : "Always";

  const handleTypeChange = (newType: string) => {
    if (newType === "Always") {
      // Explicitly set to null
      onChange(null);
      return;
    }

    const base: Partial<Condition> = { type: newType as any };
    switch (newType) {
      case "DayCondition":
        base.day = 0;
        break;
      case "WeekdayCondition":
        base.weekday = 0;
        break;
      case "FlagCondition":
        base.flag_name = "";
        break;
      case "FriendshipCondition":
        base.npc_id = npcOptions.length > 0 ? npcOptions[0] : "";
        base.required_hearts = 0;
        break;
      case "AndCondition":
      case "OrCondition":
        base.sub_conditions = [];
        break;
      case "NotCondition":
        base.condition = undefined;
        break;
    }
    onChange(base as Condition);
  };

  // Leaf rendering (Day, Weekday, Flag, Friendship)
  const renderLeaf = () => {
    if (!condition) return null;
    switch (condition.type) {
      case "DayCondition":
        return (
          <span>
            Day ={" "}
            <InlineInput
              type="number"
              value={String(condition.day ?? 0)}
              onSave={(v) => onChange({ ...condition, day: Number(v) })}
            />
          </span>
        );
      case "WeekdayCondition":
        return (
          <span>
            Weekday ={" "}
            <InlineInput
              type="number"
              value={String(condition.weekday ?? 0)}
              onSave={(v) => onChange({ ...condition, weekday: Number(v) })}
            />
          </span>
        );
      case "FlagCondition":
        return (
          <span>
            Flag:{" "}
            <InlineInput
              value={condition.flag_name ?? ""}
              onSave={(v) => onChange({ ...condition, flag_name: v })}
            />
          </span>
        );
      case "FriendshipCondition":
        return (
          <span>
            ❤️{" "}
            {npcOptions.length > 0 ? (
              <select
                className="inline-select"
                value={condition.npc_id ?? ""}
                onChange={(e) =>
                  onChange({ ...condition, npc_id: e.target.value })
                }
              >
                {npcOptions.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            ) : (
              <InlineInput
                value={condition.npc_id ?? ""}
                onSave={(v) => onChange({ ...condition, npc_id: v })}
              />
            )}
            {" ≥ "}
            <InlineInput
              type="number"
              value={String(condition.required_hearts ?? 0)}
              onSave={(v) =>
                onChange({
                  ...condition,
                  required_hearts: Number(v),
                })
              }
            />
          </span>
        );
      default:
        return null;
    }
  };

  // Sub‑condition helpers for AND/OR
  const addSubCondition = () => {
    if (!condition) return;
    const sub = { type: "DayCondition", day: 0 } as Condition;
    const subs = [...(condition.sub_conditions ?? []), sub];
    onChange({ ...condition, sub_conditions: subs });
  };

  const removeSubCondition = (index: number) => {
    if (!condition) return;
    const subs = [...(condition.sub_conditions ?? [])];
    subs.splice(index, 1);
    onChange({ ...condition, sub_conditions: subs });
  };

  const updateSubCondition = (index: number, newSub: Condition | null) => {
    if (!newSub) {
      removeSubCondition(index);
      return;
    }
    if (!condition) return;
    const subs = [...(condition.sub_conditions ?? [])];
    subs[index] = newSub;
    onChange({ ...condition, sub_conditions: subs });
  };

  // Helper for NOT
  const setNotCondition = (c: Condition | null) => {
    if (!condition) return;
    onChange({ ...condition, condition: c ?? undefined });
  };

  // Colour class
  const blockClass = condition
    ? condition.type === "AndCondition"
      ? "condition--and"
      : condition.type === "OrCondition"
        ? "condition--or"
        : condition.type === "NotCondition"
          ? "condition--not"
          : ""
    : "";

  return (
    <div className={`editable-condition ${blockClass}`}>
      <div className="condition-header">
        <span className="condition-label">
          {condition && condition.type === "AndCondition"
            ? "AND"
            : condition && condition.type === "OrCondition"
              ? "OR"
              : condition && condition.type === "NotCondition"
                ? "NOT"
                : ""}
        </span>
        <select
          className="inline-select"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t === "Always" ? "Always (no condition)" : t}
            </option>
          ))}
        </select>
      </div>

      {/* Only render the condition body if a real condition is selected (not Always) */}
      {condition && (
        <div className="condition-body">
          {(condition.type === "AndCondition" ||
            condition.type === "OrCondition") && (
            <div className="sub-conditions">
              {condition.sub_conditions?.map((sub, idx) => (
                <div key={idx} className="sub-item">
                  <EditableCondition
                    condition={sub}
                    onChange={(c) => updateSubCondition(idx, c)}
                    npcOptions={npcOptions}
                  />
                  <button
                    className="delete-btn small"
                    onClick={() => removeSubCondition(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button className="add-sub-btn" onClick={addSubCondition}>
                + Add {condition.type === "AndCondition" ? "AND" : "OR"}{" "}
                condition
              </button>
            </div>
          )}

          {condition.type === "NotCondition" && (
            <div className="not-body">
              <EditableCondition
                condition={condition.condition}
                onChange={setNotCondition}
                npcOptions={npcOptions}
              />
            </div>
          )}

          {[
            "DayCondition",
            "WeekdayCondition",
            "FlagCondition",
            "FriendshipCondition",
          ].includes(condition.type) && (
            <div className="leaf-value">{renderLeaf()}</div>
          )}
        </div>
      )}
    </div>
  );
}
