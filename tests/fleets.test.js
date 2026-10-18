import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "../src/game/state.js";
import { advanceFleets, dispatchMission } from "../src/game/fleets.js";

test("an attack mission resolves combat, plunder, debris, and a return flight", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  const hydrogen = home.resources.hydrogen;
  const order = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "npc-raider-1",
    mission: "attack",
    ships: { lightFighter: 8 }
  });

  assert.equal(order.ok, true);
  assert.ok(home.resources.hydrogen < hydrogen, "round-trip fuel is charged on dispatch");
  assert.equal(home.ships.lightFighter, 0);
  advanceFleets(state, 200);

  assert.equal(state.fleets.length, 0);
  assert.ok(home.ships.lightFighter > 0);
  assert.ok(state.universe.debris.length > 0);
  assert.ok(state.reports.some(report => report.type === "battle"));
  assert.ok(state.reports.some(report => report.title.includes("returned")));
});

test("colonization consumes the colony ship and creates an owned planet", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  state.research.astrophysics = 1;
  home.ships.colonyShip = 1;
  const order = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "empty-world-1",
    mission: "colonize",
    ships: { colonyShip: 1 }
  });
  assert.equal(order.ok, true);
  advanceFleets(state, 200);
  assert.equal(state.planets.length, 2);
  assert.equal(state.fleets.length, 0);
  assert.ok(state.reports.some(report => report.type === "colony"));
});

test("fleet orders reject missing fuel without consuming ships", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  home.resources.hydrogen = 0;
  const result = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "npc-raider-1",
    mission: "attack",
    ships: { lightFighter: 1 }
  });
  assert.equal(result.ok, false);
  assert.equal(home.ships.lightFighter, 8);
});

test("recyclers collect debris and carry the resources back to the origin", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  home.ships.recycler = 1;
  state.research.combustionDrive = 2;
  state.universe.debris.push({
    id: "debris-test", coordinates: { galaxy: 1, system: 2, slot: 4 }, ore: 1200, crystal: 600
  });
  const order = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "debris-test",
    mission: "harvest",
    ships: { recycler: 1 }
  });
  assert.equal(order.ok, true);
  advanceFleets(state, 200);
  assert.equal(state.universe.debris.length, 0);
  assert.ok(home.resources.ore >= 13200);
  assert.ok(home.resources.crystal >= 9600);
});

test("transport moves a resource manifest between owned planets", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  home.ships.smallCargo = 1;
  home.resources.ore -= 1000;
  state.research.combustionDrive = 2;
  state.planets.push({
    id: "planet-colony", name: "Colony 1", coordinates: { galaxy: 1, system: 1, slot: 8 },
    resources: { ore: 0, crystal: 0, hydrogen: 0 }, buildings: {}, ships: {}, constructionQueue: [], researchQueue: []
  });
  const order = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "planet-colony",
    mission: "transport",
    ships: { smallCargo: 1 },
    cargo: { ore: 1000, crystal: 0, hydrogen: 0 }
  });
  assert.equal(order.ok, true);
  advanceFleets(state, 30);
  assert.equal(state.planets[1].resources.ore, 1000);
  assert.equal(state.fleets.length, 0);
  assert.ok(state.reports.some(report => report.title.includes("Transport arrived")));
});

test("espionage probes return an intelligence report", () => {
  const state = createInitialState(1_000);
  const home = state.planets[0];
  const result = dispatchMission(state, {
    originPlanetId: home.id,
    targetId: "npc-raider-1",
    mission: "espionage",
    ships: { espionageProbe: 2 }
  });
  assert.equal(result.ok, true);
  advanceFleets(state, 200);
  const report = state.reports.find(entry => entry.type === "espionage");
  assert.ok(report);
  assert.match(report.text, /intelligence gathered/i);
});
