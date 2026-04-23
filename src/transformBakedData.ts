import type { NpcNavBaked, TransformedScene } from "./types";

export function transformBakedData(raw: NpcNavBaked): TransformedScene[] {
  return Object.entries(raw.scenes).map(([key, scene]) => ({
    id: Number(key),
    name: scene.scene_name ?? `Scene ${key}`,
    tiles: scene.tiles,
    npcs: scene.npcs,
    targets: scene.targets,
  }));
}
