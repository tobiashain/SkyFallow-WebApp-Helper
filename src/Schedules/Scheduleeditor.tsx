import { useMemo, useRef, useState } from "react";
import type {
  NpcNavBaked,
  NPCScheduleData,
  NpcSchedulesFile,
  ScheduleEntry,
  SchedulePoint,
  TransformedScene,
} from "../types";
import type { FlagRegistry } from "../FlagRegistry/flagTypes";
import { EditableCondition } from "../EditableCondition";
import "./scheduleEditor.scss";

function readFlagOptions(): string[] {
  try {
    const raw = localStorage.getItem("flag_registry");
    if (!raw) return [];
    const registry: FlagRegistry = JSON.parse(raw);
    return registry.flags?.map((f) => f.id) ?? [];
  } catch {
    return [];
  }
}

interface Props {
  rawBaked: NpcNavBaked | null;
  scenes: TransformedScene[];
  schedules: NpcSchedulesFile | null;
  setSchedules: React.Dispatch<React.SetStateAction<NpcSchedulesFile | null>>;
}

export function ScheduleEditor({
  rawBaked,
  scenes,
  schedules,
  setSchedules,
}: Props) {
  const [selectedNpc, setSelectedNpc] = useState<string>("");
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
    null,
  );
  const dragIndex = useRef<number | null>(null);

  const allNpcs = scenes.flatMap((s) =>
    s.npcs.map((n) => ({ ...n, sceneName: s.name })),
  );
  const npcOptions = useMemo(() => allNpcs.map((n) => n.id), [allNpcs]);
  const flagOptions = useMemo(() => readFlagOptions(), []);

  const scheduleMap = useMemo(() => {
    const map = new Map<string, NPCScheduleData>();
    schedules?.npc_schedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [schedules]);

  const sceneOptions = useMemo(() => scenes, [scenes]);

  const targetsForScene = (sceneId: number) => {
    if (!rawBaked) return [];
    const scene = rawBaked.scenes[sceneId];
    return scene ? scene.targets : [];
  };

  // ── Drag to reorder ──────────────────────────────────────────────────
  const reorderEntries = (
    npcId: string,
    fromIndex: number,
    toIndex: number,
  ) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          const [moved] = entries.splice(fromIndex, 1);
          entries.splice(toIndex, 0, moved);
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
    });
    setSelectedEntryIndex((current) => {
      if (current === fromIndex) return toIndex;
      if (current === null) return null;
      if (fromIndex < toIndex) {
        if (current > fromIndex && current <= toIndex) return current - 1;
      } else {
        if (current >= toIndex && current < fromIndex) return current + 1;
      }
      return current;
    });
  };

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };
  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndex.current;
    if (fromIndex === null || fromIndex === dropIndex) return;
    reorderEntries(selectedNpc, fromIndex, dropIndex);
    dragIndex.current = null;
  };
  const handleDragEnd = () => {
    dragIndex.current = null;
  };

  // ── Schedule CRUD ────────────────────────────────────────────────────
  const addNpcSchedule = (npcId: string) => {
    setSchedules((prev) => {
      const list = prev ? [...prev.npc_schedules] : [];
      if (list.some((s) => s.id === npcId)) return prev;
      list.push({ id: npcId, entries: [] });
      return { npc_schedules: list };
    });
  };

  const addEntry = (npcId: string) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) =>
          s.id === npcId
            ? {
                ...s,
                entries: [
                  ...s.entries,
                  {
                    description: "",
                    entry_condition: null,
                    points: [] as SchedulePoint[],
                  },
                ],
              }
            : s,
        ),
      };
    });
    const npc = scheduleMap.get(npcId);
    setSelectedEntryIndex(npc ? npc.entries.length : 0);
  };

  const deleteEntry = (npcId: string, idx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) => {
          if (s.id !== npcId) return s;
          const entries = [...s.entries];
          entries.splice(idx, 1);
          return { ...s, entries };
        }),
      };
    });
    setSelectedEntryIndex(null);
  };

  const updateEntry = (
    npcId: string,
    idx: number,
    updatedEntry: ScheduleEntry,
  ) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) => {
          if (s.id !== npcId) return s;
          const entries = [...s.entries];
          entries[idx] = updatedEntry;
          return { ...s, entries };
        }),
      };
    });
  };

  const addPoint = (npcId: string, entryIdx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) => {
          if (s.id !== npcId) return s;
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          entry.points = [
            ...entry.points,
            {
              time: 0,
              scene: scenes.length > 0 ? scenes[0].id : 0,
              target_node: "",
              point_condition: null,
            },
          ];
          entries[entryIdx] = entry;
          return { ...s, entries };
        }),
      };
    });
  };

  const updatePoint = (
    npcId: string,
    entryIdx: number,
    pointIdx: number,
    point: SchedulePoint,
  ) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) => {
          if (s.id !== npcId) return s;
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          const points = [...entry.points];
          points[pointIdx] = point;
          entry.points = points;
          entries[entryIdx] = entry;
          return { ...s, entries };
        }),
      };
    });
  };

  const deletePoint = (npcId: string, entryIdx: number, pointIdx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        npc_schedules: prev.npc_schedules.map((s) => {
          if (s.id !== npcId) return s;
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          const points = [...entry.points];
          points.splice(pointIdx, 1);
          entry.points = points;
          entries[entryIdx] = entry;
          return { ...s, entries };
        }),
      };
    });
  };

  // ── Derived ──────────────────────────────────────────────────────────
  const currentNpcSchedule = selectedNpc
    ? scheduleMap.get(selectedNpc)
    : undefined;

  return (
    <>
      <div className="npc">
        <label htmlFor="npc__select">Select NPC</label>
        <select
          name="npc__select"
          id="npc__select"
          value={selectedNpc}
          onChange={(e) => {
            setSelectedNpc(e.target.value);
            setSelectedEntryIndex(null);
          }}
        >
          <option value="">-- choose --</option>
          {allNpcs.map((npc) => (
            <option key={npc.id} value={npc.id}>
              {npc.id} ({npc.sceneName})
            </option>
          ))}
        </select>
      </div>

      {selectedNpc && (
        <div className="schedule-editor">
          {!currentNpcSchedule ? (
            <div className="schedule-editor__empty">
              <p>No schedule for this NPC yet.</p>
              <button onClick={() => addNpcSchedule(selectedNpc)}>
                Create schedule
              </button>
            </div>
          ) : (
            <>
              <div className="schedules-list">
                <h3>Schedule Entries</h3>
                {currentNpcSchedule.entries.map((entry, idx) => (
                  <div
                    className={`schedules-item ${selectedEntryIndex === idx ? "selected" : ""}`}
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedEntryIndex(idx)}
                  >
                    <div className="schedules-item__description">
                      {entry.description || "(no description)"}
                    </div>
                    <button
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteEntry(selectedNpc, idx);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  className="add-entry-btn"
                  onClick={() => addEntry(selectedNpc)}
                >
                  + Add Entry
                </button>
              </div>

              {selectedEntryIndex !== null &&
                currentNpcSchedule.entries[selectedEntryIndex] &&
                (() => {
                  const entry = currentNpcSchedule.entries[selectedEntryIndex];
                  const handleEntryChange = (newEntry: ScheduleEntry) =>
                    updateEntry(selectedNpc, selectedEntryIndex, newEntry);

                  return (
                    <div className="entry-details">
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          className="inline-input full-width"
                          type="text"
                          value={entry.description ?? ""}
                          onChange={(e) =>
                            handleEntryChange({
                              ...entry,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="form-group">
                        <label>Entry Condition</label>
                        <EditableCondition
                          condition={entry.entry_condition}
                          onChange={(cond) =>
                            handleEntryChange({
                              ...entry,
                              entry_condition: cond,
                            })
                          }
                          npcOptions={npcOptions}
                          flagOptions={flagOptions}
                        />
                      </div>

                      <div className="points-section">
                        <h4>Schedule Points</h4>
                        {entry.points.map((point, pIdx) => (
                          <div className="schedule-point" key={pIdx}>
                            <div className="point-row">
                              <div className="form-group">
                                <label>Time</label>
                                <input
                                  className="inline-input"
                                  type="number"
                                  value={point.time}
                                  onChange={(e) =>
                                    updatePoint(
                                      selectedNpc,
                                      selectedEntryIndex,
                                      pIdx,
                                      {
                                        ...point,
                                        time: Number(e.target.value),
                                      },
                                    )
                                  }
                                />
                              </div>

                              <div className="form-group">
                                <label>Scene</label>
                                <select
                                  className="inline-select"
                                  value={point.scene}
                                  onChange={(e) =>
                                    updatePoint(
                                      selectedNpc,
                                      selectedEntryIndex,
                                      pIdx,
                                      {
                                        ...point,
                                        scene: Number(e.target.value),
                                        target_node: "",
                                      },
                                    )
                                  }
                                >
                                  {sceneOptions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.id} – {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group">
                                <label>Target</label>
                                <select
                                  className="inline-select"
                                  value={point.target_node}
                                  onChange={(e) =>
                                    updatePoint(
                                      selectedNpc,
                                      selectedEntryIndex,
                                      pIdx,
                                      { ...point, target_node: e.target.value },
                                    )
                                  }
                                >
                                  <option value="">-- choose --</option>
                                  {targetsForScene(point.scene).map(
                                    (t, tIdx) => (
                                      <option key={tIdx} value={t.path}>
                                        {t.path}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>

                              <div className="form-group">
                                <label>Point Condition</label>
                                <EditableCondition
                                  condition={point.point_condition}
                                  onChange={(cond) =>
                                    updatePoint(
                                      selectedNpc,
                                      selectedEntryIndex,
                                      pIdx,
                                      { ...point, point_condition: cond },
                                    )
                                  }
                                  npcOptions={npcOptions}
                                  flagOptions={flagOptions}
                                />
                              </div>

                              <button
                                className="delete-btn"
                                onClick={() =>
                                  deletePoint(
                                    selectedNpc,
                                    selectedEntryIndex,
                                    pIdx,
                                  )
                                }
                              >
                                ✕ Point
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          className="add-point-btn"
                          onClick={() =>
                            addPoint(selectedNpc, selectedEntryIndex)
                          }
                        >
                          + Add Schedule Point
                        </button>
                      </div>
                    </div>
                  );
                })()}
            </>
          )}
        </div>
      )}
    </>
  );
}
