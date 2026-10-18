import { GAME_RULES } from "./catalog.js";
import { createInitialUniverse, migrateLegacyPlanetarySlots } from "./universe.js";

export const SAVE_KEY = "sfc-browser-game-save";
export const SAVE_VERSION = 2;

export function createInitialState(now = Date.now()) {
  return {
    schemaVersion: SAVE_VERSION,
    now,
    player: { name: "Commander" },
    research: {},
    planets: [{
      id: "planet-home",
      name: "New Terra",
      coordinates: { galaxy: 1, system: 1, slot: 3 },
      resources: { ore: 12000, crystal: 9000, hydrogen: 5000 },
      buildings: {
        capitol: 1, oreMine: 4, crystalMine: 3, hydrogenSynthesizer: 2, solarPlant: 6,
        oreWarehouse: 1, crystalWarehouse: 1, hydrogenStorage: 1,
        roboticsFactory: 1, researchLab: 1, shipyard: 1, foundry: 0
      },
      ships: { lightFighter: 8, espionageProbe: 2 },
      constructionQueue: [],
      researchQueue: []
    }],
    universe: createInitialUniverse(),
    fleets: [],
    reports: [{
      id: "report-welcome", at: now, type: "system",
      title: "Welcome to the frontier",
      text: "Your colony is online. Expand its economy, research new capabilities, and investigate the Raider Outpost in system 2."
    }],
    nextId: 1,
    _rulesVersion: GAME_RULES.version
  };
}

export function loadState(storage = globalThis.localStorage, now = Date.now()) {
  if (!storage) return createInitialState(now);
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return createInitialState(now);
    const parsed = JSON.parse(raw);
    if (!parsed || ![1, SAVE_VERSION].includes(parsed.schemaVersion) || !Array.isArray(parsed.planets)) {
      return createInitialState(now);
    }
    if (parsed.schemaVersion === 1) {
      for (const planet of parsed.planets) {
        planet.buildings ??= {};
        const oldStorageLevel = planet.buildings.storageDepot;
        if (oldStorageLevel !== undefined) {
          planet.buildings.oreWarehouse ??= oldStorageLevel;
          planet.buildings.crystalWarehouse ??= oldStorageLevel;
          planet.buildings.hydrogenStorage ??= oldStorageLevel;
          delete planet.buildings.storageDepot;
        }
        for (const item of planet.constructionQueue ?? []) {
          if (item.type === "building" && item.target === "storageDepot") {
            item.target = "oreWarehouse";
            item.migrateSharedStorage = true;
          }
        }
      }
      parsed.schemaVersion = SAVE_VERSION;
      parsed._rulesVersion = GAME_RULES.version;
    }
    return migrateLegacyPlanetarySlots(parsed);
  } catch {
    return createInitialState(now);
  }
}

export function saveState(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function resetState(storage = globalThis.localStorage, now = Date.now()) {
  const state = createInitialState(now);
  saveState(state, storage);
  return state;
}

export function makeId(state, prefix = "item") {
  const id = `${prefix}-${state.nextId ?? 1}`;
  state.nextId = (state.nextId ?? 1) + 1;
  return id;
}
