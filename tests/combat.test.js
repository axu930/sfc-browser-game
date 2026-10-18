import test from "node:test";
import assert from "node:assert/strict";
import { simulateBattle } from "../src/game/combat.js";

test("battle adapter returns integer ship losses, survivors, and debris", () => {
  const result = simulateBattle({ lightFighter: 8 }, { lightFighter: 5 });
  assert.equal(result.winner, "attacker");
  assert.equal(result.attackerShips.lightFighter + result.attackerLosses.lightFighter, 8);
  assert.equal(result.defenderShips.lightFighter + result.defenderLosses.lightFighter, 5);
  assert.ok(Number.isInteger(result.attackerShips.lightFighter));
  assert.ok(result.debris.ore > 0);
  assert.ok(result.debris.crystal > 0);
});

test("empty attacker rosters are rejected from battle simulation only by outcome, not shape", () => {
  const result = simulateBattle({}, { lightFighter: 1 });
  assert.equal(result.winner, "defender");
});
