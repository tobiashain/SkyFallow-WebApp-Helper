import { useEffect, useMemo, useRef, useState } from "react";
import "./App.scss";
import { FileImporter } from "./FileImporter";
import type {
  NpcNavBaked,
  NPCScheduleData,
  NpcSchedulesFile,
  ScheduleEntry,
  SchedulePoint,
  TransformedScene,
  Condition,
} from "./types";
import { transformBakedData } from "./transformBakedData";
import { EditableCondition } from "./EditableCondition";

function App() {
  const [rawBaked, setRawBaked] = useState<NpcNavBaked | null>(null);
  const [scenes, setScenes] = useState<TransformedScene[]>([]);
  const [schedules, setSchedules] = useState<NpcSchedulesFile | null>(null);
  const [selectedNpc, setSelectedNpc] = useState<string>("");
  const [selectedEntryIndex, setSelectedEntryIndex] = useState<number | null>(
    null,
  );

  // Build a map of NPC id -> schedule data
  const scheduleMap = useMemo(() => {
    const map = new Map<string, NPCScheduleData>();
    schedules?.npc_schedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [schedules]);

  const allNpcs = scenes.flatMap((s) =>
    s.npcs.map((n) => ({ ...n, sceneName: s.name })),
  );

  const npcOptions = useMemo(() => allNpcs.map((n) => n.id), [allNpcs]);

  const allTargets = scenes.flatMap((s) => s.targets.map((n) => ({ ...n })));

  // Persistence
  useEffect(() => {
    const savedBaked = localStorage.getItem("bakedData");
    if (savedBaked) handleBakedImport(JSON.parse(savedBaked) as NpcNavBaked);

    const savedSchedules = localStorage.getItem("scheduleData");
    if (savedSchedules)
      setSchedules(JSON.parse(savedSchedules) as NpcSchedulesFile);
  }, []);

  const handleBakedImport = (data: NpcNavBaked) => {
    setRawBaked(data);
    setScenes(transformBakedData(data));
    localStorage.setItem("bakedData", JSON.stringify(data));
  };

  const handleScheduleImport = (data: NpcSchedulesFile) => {
    setSchedules(data);
    localStorage.setItem("scheduleData", JSON.stringify(data));
  };

  const exportSchedules = async () => {
    if (!schedules) return;
    const jsonString = JSON.stringify(schedules, null, 2);

    // Try modern file picker (opens native Save As dialog)
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "npc_schedules.json",
          types: [
            {
              description: "JSON file",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(jsonString);
        await writable.close();
        return;
      } catch (err) {
        // User cancelled or error – do nothing
        console.warn("Save cancelled or failed", err);
        return;
      }
    }

    // Fallback: anchor element (works everywhere)
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "npc_schedules.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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

    // Keep the selected entry under the cursor if it was the one moved
    setSelectedEntryIndex((current) => {
      if (current === fromIndex) return toIndex;
      if (current === null) return null;
      // Adjust the index if the selected entry was shifted
      if (fromIndex < toIndex) {
        if (current > fromIndex && current <= toIndex) return current - 1;
      } else {
        if (current >= toIndex && current < fromIndex) return current + 1;
      }
      return current;
    });
  };

  // Drag state (we use a ref to avoid re-rendering on every drag)
  const dragIndex = useRef<number | null>(null);

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    // Optional: set drop effect
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

  // ---------- Schedule manipulation helpers ----------

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
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const newEntries = [
            ...s.entries,
            {
              description: "",
              entry_condition: null,
              points: [] as SchedulePoint[],
            },
          ];
          return { ...s, entries: newEntries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
    });
    // After adding, select the new entry (last index)
    const npc = scheduleMap.get(npcId);
    const newLen = npc ? npc.entries.length + 1 : 1;
    setSelectedEntryIndex(newLen - 1);
  };

  const deleteEntry = (npcId: string, idx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          entries.splice(idx, 1);
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
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
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          entries[idx] = updatedEntry;
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
    });
  };

  const addPoint = (npcId: string, entryIdx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          const newPoints = [
            ...entry.points,
            {
              time: 0,
              scene: scenes.length > 0 ? scenes[0].id : 0,
              target_node: "",
              point_condition: null,
            },
          ];
          entry.points = newPoints;
          entries[entryIdx] = entry;
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
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
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          const points = [...entry.points];
          points[pointIdx] = point;
          entry.points = points;
          entries[entryIdx] = entry;
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
    });
  };

  const deletePoint = (npcId: string, entryIdx: number, pointIdx: number) => {
    setSchedules((prev) => {
      if (!prev) return prev;
      const newSchedules = prev.npc_schedules.map((s) => {
        if (s.id === npcId) {
          const entries = [...s.entries];
          const entry = { ...entries[entryIdx] };
          const points = [...entry.points];
          points.splice(pointIdx, 1);
          entry.points = points;
          entries[entryIdx] = entry;
          return { ...s, entries };
        }
        return s;
      });
      return { ...prev, npc_schedules: newSchedules };
    });
  };

  // ---------- Handlers ----------
  const handleSelectedNpc = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedNpc(e.target.value);
    setSelectedEntryIndex(null);
  };

  const currentNpcSchedule = selectedNpc
    ? scheduleMap.get(selectedNpc)
    : undefined;

  // Helpers for scene/target dropdowns
  const sceneOptions = useMemo(() => scenes, [scenes]);

  const targetsForScene = (sceneId: number) => {
    if (!rawBaked) return [];
    const scene = rawBaked.scenes[sceneId];
    return scene ? scene.targets : [];
  };

  return (
    <>
      <header className="settings">
        <div className="settings__baked-data">
          <h2>Import Baked Data</h2>
          <FileImporter<NpcNavBaked>
            onDataLoaded={handleBakedImport}
            label="Drop npc_nav_baked.json here"
          />
        </div>

        <div className="settings__schedule">
          <h2>Import Existing Schedules (optional)</h2>
          <FileImporter<NpcSchedulesFile>
            onDataLoaded={handleScheduleImport}
            label="Drop npc_schedules.json here"
          />
        </div>

        <div className="settings__export">
          <button onClick={exportSchedules}>Export npc_schedules.json</button>
        </div>

        {scenes.length > 0 ? (
          <div className="settings__stats">
            Imported {scenes.length} scenes, {allNpcs.length} NPCs, and{" "}
            {allTargets.length} Targets.
          </div>
        ) : (
          <div></div>
        )}

        {schedules ? (
          <div className="settings__stats">
            Loaded{" "}
            {schedules.npc_schedules.reduce(
              (total, schedule) => total + schedule.entries.length,
              0,
            )}{" "}
            NPC schedules.
          </div>
        ) : (
          <div></div>
        )}
      </header>
      <main className="creator">
        <div className="npc">
          <label htmlFor="npc__select">Select NPC</label>
          <select
            name="npc__select"
            id="npc__select"
            value={selectedNpc}
            onChange={handleSelectedNpc}
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
              <div>
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
                      className={`schedules-item ${
                        selectedEntryIndex === idx ? "selected" : ""
                      }`}
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
                  currentNpcSchedule.entries[selectedEntryIndex] && (
                    <div className="entry-details">
                      {(() => {
                        const entry =
                          currentNpcSchedule.entries[selectedEntryIndex];
                        const handleEntryChange = (newEntry: ScheduleEntry) => {
                          updateEntry(
                            selectedNpc,
                            selectedEntryIndex,
                            newEntry,
                          );
                        };

                        return (
                          <>
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
                                        onChange={(e) => {
                                          const newPoint = {
                                            ...point,
                                            time: Number(e.target.value),
                                          };
                                          updatePoint(
                                            selectedNpc,
                                            selectedEntryIndex,
                                            pIdx,
                                            newPoint,
                                          );
                                        }}
                                      />
                                    </div>

                                    <div className="form-group">
                                      <label>Scene</label>
                                      <select
                                        className="inline-select"
                                        value={point.scene}
                                        onChange={(e) => {
                                          const scene = Number(e.target.value);
                                          const newPoint: SchedulePoint = {
                                            ...point,
                                            scene,
                                            target_node: "", // reset target when scene changes
                                          };
                                          updatePoint(
                                            selectedNpc,
                                            selectedEntryIndex,
                                            pIdx,
                                            newPoint,
                                          );
                                        }}
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
                                        onChange={(e) => {
                                          const newPoint = {
                                            ...point,
                                            target_node: e.target.value,
                                          };
                                          updatePoint(
                                            selectedNpc,
                                            selectedEntryIndex,
                                            pIdx,
                                            newPoint,
                                          );
                                        }}
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
                                        onChange={(cond) => {
                                          const newPoint = {
                                            ...point,
                                            point_condition: cond,
                                          };
                                          updatePoint(
                                            selectedNpc,
                                            selectedEntryIndex,
                                            pIdx,
                                            newPoint,
                                          );
                                        }}
                                        npcOptions={npcOptions}
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
                          </>
                        );
                      })()}
                    </div>
                  )}
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}

export default App;
