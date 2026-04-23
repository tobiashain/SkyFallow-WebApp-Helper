import { useEffect, useMemo, useState } from "react";
import "./App.scss";
import { FileImporter } from "./FileImporter";
import type {
  NpcNavBaked,
  NPCScheduleData,
  NpcSchedulesFile,
  ScheduleEntry,
  TransformedScene,
} from "./types";
import { transformBakedData } from "./transformBakedData";
import { ConditionDisplay } from "./ConditionDisplay";

function App() {
  const [rawBaked, setRawBaked] = useState<NpcNavBaked | null>(null);
  const [scenes, setScenes] = useState<TransformedScene[]>([]);
  const [schedules, setSchedules] = useState<NpcSchedulesFile | null>(null);
  const [selectedNpc, setSelectedNpc] = useState<string>("");
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleEntry>();

  const scheduleMap = useMemo(() => {
    const map = new Map<string, NPCScheduleData>();
    schedules?.npc_schedules.forEach((s) => map.set(s.id, s));
    return map;
  }, [schedules]);

  const allNpcs = scenes.flatMap((s) =>
    s.npcs.map((n) => ({ ...n, sceneName: s.name })),
  );

  const allTargets = scenes.flatMap((s) => s.targets.map((n) => ({ ...n })));

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

  const exportSchedules = () => {
    const blob = new Blob([JSON.stringify(schedules, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "npc_schedules.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSelectedNpc = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedNpc(e.target.value);
  };

  const handleSelectedSchedule = (entry: ScheduleEntry) => {
    setSelectedSchedule(entry);
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
        <div className="schedule">
          {selectedNpc && (
            <>
              {(() => {
                const npcSchedule = scheduleMap.get(selectedNpc);

                return (
                  <>
                    <div className="schedules">
                      <div className="schedules__create schedules-item"></div>
                      {npcSchedule?.entries.map((entry, idx) => (
                        <div
                          className="schedules-item"
                          key={idx}
                          onClick={() => handleSelectedSchedule(entry)}
                        >
                          <div className="schedules-item__description">
                            {entry.description}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="schedule-condition">
                      {selectedSchedule && (
                        <>
                          <div className="schedule-condition__title">
                            <h3>Condition:</h3>
                          </div>
                          <div className="schedule-condition__type">
                            {selectedSchedule.entry_condition?.type}
                          </div>
                          <div className="schedule-condition__conditions">
                            <ConditionDisplay
                              condition={selectedSchedule.entry_condition}
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div className="schedule-points">
                      {selectedSchedule && (
                        <>
                          <div className="schedule-points__title">
                            <h3>Schedule Points:</h3>
                          </div>
                          {selectedSchedule.points.map((point) => (
                            <>
                              <div className="schedule-point">
                                <div className="schedule-point__condition">
                                  <h3>Condition:</h3>
                                  <ConditionDisplay
                                    condition={point.point_condition}
                                  />
                                </div>
                                <div className="schedule-point__time">
                                  <div>Time:</div>
                                  {point.time}
                                </div>
                                <div className="schedule-point__scene">
                                  <div>Scene:</div>
                                  {point.scene}
                                </div>
                                <div className="schedule-point__target">
                                  <div>Target:</div>
                                  {point.target_node}
                                </div>
                              </div>
                            </>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </main>
    </>
  );
}

export default App;
