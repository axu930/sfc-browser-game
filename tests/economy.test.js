import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/game/state.js";
import { advancePlanetEconomy, getPlanetProduction } from "../src/game/economy.js";
import { completeDueQueues, getBuildingCost, queueBuilding, queueShips, startResearch } from "../src/game/progression.js";

test("planet economy accrues resources using available energy and storage", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  home.resources = { ore: 100, crystal: 100, hydrogen: 100 };
  const before = { ...home.resources };
  const production = getPlanetProduction(home);
  advancePlanetEconomy(home, 3600);

  assert.ok(production.productionPerHour.ore > 0);
  assert.ok(home.resources.ore > before.ore);
  assert.ok(home.resources.crystal > before.crystal);
  assert.ok(home.resources.hydrogen > before.hydrogen);
  assert.ok(home.resources.ore <= production.storageCapacity);
});

test("building upgrades charge resources and complete at their due time", () => {
  const state = createInitialState(10_000);
  const home = state.planets[0];
  const oldLevel = home.buildings.oreMine;
  const before = { ...home.resources };
  const cost = getBuildingCost("oreMine", oldLevel);

  const result = queueBuilding(state, home.id, "oreMine");
  assert.equal(result.ok, true);
  assert.equal(home.resources.ore, before.ore - cost.ore);
  assert.equal(home.buildings.oreMine, oldLevel);
  state.now = home.constructionQueue[0].completesAt;
  assert.equal(completeDueQueues(state).length, 1);
  assert.equal(home.buildings.oreMine, oldLevel + 1);
});

test("research consumes resources and exposes a completed technology level", () => {
  const state = createInitialState(10_000);
  const home = state.planets[0];
  const result = startResearch(state, "energyTechnology", home.id);
  assert.equal(result.ok, true);
  assert.equal(state.research.energyTechnology, undefined);
  state.now = home.researchQueue[0].completesAt;
  completeDueQueues(state);
  assert.equal(state.research.energyTechnology, 1);
});

test("ship construction validates unlocks and adds ships when its queue completes", () => {
  const state = createInitialState(10_000);
  const home = state.planets[0];
  home.buildings.shipyard = 2;
  state.research.combustionDrive = 2;
  const result = queueShips(state, home.id, "smallCargo", 2);
  assert.equal(result.ok, true);
  assert.equal(home.ships.smallCargo, undefined);
  state.now = home.constructionQueue[0].completesAt;
  completeDueQueues(state);
  assert.equal(home.ships.smallCargo, 2);
});
