import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { FlagDefinition, FlagRegistry } from "../FlagRegistry/flagTypes";
import { exportJson } from "../Timeline/timelineUtils";
import type { QuestDefinition, QuestFile } from "./questTypes";
import "./questEditor.scss";

const STORAGE_KEY = "quest_data";
const REGISTRY_STORAGE_KEY = "flag_registry";

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

function makeQuest(): QuestDefinition {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    triggered_if_flag: "",
    completion_flags: [""],
  };
}

function normalizeQuest(raw: Partial<QuestDefinition> & Record<string, unknown>) {
  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : crypto.randomUUID(),
    title: typeof raw.title === "string" ? raw.title : "",
    description: typeof raw.description === "string" ? raw.description : "",
    triggered_if_flag:
      typeof raw.triggered_if_flag === "string"
        ? raw.triggered_if_flag
        : typeof raw.trigger_flag === "string"
          ? raw.trigger_flag
          : "",
    completion_flags: Array.isArray(raw.completion_flags)
      ? raw.completion_flags.filter(
          (flag): flag is string => typeof flag === "string",
        )
      : [""],
  };
}

function normalizeQuestFile(raw: unknown): QuestFile {
  if (raw && typeof raw === "object" && "quests" in raw) {
    const file = raw as Partial<QuestFile>;
    return {
      version: typeof file.version === "number" ? file.version : 1,
      quests: Array.isArray(file.quests)
        ? file.quests.map((quest) =>
            normalizeQuest(quest as Partial<QuestDefinition>),
          )
        : [],
    };
  }

  if (Array.isArray(raw)) {
    return {
      version: 1,
      quests: raw.map((quest) =>
        normalizeQuest(quest as Partial<QuestDefinition>),
      ),
    };
  }

  return { version: 1, quests: [] };
}

function loadStoredQuestFile() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return { version: 1, quests: [] };
  try {
    return normalizeQuestFile(JSON.parse(stored));
  } catch {
    return { version: 1, quests: [] };
  }
}

function loadStoredRegistry() {
  const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as FlagRegistry;
    return parsed.flags ?? [];
  } catch {
    return [];
  }
}

