import { SHIPS } from "./catalog.js";

const resourceStock = (ore, crystal, hydrogen) => ({ ore, crystal, hydrogen });
const fighterId = SHIPS.lightFighter ? "lightFighter" : Object.keys(SHIPS)[0];
const fighterRoster = (count) => fighterId ? { [fighterId]: count } : {};

export const SYSTEM_SLOT_COUNT = 15;
export const UNIVERSE_LIMITS = Object.freeze({ galaxies: 35, systemsPerGalaxy: 499 });

// Alternate planetary berths and orbital positions, beginning and ending with a
// planetary berth. Per-system overrides keep later stations or anomalies data-driven.
const defaultSlotLayout = Object.freeze(Array.from({ length: SYSTEM_SLOT_COUNT }, (_, index) => {
  const slot = index + 1;
  const kind = slot % 2 === 1 ? "planet" : "orbit";
  return Object.freeze({
    slot,
    kind,
    label: kind === "planet" ? "Planetary berth" : "Orbital position"
  });
}));

export function getSystemSlotLayout(universe, galaxy, system) {
  const overrides = universe?.slotLayouts?.[`${galaxy}:${system}`] ?? {};
  return defaultSlotLayout.map(definition => ({
    ...definition,
    ...(overrides[definition.slot] ?? {}),
    slot: definition.slot
  }));
}

export function isPlanetSlot(universe, coordinates) {
  const slot = Number(coordinates?.slot);
  return getSystemSlotLayout(universe, coordinates?.galaxy, coordinates?.system)
    .some(definition => definition.slot === slot && definition.kind === "planet");
}

export function createUnclaimedWorldTarget(coordinates) {
  const point = {
    galaxy: Number(coordinates?.galaxy),
    system: Number(coordinates?.system),
    slot: Number(coordinates?.slot)
  };
  return {
    id: `open-world-${point.galaxy}-${point.system}-${point.slot}`,
    name: "Unclaimed World",
    coordinates: point,
    ships: {},
    resources: resourceStock(0, 0, 0),
    npcType: "empty"
  };
}

// Re-slot legacy colonies and empty-world targets when loading saves created
// before the 8-berth / 7-orbit layout. In-flight missions keep their target IDs;
// update cached coordinates so their arrival reports point at the migrated slot.
export function migrateLegacyPlanetarySlots(state) {
  if (!state?.universe) return state;
  state.universe.slotLayouts ??= {};
  state.universe.targets ??= [];
  state.universe.debris ??= [];

  const groups = new Map();
  const addToGroup = (item, type) => {
    const coordinates = item?.coordinates;
    if (!coordinates) return;
    const key = `${coordinates.galaxy}:${coordinates.system}`;
    const group = groups.get(key) ?? { planets: [], targets: [], blockers: [] };
    group[type].push(item);
    groups.set(key, group);
  };
  state.planets?.forEach(item => addToGroup(item, "planets"));
  state.universe.targets.forEach(item => {
    const canColonize = item.npcType === "empty" || item.habitable === true || item.available === true;
    addToGroup(item, canColonize ? "targets" : "blockers");
  });

  const moves = new Map();
  const movesById = new Map();
  for (const group of groups.values()) {
    const coordinates = [...group.planets, ...group.targets, ...group.blockers].map(item => item.coordinates);
    const sample = coordinates[0];
    const layout = getSystemSlotLayout(state.universe, sample.galaxy, sample.system);
    const validBerths = layout.filter(definition => definition.kind === "planet").map(definition => definition.slot);
    const reservedItems = [...group.planets, ...group.targets, ...group.blockers];
    const occupied = new Set(reservedItems.filter(item => validBerths.includes(Number(item.coordinates.slot)))
      .map(item => Number(item.coordinates.slot)));
    const movable = [...group.planets.filter(item => !validBerths.includes(Number(item.coordinates.slot))),
      ...group.targets.filter(item => !validBerths.includes(Number(item.coordinates.slot)))];

    for (const item of movable) {
      const old = item.coordinates;
      const nextSlot = validBerths
        .filter(slot => !occupied.has(slot))
        .sort((a, b) => Math.abs(a - Number(old.slot)) - Math.abs(b - Number(old.slot)))[0];
      if (nextSlot === undefined) continue;
      occupied.add(nextSlot);
      const key = `${old.galaxy}:${old.system}:${old.slot}`;
      const next = { ...old, slot: nextSlot };
      item.coordinates = next;
      moves.set(key, next);
      if (item.id) movesById.set(item.id, next);
    }
  }

  for (const fleet of state.fleets ?? []) {
    const next = movesById.get(fleet.targetId)
      ?? moves.get(`${fleet.targetCoordinates?.galaxy}:${fleet.targetCoordinates?.system}:${fleet.targetCoordinates?.slot}`);
    if (next) fleet.targetCoordinates = { ...next };
  }
  return state;
}

/**
 * Return a deterministic starter universe. NPC strength and stock are
 * deliberately small, provisional values for the single-player prototype.
 */
export function createInitialUniverse() {
  return {
    slotLayouts: {},
    targets: [
      {
        id: "npc-raider-1",
        name: "Raider Outpost",
        coordinates: { galaxy: 1, system: 2, slot: 4 },
        ships: fighterRoster(5),
        resources: resourceStock(5000, 3200, 1800),
        npcType: "raider",
        spawnProfile: { ships: fighterRoster(5), resources: resourceStock(5000, 3200, 1800) }
      },
      {
        id: "npc-raider-2",
        name: "Outer Belt Raiders",
        coordinates: { galaxy: 1, system: 4, slot: 6 },
        ships: fighterRoster(9),
        resources: resourceStock(8500, 5000, 2600),
        npcType: "raider",
        spawnProfile: { ships: fighterRoster(9), resources: resourceStock(8500, 5000, 2600) }
      },
      {
        id: "empty-world-1",
        name: "Unclaimed World",
        coordinates: { galaxy: 1, system: 3, slot: 7 },
        ships: {},
        resources: resourceStock(0, 0, 0),
        npcType: "empty"
      },
      {
        id: "empty-world-2",
        name: "Unclaimed World",
        coordinates: { galaxy: 1, system: 5, slot: 7 },
        ships: {},
        resources: resourceStock(0, 0, 0),
        npcType: "empty"
      }
    ],
    debris: []
  };
}
