import { useMemo, useState } from "react";
import "./App.scss";
import { FileImporter } from "./FileImporter";
import type { NpcNavBaked, NpcSchedulesFile, TransformedScene } from "./types";
import { transformBakedData } from "./transformBakedData";
import { ScheduleEditor } from "./Schedules/Scheduleeditor";
import { TimelineTableEditor } from "./Timeline/TimelineTableEditor";
import { FlagRegistryEditor } from "./FlagRegistry/flagRegistryEditor";
import { SaveEditor } from "./SaveEditor/SaveEditor";
import { QuestEditor } from "./QuestEditor/QuestEditor";

type Tab = "schedules" | "timelines" | "flags" | "quests" | "save";

interface JsonFileHandle {
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
}

interface JsonSaveWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: {
      description: string;
      accept: Record<string, string[]>;
    }[];
  }) => Promise<JsonFileHandle>;
}

function loadStoredBaked() {
  const stored = localStorage.getItem("bakedData");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as NpcNavBaked;
  } catch {
    return null;
  }
}

function loadStoredSchedules() {
  const stored = localStorage.getItem("scheduleData");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as NpcSchedulesFile;
  } catch {
    return null;
  }
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("schedules");
  const [rawBaked, setRawBaked] = useState<NpcNavBaked | null>(loadStoredBaked);
  const [scenes, setScenes] = useState<TransformedScene[]>(() =>
    rawBaked ? transformBakedData(rawBaked) : [],
  );
  const [schedules, setSchedules] =
    useState<NpcSchedulesFile | null>(loadStoredSchedules);

  const allNpcs = scenes.flatMap((s) =>
    s.npcs.map((n) => ({ ...n, sceneName: s.name })),
  );
  const allTargets = scenes.flatMap((s) => s.targets.map((n) => ({ ...n })));
  const npcOptions = useMemo(() => allNpcs.map((n) => n.id), [allNpcs]);

  // ── Persistence ────────────────────────────────────────────────────────
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
    const saveWindow = window as JsonSaveWindow;
    if (saveWindow.showSaveFilePicker) {
      try {
        const handle = await saveWindow.showSaveFilePicker({
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
        {(["schedules", "timelines", "flags", "quests", "save"] as Tab[]).map((tab) => (
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
                quests: "Quest Editor",
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

      {activeTab === "quests" && (
        <main className="creator">
          <QuestEditor />
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
