import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, loadState, resetState, saveState, SAVE_KEY, SAVE_VERSION } from "../src/game/state.js";
import { getPlanetProduction } from "../src/game/economy.js";
import { completeDueQueues } from "../src/game/progression.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
}

test("save state persists and reloads the current fleet and resource state", () => {
  const storage = memoryStorage();
  const state = createInitialState(1_000);
  state.planets[0].resources.ore = 42_000;
  state.fleets.push({ id: "fleet-test", mission: "attack", ships: { lightFighter: 2 } });
  assert.equal(saveState(state, storage), true);

  const loaded = loadState(storage, 2_000);
  assert.equal(loaded.planets[0].resources.ore, 42_000);
  assert.equal(loaded.fleets[0].id, "fleet-test");
});

test("reset creates a fresh state using the requested simulation timestamp", () => {
  const storage = memoryStorage();
  saveState(createInitialState(1_000), storage);
  const fresh = resetState(storage, 50_000);
  assert.equal(fresh.now, 50_000);
  assert.equal(loadState(storage, 100_000).now, 50_000);
  assert.equal(fresh.fleets.length, 0);
});

test("version 1 saves migrate the shared depot to resource-specific storage", () => {
  const storage = memoryStorage();
  const legacy = createInitialState(1_000);
  legacy.schemaVersion = 1;
  legacy.planets[0].buildings.storageDepot = 2;
  legacy.planets[0].constructionQueue = [{
    id: "legacy-storage-upgrade", type: "building", target: "storageDepot",
    startedAt: 1_000, completesAt: 3_000
  }];
  delete legacy.planets[0].buildings.oreWarehouse;
  delete legacy.planets[0].buildings.crystalWarehouse;
  delete legacy.planets[0].buildings.hydrogenStorage;
  storage.setItem(SAVE_KEY, JSON.stringify(legacy));

  const migrated = loadState(storage, 2_000);
  const planet = migrated.planets[0];
  assert.equal(migrated.schemaVersion, SAVE_VERSION);
  assert.equal(planet.buildings.storageDepot, undefined);
  assert.equal(planet.buildings.oreWarehouse, 2);
  assert.equal(planet.buildings.crystalWarehouse, 2);
  assert.equal(planet.buildings.hydrogenStorage, 2);
  assert.deepEqual(getPlanetProduction(planet).storageCapacity, { ore: 40000, crystal: 40000, hydrogen: 40000 });

  // A depot upgrade already in progress must expand all three stores when it completes.
  migrated.now = 3_000;
  assert.equal(completeDueQueues(migrated).length, 1);
  assert.equal(planet.buildings.oreWarehouse, 3);
  assert.equal(planet.buildings.crystalWarehouse, 3);
  assert.equal(planet.buildings.hydrogenStorage, 3);
});
