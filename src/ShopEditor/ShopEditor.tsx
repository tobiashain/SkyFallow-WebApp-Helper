import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { EditableCondition } from "../EditableCondition";
import type { FlagDefinition, FlagRegistry } from "../FlagRegistry/flagTypes";
import { exportJson } from "../Timeline/timelineUtils";
import type { Condition } from "../types";
import type {
  ItemCatalog,
  ItemCatalogItem,
  RestockMode,
  ShopDefinition,
  ShopDefinitionsFile,
  ShopEntry,
} from "./shopTypes";
import "./shopEditor.scss";

const CATALOG_KEY = "item_catalog";
const SHOPS_KEY = "shop_definitions";
const REGISTRY_KEY = "flag_registry";

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

// ── Templates ────────────────────────────────────────────────────────────────

function makeShop(): ShopDefinition {
  return { id: crypto.randomUUID(), display_name: "", description: "", entries: [] };
}

function makeEntry(items: ItemCatalogItem[]): ShopEntry {
  return {
    item_id: items.length > 0 ? items[0].id : "",
    item_description: "",
    price_override: null,
    quantity: 10,
    restock: "none",
    condition: null,
    sort_order: 0,
  };
}

// ── Normalization ────────────────────────────────────────────────────────────

function normalizeCatalog(raw: unknown): ItemCatalog {
  if (raw && typeof raw === "object" && "items" in raw) {
    const obj = raw as Record<string, unknown>;
    return {
      items: Array.isArray(obj.items)
        ? (obj.items as ItemCatalogItem[]).filter(
            (item): item is ItemCatalogItem =>
              typeof item.id === "string" && item.id.trim() !== "",
          )
        : [],
    };
  }
  return { items: [] };
}

function normalizeEntry(raw: Partial<ShopEntry> & Record<string, unknown>): ShopEntry {
  return {
    item_id: typeof raw.item_id === "string" ? raw.item_id : "",
    item_description: typeof raw.item_description === "string" ? raw.item_description : "",
    price_override:
      raw.price_override === null || raw.price_override === undefined
        ? null
        : typeof raw.price_override === "number"
          ? raw.price_override
          : null,
    quantity: typeof raw.quantity === "number" ? raw.quantity : 10,
    restock: ["none", "daily", "unlimited"].includes(String(raw.restock))
      ? (raw.restock as RestockMode)
      : "none",
    condition: (raw.condition as Condition) ?? null,
    sort_order: typeof raw.sort_order === "number" ? raw.sort_order : 0,
  };
}

function normalizeShop(raw: Partial<ShopDefinition> & Record<string, unknown>): ShopDefinition {
  return {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id
        : crypto.randomUUID(),
    display_name: typeof raw.display_name === "string" ? raw.display_name : "",
    description: typeof raw.description === "string" ? raw.description : "",
    entries: Array.isArray(raw.entries)
      ? raw.entries.map((e) => normalizeEntry(e as Partial<ShopEntry> & Record<string, unknown>))
      : [],
  };
}

function normalizeShopsFile(raw: unknown): ShopDefinitionsFile {
  if (raw && typeof raw === "object" && "shops" in raw) {
    const obj = raw as Partial<ShopDefinitionsFile>;
    return {
      version: typeof obj.version === "number" ? obj.version : 1,
      shops: Array.isArray(obj.shops)
        ? obj.shops.map((s) => normalizeShop(s as Partial<ShopDefinition> & Record<string, unknown>))
        : [],
    };
  }
  return { version: 1, shops: [] };
}

// ── LocalStorage loaders ─────────────────────────────────────────────────────

function loadStoredCatalog(): ItemCatalog {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return { items: [] };
    return normalizeCatalog(JSON.parse(raw));
  } catch {
    return { items: [] };
  }
}

