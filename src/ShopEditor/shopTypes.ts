import type { Condition } from "../types";

export interface ItemCatalogItem {
  id: string;
  display_name: string;
  type: string;
  default_price: number;
  max_stack: number;
  description: string;
}

export interface ItemCatalog {
  items: ItemCatalogItem[];
}

export type RestockMode = "none" | "daily" | "unlimited";

export interface ShopEntry {
  item_id: string;
  item_description: string;
  price_override: number | null;
  quantity: number;
  restock: RestockMode;
  condition: Condition | null;
  sort_order: number;
}

export interface ShopDefinition {
  id: string;
  display_name: string;
  description: string;
  entries: ShopEntry[];
}

export interface ShopDefinitionsFile {
  version: number;
  shops: ShopDefinition[];
}
