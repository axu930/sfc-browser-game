import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/game/state.js";
import { queueBuilding } from "../src/game/progression.js";
import { advanceGame } from "../src/game/simulation.js";
import { dispatchMission } from "../src/game/fleets.js";

test("offline simulation completes due work and continues resource production", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  home.resources = { ore: 500, crystal: 100, hydrogen: 100 };
  assert.equal(queueBuilding(state, home.id, "oreMine").ok, true);
  const oreAfterPayment = home.resources.ore;
  const targetTime = home.constructionQueue[0].completesAt + 60 * 60 * 1000;

  assert.equal(advanceGame(state, targetTime), true);
  assert.equal(home.buildings.oreMine, 5);
  assert.ok(home.resources.ore > oreAfterPayment);
  assert.equal(state.now, targetTime);
  assert.ok(state.reports.some(report => report.title.includes("Ore Mine complete")));
});

test("offline simulation resolves fleet arrival and the NPC regroup timer in order", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  const order = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "npc-raider-1",
    mission: "attack",
    ships: { lightFighter: 8 }
  });
  assert.equal(order.ok, true);
  const returnAt = order.fleet.arrivalAt + order.fleet.outboundSeconds * 1000;

  assert.equal(advanceGame(state, returnAt), true);
  assert.equal(state.fleets.length, 0);
  assert.ok(home.ships.lightFighter > 0);
  const target = state.universe.targets.find(entry => entry.id === "npc-raider-1");
  assert.ok(target.respawnAt > returnAt);

  advanceGame(state, target.respawnAt);
  assert.equal(Object.values(target.ships).reduce((sum, count) => sum + count, 0), 5);
  assert.equal(target.respawnAt, undefined);
});
