import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, loadState, resetState, saveState } from "../src/game/state.js";

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
