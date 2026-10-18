import { SHIPS } from "./catalog.js";

const resourceStock = (ore, crystal, hydrogen) => ({ ore, crystal, hydrogen });
const fighterId = SHIPS.lightFighter ? "lightFighter" : Object.keys(SHIPS)[0];
const fighterRoster = (count) => fighterId ? { [fighterId]: count } : {};

/**
 * Return a deterministic starter universe. NPC strength and stock are
 * deliberately small, provisional values for the single-player prototype.
 */
export function createInitialUniverse() {
  return {
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
        coordinates: { galaxy: 1, system: 3, slot: 8 },
        ships: {},
        resources: resourceStock(0, 0, 0),
        npcType: "empty"
      },
      {
        id: "empty-world-2",
        name: "Unclaimed World",
        coordinates: { galaxy: 1, system: 5, slot: 5 },
        ships: {},
        resources: resourceStock(0, 0, 0),
        npcType: "empty"
      }
    ],
    debris: []
  };
}
