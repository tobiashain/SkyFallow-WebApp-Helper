import { useState, useEffect, useCallback } from "react";
import type {
  FlagDefinition,
  FlagRegistry,
  SaveFile,
  SaveFlagValue,
} from "../FlagRegistry/flagTypes";
import { exportJson } from "../Timeline/timelineUtils";
import "./SaveEditor.scss";

const REGISTRY_STORAGE_KEY = "flag_registry";

function renderFlagInput(
  def: FlagDefinition,
  value: SaveFlagValue,
  onChange: (v: SaveFlagValue) => void,
) {
  if (def.type === "bool") {
    return (
      <div className="se__bool-toggle">
        <button
          className={`se__bool-btn ${value === false ? "se__bool-btn--active se__bool-btn--false" : ""}`}
          onClick={() => onChange(false)}
        >
          false
        </button>
        <button
          className={`se__bool-btn ${value === true ? "se__bool-btn--active se__bool-btn--true" : ""}`}
          onClick={() => onChange(true)}
        >
          true
        </button>
      </div>
    );
  }
  if (def.type === "string") {
    return (
      <input
        type="text"
        className="se__input"
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  // int or float
  return (
    <input
      type="number"
      className="se__input se__input--narrow"
      value={Number(value)}
      min={def.min}
      max={def.max}
      step={def.type === "float" ? 0.01 : 1}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function SaveEditor() {
  const [registry, setRegistry] = useState<FlagDefinition[]>([]);
  const [saveFlags, setSaveFlags] = useState<Record<string, SaveFlagValue>>({});
  const [saveVersion, setSaveVersion] = useState(1);
  const [saveLoaded, setSaveLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [showUnknown, setShowUnknown] = useState(false);

  // Load registry from localStorage (written by FlagRegistryEditor)
  useEffect(() => {
    const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FlagRegistry;
        setRegistry(parsed.flags ?? []);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // ── Import registry override ──────────────────────────────────────────
  const handleRegistryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as FlagRegistry;
        setRegistry(parsed.flags ?? []);
      } catch {
        alert("Invalid registry JSON");
      }
    };
    reader.readAsText(file);
  };

  // ── Import save ───────────────────────────────────────────────────────
  const handleSaveImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as SaveFile;
        setSaveFlags(parsed.flags ?? {});
        setSaveVersion(parsed.version ?? 1);
        setSaveLoaded(true);
      } catch {
        alert("Invalid save JSON");
      }
    };
    reader.readAsText(file);
  };

  // ── Export save ───────────────────────────────────────────────────────
  const handleExport = async () => {
    const data: SaveFile = { version: saveVersion, flags: saveFlags };
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: "savegame.json",
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
    exportJson(data, "savegame.json");
  };

  const setFlag = useCallback((id: string, value: SaveFlagValue) => {
    setSaveFlags((prev) => ({ ...prev, [id]: value }));
  }, []);

  const resetFlag = (def: FlagDefinition) => {
    setSaveFlags((prev) => ({ ...prev, [def.id]: def.default }));
  };

  const resetAll = () => {
    const defaults: Record<string, SaveFlagValue> = {};
    registry.forEach((def) => {
      defaults[def.id] = def.default;
    });
    setSaveFlags((prev) => ({ ...prev, ...defaults }));
  };

  // ── Derived ───────────────────────────────────────────────────────────
  const knownIds = new Set(registry.map((f) => f.id));
  const unknownFlags = Object.keys(saveFlags).filter((k) => !knownIds.has(k));

  const visibleFlags = registry.filter((def) => {
    if (!search) return true;
    return (
      def.id.includes(search) ||
      (def.description ?? "").toLowerCase().includes(search.toLowerCase())
    );
  });

  const modifiedCount = registry.filter((def) => {
    const val = saveFlags[def.id];
    return val !== undefined && val !== def.default;
  }).length;

  return (
    <div className="se">
      {/* ── Top bar ── */}
      <div className="se__topbar">
        <div className="se__topbar-section">
          <span className="se__topbar-label">Registry</span>
          {registry.length > 0 ? (
            <span className="se__badge se__badge--green">
              {registry.length} flags loaded
            </span>
          ) : (
            <span className="se__badge se__badge--warn">
              No registry — import one or open Flag Registry tab first
            </span>
          )}
          <label className="se__file-btn">
            Load registry.json
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleRegistryImport}
            />
          </label>
        </div>

        <div className="se__topbar-section">
          <span className="se__topbar-label">Save file</span>
          {saveLoaded ? (
            <span className="se__badge se__badge--green">
              Loaded · v{saveVersion} · {modifiedCount} modified
            </span>
          ) : (
            <span className="se__badge se__badge--muted">
              No save loaded — editing defaults
            </span>
          )}
          <label className="se__file-btn">
            Load save.json
            <input
              type="file"
              accept=".json"
              hidden
              onChange={handleSaveImport}
            />
          </label>
          <button className="se__export-btn" onClick={handleExport}>
            Export save.json
          </button>
        </div>
      </div>

      {/* ── Search & actions ── */}
      <div className="se__toolbar">
        <input
          className="se__search"
          type="text"
          placeholder="Search flags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="se__reset-all-btn" onClick={resetAll}>
          Reset all to defaults
        </button>
        {unknownFlags.length > 0 && (
          <button
            className="se__unknown-btn"
            onClick={() => setShowUnknown((v) => !v)}
          >
            {showUnknown ? "Hide" : "Show"} {unknownFlags.length} unknown flags
          </button>
        )}
      </div>

      {/* ── Flag table ── */}
      <div className="se__table-wrap">
        {registry.length === 0 && (
          <p className="se__empty">
            Load a flag_registry.json or define flags in the Flag Registry tab
            first.
          </p>
        )}

        {visibleFlags.map((def) => {
          const rawVal = saveFlags[def.id];
          const value = rawVal !== undefined ? rawVal : def.default;
          const isModified = rawVal !== undefined && rawVal !== def.default;

          return (
            <div
              key={def.id}
              className={`se__row ${isModified ? "se__row--modified" : ""}`}
            >
              <span className="se__flag-id">{def.id}</span>
              <span className="se__flag-cat">{def.category}</span>
              <span className="se__flag-desc">{def.description}</span>
              <div className="se__flag-input">
                {renderFlagInput(def, value, (v) => setFlag(def.id, v))}
              </div>
              {isModified && (
                <button
                  className="se__reset-btn"
                  onClick={() => resetFlag(def)}
                  title="Reset to default"
                >
                  ↺ {String(def.default)}
                </button>
              )}
            </div>
          );
        })}

        {/* Unknown flags section */}
        {showUnknown && unknownFlags.length > 0 && (
          <div className="se__unknown-section">
            <div className="se__unknown-header">
              ⚠ Unknown flags (in save but not in registry)
            </div>
            {unknownFlags.map((key) => (
              <div key={key} className="se__row se__row--unknown">
                <span className="se__flag-id">{key}</span>
                <span className="se__flag-cat se__flag-cat--unknown">
                  unknown
                </span>
                <span className="se__flag-desc">—</span>
                <input
                  type="text"
                  className="se__input"
                  value={String(saveFlags[key])}
                  onChange={(e) => setFlag(key, e.target.value)}
                />
                <button
                  className="delete-btn"
                  onClick={() =>
                    setSaveFlags((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
