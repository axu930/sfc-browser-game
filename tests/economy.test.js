import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/game/state.js";
import { advancePlanetEconomy, getMineLevelMultiplier, getPlanetProduction } from "../src/game/economy.js";
import { completeDueQueues, getBuildingCost, getBuildingDurationSeconds, getResearchDurationSeconds, getShipDurationSeconds, queueBuilding, queueShips, startResearch } from "../src/game/progression.js";

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
  assert.ok(home.resources.ore <= production.storageCapacity.ore);
  assert.ok(home.resources.crystal <= production.storageCapacity.crystal);
  assert.ok(home.resources.hydrogen <= production.storageCapacity.hydrogen);
  assert.deepEqual(production.storageCapacity, { ore: 20000, crystal: 20000, hydrogen: 20000 });
});

test("mines scale production and energy by level and charge level times exponential cost", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  assert.equal(getMineLevelMultiplier(1, 1.3), 1.3);
  assert.equal(getMineLevelMultiplier(2, 1.3), 2 * 1.3 ** 2);
  assert.deepEqual(getBuildingCost("oreMine", 0), { ore: 78, crystal: 20, hydrogen: 0 });

  home.buildings.oreWarehouse = 2;
  home.buildings.crystalWarehouse = 1;
  home.buildings.hydrogenStorage = 0;
  assert.deepEqual(getPlanetProduction(home).storageCapacity, { ore: 40000, crystal: 20000, hydrogen: 10000 });
});

test("build times use cost-based Capitol, Shipyard, Foundry, and Research Lab formulas", () => {
  const home = createInitialState(1_000).planets[0];
  assert.ok(Math.abs(getBuildingDurationSeconds(home, "oreMine", 0) - 35.28) < 1e-9);
  assert.equal(getShipDurationSeconds(home, "lightFighter"), 144);
  assert.equal(getResearchDurationSeconds(home, "energyTechnology", 0), 720);

  home.buildings.foundry = 1;
  assert.ok(Math.abs(getBuildingDurationSeconds(home, "oreMine", 0) - 23.52) < 1e-9);
  assert.equal(getShipDurationSeconds(home, "lightFighter"), 96);
  assert.equal(getResearchDurationSeconds(home, "energyTechnology", 0), 720);
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
