import { useEffect, useMemo, useState } from "react";
import "./App.scss";
import { FileImporter } from "./FileImporter";
import type { NpcNavBaked, NpcSchedulesFile, TransformedScene } from "./types";
import { transformBakedData } from "./transformBakedData";
import { ScheduleEditor } from "./Schedules/Scheduleeditor";
import { TimelineTableEditor } from "./Timeline/TimelineTableEditor";
import { FlagRegistryEditor } from "./FlagRegistry/flagRegistryEditor";
import { SaveEditor } from "./SaveEditor/SaveEditor";

type Tab = "schedules" | "timelines" | "flags" | "save";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("schedules");
  const [rawBaked, setRawBaked] = useState<NpcNavBaked | null>(null);
  const [scenes, setScenes] = useState<TransformedScene[]>([]);
  const [schedules, setSchedules] = useState<NpcSchedulesFile | null>(null);

  const allNpcs = scenes.flatMap((s) =>
    s.npcs.map((n) => ({ ...n, sceneName: s.name })),
  );
  const allTargets = scenes.flatMap((s) => s.targets.map((n) => ({ ...n })));
  const npcOptions = useMemo(() => allNpcs.map((n) => n.id), [allNpcs]);

  // ── Persistence ────────────────────────────────────────────────────────
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
      } catch {
        return;
      }
    }
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

  return (
    <>
      {/* ── Header ── */}
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

        {scenes.length > 0 && (
          <div className="settings__stats">
            {scenes.length} scenes · {allNpcs.length} NPCs · {allTargets.length}{" "}
            targets
          </div>
        )}

        {schedules && (
          <div className="settings__stats">
            {schedules.npc_schedules.reduce((t, s) => t + s.entries.length, 0)}{" "}
            schedule entries
          </div>
        )}
      </header>

      {/* ── Tab bar ── */}
      <nav className="tab-bar">
        {(["schedules", "timelines", "flags", "save"] as Tab[]).map((tab) => (
          <button
            key={tab}
            className={`tab-bar__tab ${activeTab === tab ? "tab-bar__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {
              {
                schedules: "NPC Schedules",
                timelines: "Dialogic Timelines",
                flags: "Flag Registry",
                save: "Save Editor",
              }[tab]
            }
          </button>
        ))}
      </nav>

      {/* ── Tab content ── */}
      {activeTab === "schedules" && (
        <main className="creator">
          <ScheduleEditor
            rawBaked={rawBaked}
            scenes={scenes}
            schedules={schedules}
            setSchedules={setSchedules}
          />
        </main>
      )}

      {activeTab === "timelines" && (
        <main className="creator">
          <TimelineTableEditor npcOptions={npcOptions} />
        </main>
      )}

      {activeTab === "flags" && (
        <main className="creator">
          <FlagRegistryEditor />
        </main>
      )}

      {activeTab === "save" && (
        <main className="creator">
          <SaveEditor />
        </main>
      )}
    </>
  );
}

export default App;
