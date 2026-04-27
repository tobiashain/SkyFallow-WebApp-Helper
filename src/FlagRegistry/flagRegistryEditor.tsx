import { useState, useCallback, useEffect } from "react";
import type {
  FlagDefinition,
  FlagRegistry,
  FlagCategory,
  FlagValueType,
} from "./flagTypes";
import { exportJson } from "../Timeline/timelineUtils";
import "./FlagRegistryEditor.scss";

const STORAGE_KEY = "flag_registry";

const CATEGORIES: FlagCategory[] = ["event", "world", "quest", "npc", "other"];
const VALUE_TYPES: FlagValueType[] = ["bool", "int", "float", "string"];

const CATEGORY_COLORS: Record<FlagCategory, string> = {
  event: "var(--teal)",
  world: "var(--green)",
  quest: "var(--orange)",
  npc: "var(--pink)",
  other: "var(--muted)",
};

function defaultForType(type: FlagValueType): boolean | number | string {
  if (type === "bool") return false;
  if (type === "string") return "";
  return 0;
}

function makeEmptyFlag(): FlagDefinition {
  return {
    id: "",
    type: "bool",
    default: false,
    category: "event",
    description: "",
  };
}

export function FlagRegistryEditor() {
  const [flags, setFlags] = useState<FlagDefinition[]>([]);
  const [version, setVersion] = useState(1);
  const [filter, setFilter] = useState<FlagCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null); // null = none, "" = new
  const [draft, setDraft] = useState<FlagDefinition>(makeEmptyFlag());
  const [error, setError] = useState("");

  // ── Persistence ────────────────────────────────────────────────────────
  const persist = useCallback((f: FlagDefinition[], v: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: v, flags: f }));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FlagRegistry;
        setFlags(parsed.flags ?? []);
        setVersion(parsed.version ?? 1);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // ── CRUD ───────────────────────────────────────────────────────────────
  const startNew = () => {
    setDraft(makeEmptyFlag());
    setEditingId("");
    setError("");
  };

  const startEdit = (flag: FlagDefinition) => {
    setDraft({ ...flag });
    setEditingId(flag.id);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setError("");
  };

  const saveDraft = () => {
    const id = draft.id.trim();
    if (!id) {
      setError("Flag ID is required.");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(id)) {
      setError("ID must be lowercase letters, digits, or underscores.");
      return;
    }

    const isNew = editingId === "";
    if (isNew && flags.some((f) => f.id === id)) {
      setError(`Flag "${id}" already exists.`);
      return;
    }

    let next: FlagDefinition[];
    if (isNew) {
      next = [...flags, { ...draft, id }];
    } else {
      next = flags.map((f) => (f.id === editingId ? { ...draft, id } : f));
    }
    setFlags(next);
    persist(next, version);
    setEditingId(null);
    setError("");
  };

  const deleteFlag = (id: string) => {
    const next = flags.filter((f) => f.id !== id);
    setFlags(next);
    persist(next, version);
    if (editingId === id) setEditingId(null);
  };

  // ── Import / Export ────────────────────────────────────────────────────
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as FlagRegistry;
        setFlags(parsed.flags ?? []);
        setVersion(parsed.version ?? 1);
        persist(parsed.flags ?? [], parsed.version ?? 1);
      } catch {
        alert("Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  const handleExport = async () => {
    const data: FlagRegistry = { version, flags };
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "flag_registry.json",
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
    exportJson(data, "flag_registry.json");
  };

  // ── Filtered view ──────────────────────────────────────────────────────
  const visible = flags.filter((f) => {
    if (filter !== "all" && f.category !== filter) return false;
    if (
      search &&
      !f.id.includes(search) &&
      !(f.description ?? "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = CATEGORIES.reduce(
    (acc, c) => {
      acc[c] = flags.filter((f) => f.category === c).length;
      return acc;
    },
    {} as Record<FlagCategory, number>,
  );

  return (
    <div className="freg">
      {/* ── Toolbar ── */}
      <div className="freg__toolbar">
        <div className="freg__filters">
          <button
            className={`freg__filter ${filter === "all" ? "freg__filter--active" : ""}`}
            onClick={() => setFilter("all")}
          >
            All <span className="freg__filter-count">{flags.length}</span>
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`freg__filter ${filter === cat ? "freg__filter--active" : ""}`}
              style={
                filter === cat
                  ? {
                      borderColor: CATEGORY_COLORS[cat],
                      color: CATEGORY_COLORS[cat],
                    }
                  : {}
              }
              onClick={() => setFilter(cat)}
            >
              {cat} <span className="freg__filter-count">{counts[cat]}</span>
            </button>
          ))}
        </div>

        <input
          className="freg__search"
          type="text"
          placeholder="Search flags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="freg__actions">
          <label className="freg__import-btn">
            Import
            <input type="file" accept=".json" hidden onChange={handleImport} />
          </label>
          <button className="freg__export-btn" onClick={handleExport}>
            Export
          </button>
          <button className="freg__add-btn" onClick={startNew}>
            + New Flag
          </button>
        </div>
      </div>

      <div className="freg__body">
        {/* ── Flag list ── */}
        <div className="freg__list">
          {visible.length === 0 && (
            <p className="freg__empty">
              No flags yet. Click "+ New Flag" to add one.
            </p>
          )}
          {visible.map((flag) => (
            <div
              key={flag.id}
              className={`freg__row ${editingId === flag.id ? "freg__row--editing" : ""}`}
              onClick={() => editingId !== flag.id && startEdit(flag)}
            >
              <span
                className="freg__cat-dot"
                style={{ background: CATEGORY_COLORS[flag.category] }}
                title={flag.category}
              />
              <span className="freg__flag-id">{flag.id}</span>
              <span className="freg__flag-type">{flag.type}</span>
              <span className="freg__flag-default">{String(flag.default)}</span>
              <span className="freg__flag-desc">{flag.description}</span>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteFlag(flag.id);
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* ── Edit panel ── */}
        {editingId !== null && (
          <div className="freg__panel">
            <h3 className="freg__panel-title">
              {editingId === "" ? "New Flag" : `Edit: ${editingId}`}
            </h3>

            <div className="freg__field">
              <label>ID</label>
              <input
                type="text"
                placeholder="e_met_wizard"
                value={draft.id}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, id: e.target.value }))
                }
                disabled={editingId !== ""}
              />
              <p className="freg__hint">
                Lowercase, underscores only. Prefix: e_ event, w_ world, q_
                quest, n_ npc
              </p>
            </div>

            <div className="freg__field">
              <label>Category</label>
              <div className="freg__cat-pills">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    className={`freg__cat-pill ${draft.category === cat ? "freg__cat-pill--active" : ""}`}
                    style={
                      draft.category === cat
                        ? {
                            background: CATEGORY_COLORS[cat],
                            color: "#fff",
                            borderColor: CATEGORY_COLORS[cat],
                          }
                        : {}
                    }
                    onClick={() => setDraft((d) => ({ ...d, category: cat }))}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="freg__field">
              <label>Type</label>
              <div className="freg__type-pills">
                {VALUE_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`freg__type-pill ${draft.type === t ? "freg__type-pill--active" : ""}`}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        type: t,
                        default: defaultForType(t),
                      }))
                    }
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="freg__field">
              <label>Default value</label>
              {draft.type === "bool" ? (
                <div className="freg__bool-toggle">
                  <button
                    className={`freg__bool-btn ${draft.default === false ? "freg__bool-btn--active" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, default: false }))}
                  >
                    false
                  </button>
                  <button
                    className={`freg__bool-btn ${draft.default === true ? "freg__bool-btn--active" : ""}`}
                    onClick={() => setDraft((d) => ({ ...d, default: true }))}
                  >
                    true
                  </button>
                </div>
              ) : draft.type === "string" ? (
                <input
                  type="text"
                  value={String(draft.default)}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, default: e.target.value }))
                  }
                />
              ) : (
                <input
                  type="number"
                  value={Number(draft.default)}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, default: Number(e.target.value) }))
                  }
                />
              )}
            </div>

            {(draft.type === "int" || draft.type === "float") && (
              <div className="freg__field freg__field--row">
                <div>
                  <label>Min (optional)</label>
                  <input
                    type="number"
                    value={draft.min ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        min:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div>
                  <label>Max (optional)</label>
                  <input
                    type="number"
                    value={draft.max ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        max:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="freg__field">
              <label>Description</label>
              <input
                type="text"
                placeholder="What sets/reads this flag?"
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
              />
            </div>

            {error && <p className="freg__error">{error}</p>}

            <div className="freg__panel-actions">
              <button className="freg__save-btn" onClick={saveDraft}>
                {editingId === "" ? "Add Flag" : "Save Changes"}
              </button>
              <button className="freg__cancel-btn" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer stats ── */}
      <div className="freg__footer">
        <span>Registry v{version}</span>
        <div className="freg__version-wrap">
          <label>Version</label>
          <input
            type="number"
            min={1}
            value={version}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value));
              setVersion(v);
              persist(flags, v);
            }}
          />
        </div>
        <span>{flags.length} flags defined</span>
      </div>
    </div>
  );
}
