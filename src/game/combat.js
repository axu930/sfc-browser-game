/*
 * Game-facing battle adapter. The expected-value kernel is adapted from
 * axu930/sfc-fleet-optimizer (Apache-2.0); see battle-kernel.js and LICENSE.
 * This adapter maps the prototype catalog and save research into that model,
 * then converts expected survivors to whole ships for persistent game state.
 */
import { GAME_RULES, SHIPS } from "./catalog.js";
import { simulateExpectedBattle } from "./battle-kernel.js";

const UNITS = Object.freeze(Object.fromEntries(Object.entries(SHIPS).map(([id, ship]) => [id, {
  ...ship,
  kind: "ship",
  sourceClass: sourceClassFor(id, ship)
}])));

function sourceClassFor(id, ship) {
  const known = {
    lightFighter: "Artemis",
    smallCargo: "Atlas",
    espionageProbe: "Hermes Probe",
    recycler: "Dionysus",
    colonyShip: "Gaia"
  };
  return known[id] || ship.name || id;
}

function normalizedLevel(research, keys) {
  for (const key of keys) {
    const value = Number(research?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function normalizeResearch(research) {
  return {
    weapons: normalizedLevel(research, ["weaponsTechnology", "weapons", "weaponsTechnologyLevel"]),
    shield: normalizedLevel(research, ["shieldingTechnology", "shield", "shieldingTechnologyLevel"]),
    armor: normalizedLevel(research, ["armorTechnology", "armor", "armorTechnologyLevel"])
  };
}

function normalizeRoster(roster, label) {
  if (roster == null) return {};
  if (typeof roster !== "object" || Array.isArray(roster)) throw new TypeError(`${label} must be a ship-count object.`);
  const normalized = {};
  for (const [shipId, rawCount] of Object.entries(roster)) {
    if (!Object.hasOwn(UNITS, shipId)) throw new RangeError(`Unknown ${label} ship id: ${shipId}`);
    const count = Number(rawCount);
    if (!Number.isSafeInteger(count) || count < 0) throw new RangeError(`${label} count for ${shipId} must be a non-negative whole number.`);
    normalized[shipId] = count;
  }
  return normalized;
}

function integerizeRoster(initial, expected) {
  const whole = {};
  for (const shipId of Object.keys(initial)) {
    const estimate = Math.max(0, Math.min(initial[shipId], Number(expected[shipId]) || 0));
    // Deterministic nearest-integer rounding (half up) keeps a discrete fleet
    // inventory while minimizing the per-class error from the expected model.
    whole[shipId] = Math.min(initial[shipId], Math.floor(estimate + 0.5));
  }
  return whole;
}

function lossesFrom(initial, remaining) {
  return Object.fromEntries(Object.keys(initial).map(shipId => [shipId, initial[shipId] - (remaining[shipId] || 0)]));
}

function totalShips(roster) {
  return Object.values(roster).reduce((sum, count) => sum + count, 0);
}

function calculateDebris(attackerLosses, defenderLosses) {
  const fraction = Number.isFinite(Number(GAME_RULES.debrisFraction))
    ? Math.max(0, Number(GAME_RULES.debrisFraction))
    : 0.3;
  let ore = 0;
  let crystal = 0;
  for (const losses of [attackerLosses, defenderLosses]) {
    for (const [shipId, count] of Object.entries(losses)) {
      const unit = UNITS[shipId];
      if (!unit || count <= 0) continue;
      ore += (Number(unit.cost?.ore) || 0) * count * fraction;
      crystal += (Number(unit.cost?.crystal) || 0) * count * fraction;
    }
  }
  // Resource balances and debris fields use whole resource units.
  return { ore: Math.floor(ore + 1e-9), crystal: Math.floor(crystal + 1e-9) };
}

/**
 * Simulate an attack with the prototype's deterministic expected-value battle
 * model. Inputs and survivors are integer ship rosters keyed by catalog id.
 * Survivors are rounded independently per ship type using nearest integer,
 * with exact halves rounded up. Consequently this is a repeatable estimate,
 * not a random individual battle roll.
 */
export function simulateBattle(attackerShips, defenderShips, attackerResearch = {}, defenderResearch = {}) {
  const initialAttackers = normalizeRoster(attackerShips, "attacker");
  const initialDefenders = normalizeRoster(defenderShips, "defender");
  const attackerTech = normalizeResearch(attackerResearch);
  const defenderTech = normalizeResearch(defenderResearch);
  const expected = simulateExpectedBattle({
    attackers: Object.fromEntries(Object.entries(initialAttackers).filter(([, count]) => count > 0)),
    defenders: Object.fromEntries(Object.entries(initialDefenders).filter(([, count]) => count > 0)),
    attackerResearch: attackerTech,
    defenderResearch: defenderTech,
    units: UNITS,
    rules: GAME_RULES
  });

  const survivingAttackers = integerizeRoster(initialAttackers, expected.attackerSurvivors);
  const survivingDefenders = integerizeRoster(initialDefenders, expected.defenderSurvivors);
  const attackerLosses = lossesFrom(initialAttackers, survivingAttackers);
  const defenderLosses = lossesFrom(initialDefenders, survivingDefenders);
  const attackerCount = totalShips(survivingAttackers);
  const defenderCount = totalShips(survivingDefenders);
  const winner = attackerCount > 0 && defenderCount === 0
    ? "attacker"
    : defenderCount > 0 && attackerCount === 0
      ? "defender"
      : "draw";
  const debris = calculateDebris(attackerLosses, defenderLosses);
  const outcomeText = winner === "attacker" ? "Attacker victory" : winner === "defender" ? "Defender victory" : "Battle drawn";
  const summary = `${outcomeText} after ${expected.rounds} round${expected.rounds === 1 ? "" : "s"}. Expected survivors are rounded to whole ships by type.`;

  return {
    winner,
    attackerShips: survivingAttackers,
    defenderShips: survivingDefenders,
    attackerLosses,
    defenderLosses,
    debris,
    rounds: expected.rounds,
    summary
  };
}
