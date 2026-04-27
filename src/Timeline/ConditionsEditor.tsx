import type { TimelineConditions } from "./timelineTableEditorTypes";
import { EditableCondition } from "../EditableCondition";

interface Props {
  conds: TimelineConditions;
  onChange: (c: TimelineConditions) => void;
  npcOptions: string[];
}

export function ConditionsEditor({ conds, onChange, npcOptions }: Props) {
  const set = (key: keyof TimelineConditions, value: any) =>
    onChange({ ...conds, [key]: value === "" ? undefined : value });

  const del = (key: keyof TimelineConditions) => {
    const next = { ...conds };
    delete next[key];
    onChange(next);
  };

  return (
    <>
      {/* day_from */}
      <div className="cond-row">
        <label className="cond-key">day_from</label>
        <input
          className="cond-val narrow"
          type="number"
          min={0}
          placeholder="game day"
          value={conds.day_from ?? ""}
          onChange={(e) =>
            set(
              "day_from",
              e.target.value === "" ? undefined : Number(e.target.value),
            )
          }
        />
        {conds.day_from !== undefined && (
          <button className="cond-del" onClick={() => del("day_from")}>
            ✕
          </button>
        )}
      </div>

      {/* hour_range */}
      <div className="cond-row">
        <label className="cond-key">hour_range</label>
        <input
          className="cond-val narrow"
          type="number"
          min={0}
          max={23}
          placeholder="from"
          value={conds.hour_range?.[0] ?? ""}
          onChange={(e) => {
            const from =
              e.target.value === "" ? undefined : Number(e.target.value);
            if (from === undefined) {
              del("hour_range");
              return;
            }
            set("hour_range", [from, conds.hour_range?.[1] ?? 23]);
          }}
        />
        <span className="cond-sep">→</span>
        <input
          className="cond-val narrow"
          type="number"
          min={0}
          max={23}
          placeholder="to"
          value={conds.hour_range?.[1] ?? ""}
          onChange={(e) => {
            const to =
              e.target.value === "" ? undefined : Number(e.target.value);
            if (to === undefined) {
              del("hour_range");
              return;
            }
            set("hour_range", [conds.hour_range?.[0] ?? 0, to]);
          }}
        />
        {conds.hour_range !== undefined && (
          <button className="cond-del" onClick={() => del("hour_range")}>
            ✕
          </button>
        )}
      </div>

      {/* seen_first */}
      <div className="cond-row">
        <label className="cond-key">seen_first</label>
        <input
          className="cond-val"
          type="text"
          placeholder="timeline_id"
          value={conds.seen_first ?? ""}
          onChange={(e) => set("seen_first", e.target.value)}
        />
        {conds.seen_first !== undefined && conds.seen_first !== "" && (
          <button className="cond-del" onClick={() => del("seen_first")}>
            ✕
          </button>
        )}
      </div>

      {/* Structured condition via EditableCondition */}
      <div className="cond-row cond-row--full">
        <label className="cond-key">condition</label>
        <div className="cond-structured">
          <EditableCondition
            condition={conds.condition ?? null}
            onChange={(c) => set("condition", c)}
            npcOptions={npcOptions}
          />
        </div>
      </div>
    </>
  );
}