function loadStoredShops(): ShopDefinitionsFile {
  try {
    const raw = localStorage.getItem(SHOPS_KEY);
    if (!raw) return { version: 1, shops: [] };
    return normalizeShopsFile(JSON.parse(raw));
  } catch {
    return { version: 1, shops: [] };
  }
}

function loadStoredRegistry(): FlagDefinition[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FlagRegistry;
    return parsed.flags ?? [];
  } catch {
    return [];
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function ShopEditor() {
  const [storedCatalog] = useState<ItemCatalog>(loadStoredCatalog);
  const [catalog, setCatalog] = useState<ItemCatalogItem[]>(storedCatalog.items);
  const [storedShops] = useState<ShopDefinitionsFile>(loadStoredShops);
  const [shops, setShops] = useState<ShopDefinition[]>(storedShops.shops);
  const [version, setVersion] = useState(storedShops.version);
  const [registry] = useState<FlagDefinition[]>(loadStoredRegistry);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShopDefinition | null>(null);
  const [editingNew, setEditingNew] = useState(false);
  const [error, setError] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const flagOptions = useMemo(() => registry.map((f) => f.id), [registry]);

  const persistShops = useCallback(
    (nextShops: ShopDefinition[], nextVersion: number) => {
      localStorage.setItem(
        SHOPS_KEY,
        JSON.stringify({ version: nextVersion, shops: nextShops }),
      );
    },
    [],
  );

  const persistCatalog = useCallback((next: ItemCatalogItem[]) => {
    localStorage.setItem(CATALOG_KEY, JSON.stringify({ items: next }));
  }, []);

  // ── Shop CRUD ──────────────────────────────────────────────────────────────

  const selectShop = useCallback((shop: ShopDefinition) => {
    setEditing({ ...shop, entries: shop.entries.map((e) => ({ ...e })) });
    setSelectedId(shop.id);
    setEditingNew(false);
    setError("");
  }, []);

  const startNewShop = useCallback(() => {
    const draft = makeShop();
    setEditing(draft);
    setSelectedId(draft.id);
    setEditingNew(true);
    setError("");
  }, []);

  const cancelEdit = useCallback(() => {
    setSelectedId(null);
    setEditing(null);
    setEditingNew(false);
    setError("");
  }, []);

  const saveShop = useCallback(() => {
    if (!editing) return;
    const cleaned: ShopDefinition = {
      ...editing,
      display_name: editing.display_name.trim(),
      description: editing.description.trim(),
      entries: editing.entries.map((e, i) => ({ ...e, sort_order: i })),
    };
    if (!cleaned.display_name) {
      setError("Shop name is required.");
      return;
    }
    const next = editingNew
      ? [...shops, cleaned]
      : shops.map((s) => (s.id === cleaned.id ? cleaned : s));
    setShops(next);
    persistShops(next, version);
    setSelectedId(cleaned.id);
    setEditing(cleaned);
    setEditingNew(false);
    setError("");
  }, [editing, editingNew, shops, persistShops, version]);

  const deleteShop = useCallback(
    (id: string) => {
      const next = shops.filter((s) => s.id !== id);
      setShops(next);
      persistShops(next, version);
      if (selectedId === id) {
        setSelectedId(null);
        setEditing(null);
      }
    },
    [shops, persistShops, selectedId, version],
  );

  const deleteEntry = useCallback(
    (index: number) => {
      if (!editing) return;
      const entries = editing.entries.filter((_, i) => i !== index);
      setEditing({ ...editing, entries });
    },
    [editing],
  );

  const addEntry = useCallback(() => {
    if (!editing) return;
    setEditing({ ...editing, entries: [...editing.entries, makeEntry(catalog)] });
  }, [editing, catalog]);

  const updateEntry = useCallback(
    (index: number, patch: Partial<ShopEntry>) => {
      if (!editing) return;
      const entries = editing.entries.map((e, i) =>
        i === index ? { ...e, ...patch } : e,
      );
      setEditing({ ...editing, entries });
    },
    [editing],
  );

  const moveEntry = useCallback(
    (from: number, to: number) => {
      if (!editing || from === to) return;
      const entries = [...editing.entries];
      const [moved] = entries.splice(from, 1);
      entries.splice(to, 0, moved);
      setEditing({ ...editing, entries });
    },
    [editing],
  );

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const onDragStart = (index: number) => setDragIdx(index);
  const onDragOver = (e: DragEvent) => e.preventDefault();
  const onDrop = (to: number) => {
    if (dragIdx !== null) moveEntry(dragIdx, to);
    setDragIdx(null);
  };

  // ── Import / Export ────────────────────────────────────────────────────────

  const handleCatalogImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = normalizeCatalog(JSON.parse(ev.target?.result as string));
          setCatalog(parsed.items);
          persistCatalog(parsed.items);
        } catch {
          alert("Invalid item catalog JSON");
        }
      };
      reader.readAsText(file);
    },
    [persistCatalog],
  );

  const handleShopsImport = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = normalizeShopsFile(JSON.parse(ev.target?.result as string));
          setShops(parsed.shops);
          setVersion(parsed.version);
          persistShops(parsed.shops, parsed.version);
          setSelectedId(null);
          setEditing(null);
        } catch {
          alert("Invalid shop definitions JSON");
        }
      };
      reader.readAsText(file);
    },
    [persistShops],
  );

  const handleExport = useCallback(async () => {
    const data: ShopDefinitionsFile = { version, shops };
    const saveWindow = window as JsonSaveWindow;
    if (saveWindow.showSaveFilePicker) {
      try {
        const handle = await saveWindow.showSaveFilePicker({
          suggestedName: "shop_definitions.json",
          types: [
            { description: "JSON file", accept: { "application/json": [".json"] } },
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
    exportJson(data, "shop_definitions.json");
  }, [shops, version]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const itemExists = useCallback(
    (itemId: string) => catalog.some((item) => item.id === itemId),
    [catalog],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="se">
      {/* Toolbar */}
      <div className="se__toolbar">
        <label className="se__import-btn">
          Import Catalog
          <input type="file" accept=".json" hidden onChange={handleCatalogImport} />
        </label>
        <label className="se__import-btn">
          Import Shops
          <input type="file" accept=".json" hidden onChange={handleShopsImport} />
        </label>
        <button className="se__export-btn" onClick={handleExport}>
          Export shop_definitions.json
        </button>
        <button className="se__add-btn" onClick={startNewShop}>
          + New Shop
        </button>
      </div>

      {/* Body: sidebar + panel */}
      <div className="se__body">
        {/* Sidebar: shop list */}
        <div className="se__sidebar">
          {shops.length === 0 && (
            <p className="se__empty">No shops yet. Click "+ New Shop" to add one.</p>
          )}
          {shops.map((shop) => (
            <div
              key={shop.id}
              className={`se__shop-row ${selectedId === shop.id ? "se__shop-row--active" : ""}`}
              onClick={() => selectShop(shop)}
            >
              <div className="se__shop-row-main">
                <span className="se__shop-name">
                  {shop.display_name || "(unnamed)"}
                </span>
                <span className="se__shop-meta">
                  {shop.entries.length} item{shop.entries.length === 1 ? "" : "s"}
                </span>
              </div>
              <button
                className="delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteShop(shop.id);
                }}
              >
                x
              </button>
            </div>
          ))}
        </div>

        {/* Panel: shop editor */}
        {editing && (
          <div className="se__panel">
            <h3 className="se__panel-title">
              {editingNew ? "New Shop" : "Edit Shop"}
            </h3>

            <div className="se__field">
              <label>Name</label>
              <input
                type="text"
                value={editing.display_name}
                onChange={(e) => setEditing({ ...editing, display_name: e.target.value })}
              />
            </div>

            <div className="se__field">
              <label>Description</label>
              <textarea
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>

            {/* Entries */}
            <div className="se__field">
              <label>Items ({editing.entries.length})</label>
              {catalog.length === 0 && (
                <p className="se__hint">Import an item catalog to add items to this shop.</p>
              )}

              <div className="se__entries">
                {editing.entries.map((entry, i) => (
                  <div
                    key={i}
                    className={`se__entry ${dragIdx === i ? "se__entry--dragging" : ""}`}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={onDragOver}
                    onDrop={() => onDrop(i)}
                  >
                    <span className="se__drag-handle">⠿</span>

                    <div className="se__entry-fields">
                      <div className="se__entry-row">
                        <select
                          className="se__item-select"
                          value={entry.item_id}
                          onChange={(e) =>
                            updateEntry(i, { item_id: e.target.value })
                          }
                        >
                          <option value="">-- choose item --</option>
                          {catalog.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.display_name} ({item.id})
                            </option>
                          ))}
                        </select>
                        {entry.item_id && !itemExists(entry.item_id) && (
                          <span className="se__warn">missing from catalog</span>
                        )}
                      </div>

                      <div className="se__entry-row">
                        <input
                          type="text"
                          className="se__desc-input"
                          placeholder="Shop-specific description..."
                          value={entry.item_description}
                          onChange={(e) =>
                            updateEntry(i, { item_description: e.target.value })
                          }
                        />
                      </div>

                      <div className="se__entry-row se__entry-row--prices">
                        <div className="se__price-group">
                          <label>Price</label>
                          <input
                            type="number"
                            min={-1}
                            value={entry.price_override ?? -1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              updateEntry(i, {
                                price_override: v < 0 ? null : v,
                              });
                            }}
                          />
                          <span className="se__price-hint">
                            {entry.price_override !== null
                              ? `override (buy: ${entry.price_override}g, sell: ${Math.max(1, Math.ceil(entry.price_override / 2))}g)`
                              : "using default price"}
                          </span>
                        </div>
                        <div className="se__qty-group">
                          <label>Qty</label>
                          <input
                            type="number"
                            min={0}
                            value={entry.quantity}
                            onChange={(e) =>
                              updateEntry(i, { quantity: Math.max(0, Number(e.target.value)) })
                            }
                          />
                        </div>
                        <select
                          value={entry.restock}
                          onChange={(e) =>
                            updateEntry(i, {
                              restock: e.target.value as RestockMode,
                            })
                          }
                        >
                          <option value="none">Lifetime</option>
                          <option value="daily">Daily</option>
                          <option value="unlimited">Unlimited</option>
                        </select>
                      </div>

                      <div className="se__entry-row">
                        <label className="se__cond-label">Visibility condition</label>
                        <EditableCondition
                          condition={entry.condition}
                          onChange={(c) => updateEntry(i, { condition: c })}
                          flagOptions={flagOptions}
                        />
                      </div>
                    </div>

                    <button className="delete-btn" onClick={() => deleteEntry(i)}>
                      x
                    </button>
                  </div>
                ))}
              </div>

              <button className="se__add-entry-btn" onClick={addEntry}>
                + Add Item
              </button>
            </div>

            {error && <p className="se__error">{error}</p>}

            <div className="se__panel-actions">
              <button className="se__save-btn" onClick={saveShop}>
                Save Shop
              </button>
              <button className="se__cancel-btn" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="se__footer">
        <span>Shop file v{version}</span>
        <div className="se__version-wrap">
          <label>Version</label>
          <input
            type="number"
            min={1}
            value={version}
            onChange={(e) => {
              const v = Math.max(1, Number(e.target.value));
              setVersion(v);
              persistShops(shops, v);
            }}
          />
        </div>
        <span>{shops.length} shops</span>
        <span>{catalog.length} items in catalog</span>
        <span>{flagOptions.length} flags available</span>
      </div>
    </div>
  );
}