export function QuestEditor() {
  const [storedQuestFile] = useState<QuestFile>(loadStoredQuestFile);
  const [quests, setQuests] = useState<QuestDefinition[]>(
    storedQuestFile.quests,
  );
  const [version, setVersion] = useState(storedQuestFile.version);
  const [registry] = useState<FlagDefinition[]>(loadStoredRegistry);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestDefinition>(makeQuest);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const persist = useCallback((nextQuests: QuestDefinition[], nextVersion: number) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: nextVersion, quests: nextQuests }),
    );
  }, []);

  const flagOptions = useMemo(
    () => registry.map((flag) => flag.id),
    [registry],
  );

  const visibleQuests = quests.filter((quest) => {
    const haystack = [
      quest.title,
      quest.description,
      quest.triggered_if_flag,
      ...quest.completion_flags,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  const startNew = () => {
    setDraft(makeQuest());
    setEditingId("");
    setError("");
  };

  const startEdit = (quest: QuestDefinition) => {
    setDraft({
      ...quest,
      completion_flags:
        quest.completion_flags.length > 0 ? [...quest.completion_flags] : [""],
    });
    setEditingId(quest.id);
    setError("");
  };

  const saveDraft = () => {
    const cleaned: QuestDefinition = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      triggered_if_flag: draft.triggered_if_flag.trim(),
      completion_flags: draft.completion_flags.map((flag) => flag.trim()).filter(Boolean),
    };

    if (!cleaned.title) {
      setError("Title is required.");
      return;
    }
    if (!cleaned.triggered_if_flag) {
      setError("Triggered if flag is required.");
      return;
    }
    if (cleaned.completion_flags.length === 0) {
      setError("Add at least one completion flag.");
      return;
    }

    const next =
      editingId === ""
        ? [...quests, cleaned]
        : quests.map((quest) => (quest.id === editingId ? cleaned : quest));
    setQuests(next);
    persist(next, version);
    setEditingId(null);
    setError("");
  };

  const deleteQuest = (id: string) => {
    const next = quests.filter((quest) => quest.id !== id);
    setQuests(next);
    persist(next, version);
    if (editingId === id) setEditingId(null);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = normalizeQuestFile(JSON.parse(ev.target?.result as string));
        setQuests(parsed.quests);
        setVersion(parsed.version);
        persist(parsed.quests, parsed.version);
        setEditingId(null);
      } catch {
        alert("Invalid quest JSON");
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    const data: QuestFile = { version, quests };
    const saveWindow = window as JsonSaveWindow;
    if (saveWindow.showSaveFilePicker) {
      try {
        const handle = await saveWindow.showSaveFilePicker({
          suggestedName: "quests.json",
          types: [
            {
              description: "JSON file",
              accept: { "application/json": [".json"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(JSON.stringify(data, null, 2));
        await writable.close();
        return;
      } catch {
        /* cancelled */
      }
    }
    exportJson(data, "quests.json");
  };

  const updateCompletionFlag = (index: number, value: string) => {
    setDraft((quest) => ({
      ...quest,
      completion_flags: quest.completion_flags.map((flag, i) =>
        i === index ? value : flag,
      ),
    }));
  };

  return (
    <div className="qe">
      <div className="qe__toolbar">
        <input
          className="qe__search"
          type="text"
          placeholder="Search quests or flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="qe__actions">
          <label className="qe__import-btn">
            Import
            <input type="file" accept=".json" hidden onChange={handleImport} />
          </label>
          <button className="qe__export-btn" onClick={handleExport}>
            Export quests.json
          </button>
          <button className="qe__add-btn" onClick={startNew}>
            + New Quest
          </button>
        </div>
      </div>

      <div className="qe__body">
        <div className="qe__list">
          {visibleQuests.length === 0 && (
            <p className="qe__empty">
              No quests yet. Click "+ New Quest" to add one.
            </p>
          )}

          {visibleQuests.map((quest) => (
            <div
              key={quest.id}
              className={`qe__row ${editingId === quest.id ? "qe__row--editing" : ""}`}
              onClick={() => editingId !== quest.id && startEdit(quest)}
            >
              <div className="qe__row-main">
                <span className="qe__title">{quest.title}</span>
                <span className="qe__description">{quest.description}</span>
              </div>
              <span className="qe__flag qe__flag--trigger">
                {quest.triggered_if_flag}
              </span>
              <span className="qe__count">
                {quest.completion_flags.length} completion flag
                {quest.completion_flags.length === 1 ? "" : "s"}
              </span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteQuest(quest.id);
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>

        {editingId !== null && (
          <div className="qe__panel">
            <h3 className="qe__panel-title">
              {editingId === "" ? "New Quest" : "Edit Quest"}
            </h3>

            <div className="qe__field">
              <label>Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                  setDraft((quest) => ({ ...quest, title: e.target.value }))
                }
              />
            </div>

            <div className="qe__field">
              <label>Description</label>
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((quest) => ({
                    ...quest,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="qe__field">
              <label>Triggered if flag</label>
              {flagOptions.length > 0 ? (
                <select
                  value={draft.triggered_if_flag}
                  onChange={(e) =>
                    setDraft((quest) => ({
                      ...quest,
                      triggered_if_flag: e.target.value,
                    }))
                  }
                >
                  <option value="">-- choose --</option>
                  {flagOptions.map((flag) => (
                    <option key={flag} value={flag}>
                      {flag}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="q_intro_started"
                  value={draft.triggered_if_flag}
                  onChange={(e) =>
                    setDraft((quest) => ({
                      ...quest,
                      triggered_if_flag: e.target.value,
                    }))
                  }
                />
              )}
            </div>

            <div className="qe__field">
              <label>Completion flags</label>
              <div className="qe__checklist">
                {draft.completion_flags.map((flag, index) => (
                  <div className="qe__check-row" key={index}>
                    <input type="checkbox" checked readOnly title="Required" />
                    {flagOptions.length > 0 ? (
                      <select
                        value={flag}
                        onChange={(e) =>
                          updateCompletionFlag(index, e.target.value)
                        }
                      >
                        <option value="">-- choose --</option>
                        {flagOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="q_intro_finished"
                        value={flag}
                        onChange={(e) =>
                          updateCompletionFlag(index, e.target.value)
                        }
                      />
                    )}
                    <button
                      className="delete-btn"
                      onClick={() =>
                        setDraft((quest) => ({
                          ...quest,
                          completion_flags:
                            quest.completion_flags.length > 1
                              ? quest.completion_flags.filter((_, i) => i !== index)
                              : [""],
                        }))
                      }
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="qe__add-flag-btn"
                onClick={() =>
                  setDraft((quest) => ({
                    ...quest,
                    completion_flags: [...quest.completion_flags, ""],
                  }))
                }
              >
                + Add completion flag
              </button>
            </div>

            {error && <p className="qe__error">{error}</p>}

            <div className="qe__panel-actions">
              <button className="qe__save-btn" onClick={saveDraft}>
                Save Quest
              </button>
              <button
                className="qe__cancel-btn"
                onClick={() => {
                  setEditingId(null);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="qe__footer">
        <span>Quest file v{version}</span>
        <div className="qe__version-wrap">
          <label>Version</label>
          <input
            type="number"
            min={1}
            value={version}
            onChange={(e) => {
              const nextVersion = Math.max(1, Number(e.target.value));
              setVersion(nextVersion);
              persist(quests, nextVersion);
            }}
          />
        </div>
        <span>{quests.length} quests</span>
        <span>{flagOptions.length} flags available</span>
      </div>
    </div>
  );
}
