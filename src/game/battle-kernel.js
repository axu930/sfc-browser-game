/*
 * Adapted from js/sfc2-combat.js in axu930/sfc-fleet-optimizer
 * at commit 12c8a866031c96127f182e29269fc9b6dba41b25.
 * Copyright and license terms: Apache-2.0; see repository LICENSE.
 * Modified for the single-player browser game: ES module, catalog-injected,
 * Hephaestus excluded, and configured by the caller.
 */

const RESOLUTION = 20;
const DEFAULT_MAX_ROUNDS = 6;
const POISSON_MAX_LAMBDA = 20;

const RAPID_FIRE_BY_SOURCE_NAME = Object.freeze({
  Apollo: Object.freeze({ Atlas: 3 }),
  Poseidon: Object.freeze({ Artemis: 6, "Missile Battery": 10 }),
  Ares: Object.freeze({ "Missile Battery": 20, "Laser Cannon": 20, "Pulse Cannon": 10, "Particle Cannon": 10 }),
  Hades: Object.freeze({ Athena: 7, Apollo: 4, Poseidon: 4, Atlas: 3, Hercules: 3, Carmanor: 2 }),
  Prometheus: Object.freeze({ Hades: 2, "Laser Cannon": 10 })
});

const SOURCE_CLASS_BY_ID = Object.freeze({
  lightFighter: "Artemis",
  smallCargo: "Atlas",
  espionageProbe: "Hermes Probe",
  recycler: "Dionysus",
  colonyShip: "Gaia"
});
const UNIVERSAL_FODDER_IDS = new Set(["espionageProbe"]);
const NO_RAPID_FIRE_IDS = new Set(["espionageProbe"]);

function scaled(value, level, perLevel) {
  return (Number(value) || 0) * (1 + perLevel * (Number(level) || 0));
}

function rapidFireRating(shooterId, targetId, units) {
  const shooter = units[shooterId];
  const target = units[targetId];
  const shooterName = shooter?.sourceClass || SOURCE_CLASS_BY_ID[shooterId] || shooter?.name || shooterId;
  const targetName = target?.sourceClass || SOURCE_CLASS_BY_ID[targetId] || target?.name || targetId;
  const perShooter = shooter?.rapidFire || {};
  const configured = perShooter[targetId] ?? perShooter[targetName];
  if (configured != null) return Math.max(1, Number(configured) || 1);

  // Source behavior: combat-capable ships rapidly fire on probe-class fodder.
  if (UNIVERSAL_FODDER_IDS.has(targetId) && shooter?.kind === "ship" && !NO_RAPID_FIRE_IDS.has(shooterId)) return 5;
  if (shooterName === "Zeus") return Math.max(1, Number(target?.zeusRF) || 1);
  return Math.max(1, Number(RAPID_FIRE_BY_SOURCE_NAME[shooterName]?.[targetName]) || 1);
}

function makeState(count, hullMax, shieldMax) {
  const bins = Array.from({ length: RESOLUTION + 1 }, () => ({ count: 0, hullSum: 0, shieldSum: 0, hitWeight: 0 }));
  bins[RESOLUTION] = { count, hullSum: count, shieldSum: count * shieldMax, hitWeight: 0 };
  return { bins, hullMax, shieldMax };
}

function stateCount(state) {
  return state.bins.reduce((sum, bin) => sum + bin.count, 0);
}

function bucketHullFraction(index) {
  if (!(index > 0)) return 0;
  return Math.max(0, Math.min(1, (index - 0.5) / RESOLUTION));
}

function binIndex(hullFraction) {
  if (!(hullFraction > 0)) return 0;
  return Math.max(1, Math.min(RESOLUTION, Math.ceil(hullFraction * RESOLUTION - 1e-12)));
}

function normalSurvival(value) {
  if (value < 0) return 1 - normalSurvival(-value);
  if (value >= 2) {
    let denominator = value;
    for (let term = 19; term >= 1; term--) denominator = value + term / denominator;
    return Math.exp(-0.5 * value * value) / Math.sqrt(2 * Math.PI) / denominator;
  }
  const x = value / Math.SQRT2;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const erfc = (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * erfc;
}

function normalCDF(value) {
  return value < 0 ? normalSurvival(-value) : 1 - normalSurvival(value);
}

function addResidualToMode(distribution, lambda, killHits) {
  const sum = distribution.reduce((total, item) => total + item.p, 0);
  if (!(sum > 0)) return [{ k: 0, p: 1 }];
  const modeHits = Math.min(killHits, Math.floor(lambda + 0.5));
  const mode = distribution.find(item => item.k === modeHits) || distribution.reduce((largest, item) => item.p > largest.p ? item : largest);
  mode.p += 1 - sum;
  return distribution;
}

function hitDistribution(lambda, killHits) {
  if (!(lambda > 0)) return [{ k: 0, p: 1 }];
  killHits = Math.max(1, Math.ceil(killHits));
  if (killHits === 1) {
    return addResidualToMode([
      { k: 0, p: Math.exp(-lambda) },
      { k: 1, p: 1 - Math.exp(-lambda), tail: true }
    ], lambda, killHits);
  }

  if (lambda <= POISSON_MAX_LAMBDA) {
    const output = [];
    let probability = Math.exp(-lambda);
    let sum = 0;
    const maxUseful = Math.min(killHits - 1, Math.max(8, Math.ceil(lambda + 9 * Math.sqrt(lambda) + 8)), 300);
    for (let hits = 0; hits <= maxUseful; hits++) {
      if (hits > 0) probability *= lambda / hits;
      output.push({ k: hits, p: probability });
      sum += probability;
    }
    const tail = Math.max(0, 1 - sum);
    if (tail > 1e-14) {
      if (maxUseful >= killHits - 1) output.push({ k: killHits, p: tail, tail: true });
      else output.push({ k: maxUseful + 1, p: tail, approx: true });
    }
    return addResidualToMode(output, lambda, killHits);
  }

  const standardDeviation = Math.sqrt(lambda);
  if (killHits < lambda - 9 * standardDeviation) return [{ k: killHits, p: 1, tail: true }];
  const deathProbability = normalSurvival((killHits - 0.5 - lambda) / standardDeviation);
  const output = [];
  if (deathProbability > 1e-14) output.push({ k: killHits, p: deathProbability, tail: true, approx: true });
  const survivorProbability = 1 - deathProbability;
  if (survivorProbability > 1e-14) output.push({ k: Math.min(killHits - 1, Math.floor(lambda)), p: survivorProbability, approx: true });
  return addResidualToMode(output, lambda, killHits);
}

function binomialHitDistribution(trials, hitProbability, killHits) {
  if (!(trials > 0) || !(hitProbability > 0)) return [{ k: 0, p: 1 }];
  if (hitProbability >= 1) return [{ k: trials, p: 1, tail: trials >= killHits }];
  if (!Number.isInteger(trials) || trials > 200) return null;
  const output = [];
  let probability = Math.pow(1 - hitProbability, trials);
  let sum = 0;
  const maxHits = Math.min(trials, killHits - 1);
  for (let hits = 0; hits <= maxHits; hits++) {
    if (hits > 0) probability *= ((trials - hits + 1) / hits) * (hitProbability / (1 - hitProbability));
    output.push({ k: hits, p: probability });
    sum += probability;
  }
  if (killHits <= trials) output.push({ k: killHits, p: Math.max(0, 1 - sum), tail: true });
  return addResidualToMode(output, trials * hitProbability, killHits);
}

function applyAttackGroup(state, totalShots, damage, exactTrials = null, totalTargets = 0) {
  const total = stateCount(state);
  if (!(total > 0) || !(totalShots > 0) || !(damage > 0) || damage <= 0.01 * state.shieldMax) return;
  const lambda = totalShots / total;
  const next = Array.from({ length: RESOLUTION + 1 }, () => ({ count: 0, hullSum: 0, shieldSum: 0, hitWeight: 0 }));

  for (let index = 1; index <= RESOLUTION; index++) {
    const bin = state.bins[index];
    if (!(bin.count > 0)) continue;
    const averageHullFraction = Math.min(1, Math.max(0, bin.hullSum / bin.count));
    const averageShield = Math.max(0, bin.shieldSum / bin.count);
    const oldHitProbability = Math.min(1, Math.max(0, bin.hitWeight / bin.count));
    const durability = averageHullFraction * state.hullMax + averageShield;
    const killHits = Math.max(1, Math.ceil(durability / damage - 1e-12));
    const distribution = exactTrials != null && totalTargets > 0
      ? binomialHitDistribution(exactTrials, 1 / totalTargets, killHits) || hitDistribution(lambda, killHits)
      : hitDistribution(lambda, killHits);

    for (const outcome of distribution) {
      const mass = bin.count * outcome.p;
      if (!(mass > 0)) continue;
      if (outcome.tail && outcome.k >= killHits) {
        next[0].count += mass;
        continue;
      }
      const rawDamage = outcome.k * damage;
      const absorbed = Math.min(averageShield, rawDamage);
      const shield = averageShield - absorbed;
      const hullFraction = averageHullFraction - (rawDamage - absorbed) / state.hullMax;
      if (!(hullFraction > 0)) {
        next[0].count += mass;
        continue;
      }
      const nextIndex = binIndex(hullFraction);
      next[nextIndex].count += mass;
      next[nextIndex].hullSum += mass * hullFraction;
      next[nextIndex].shieldSum += mass * shield;
      next[nextIndex].hitWeight += mass * (rawDamage > averageShield ? 1 : oldHitProbability);
    }
  }
  state.bins = next;
}

function explodeAndReset(state) {
  const output = Array.from({ length: RESOLUTION + 1 }, () => ({ count: 0, hullSum: 0, shieldSum: 0, hitWeight: 0 }));
  for (let index = 1; index <= RESOLUTION; index++) {
    const bin = state.bins[index];
    if (!(bin.count > 0)) continue;
    const averageHullFraction = Math.min(1, Math.max(0, bin.hullSum / bin.count));
    const explosionHullFraction = bucketHullFraction(index);
    const hitProbability = Math.min(1, Math.max(0, bin.hitWeight / bin.count));
    const explosionProbability = explosionHullFraction < 0.70 ? hitProbability * (1 - explosionHullFraction) : 0;
    const survivors = bin.count * (1 - explosionProbability);
    if (!(survivors > 0)) continue;
    output[index].count = survivors;
    output[index].hullSum = survivors * averageHullFraction;
    output[index].shieldSum = survivors * state.shieldMax;
  }
  state.bins = output;
}

function countsFromStates(states) {
  return Object.fromEntries(Object.entries(states).map(([id, state]) => [id, stateCount(state)]));
}

function totalCount(counts) {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

function makeStates(composition, research, units, perLevel) {
  const states = {};
  for (const [id, count] of Object.entries(composition)) {
    const unit = units[id];
    states[id] = makeState(count, scaled(unit.hull, research.armor, perLevel), scaled(unit.shield, research.shield, perLevel));
  }
  return states;
}

function makeFirePlans(shooterCounts, targetCounts, shooterResearch, targetResearch, units, perLevel) {
  const targetTotal = totalCount(targetCounts);
  if (!(targetTotal > 0)) return [];
  const plans = [];
  for (const [shooterId, shooterCount] of Object.entries(shooterCounts)) {
    const shooter = units[shooterId];
    const damage = scaled(shooter.weapon, shooterResearch.weapons, perLevel);
    if (!(shooterCount > 0) || !(damage > 0)) continue;
    let continuation = 0;
    for (const [targetId, targetCount] of Object.entries(targetCounts)) {
      if (!(targetCount > 0)) continue;
      const target = units[targetId];
      const fullShield = scaled(target.shield, targetResearch.shield, perLevel);
      if (damage <= 0.01 * fullShield) continue;
      continuation += targetCount / targetTotal * ((rapidFireRating(shooterId, targetId, units) - 1) / rapidFireRating(shooterId, targetId, units));
    }
    continuation = Math.min(0.999999999999, Math.max(0, continuation));
    const totalShots = shooterCount / (1 - continuation);
    for (const [targetId, targetCount] of Object.entries(targetCounts)) {
      if (!(targetCount > 0)) continue;
      const exactTrials = continuation === 0 && Number.isInteger(shooterCount) ? shooterCount : null;
      plans.push({ targetId, shots: totalShots * targetCount / targetTotal, damage, exactTrials, targetTotal });
    }
  }
  return plans;
}

function applyFirePlans(states, plans) {
  for (const plan of plans) {
    const state = states[plan.targetId];
    if (state) applyAttackGroup(state, plan.shots, plan.damage, plan.exactTrials, plan.targetTotal);
  }
}

/**
 * Simulate one battle as an expected-value model. Returns fractional survivors
 * for the adapter to convert into persistent integer ship inventories.
 */
export function simulateExpectedBattle({ attackers, defenders, attackerResearch, defenderResearch, units, rules = {} }) {
  const perLevel = Number.isFinite(Number(rules.researchCombatBonusPerLevel)) ? Number(rules.researchCombatBonusPerLevel) : 0.1;
  const maxRounds = Math.max(1, Math.floor(Number(rules.combatRounds) || DEFAULT_MAX_ROUNDS));
  const attackerStates = makeStates(attackers, attackerResearch, units, perLevel);
  const defenderStates = makeStates(defenders, defenderResearch, units, perLevel);
  let rounds = 0;

  for (let round = 1; round <= maxRounds; round++) {
    const startingAttackers = countsFromStates(attackerStates);
    const startingDefenders = countsFromStates(defenderStates);
    if (!(totalCount(startingAttackers) > 1e-12) || !(totalCount(startingDefenders) > 1e-12)) break;
    // Both sides fire from the start-of-round roster, including ships lost during this round.
    const attackerPlans = makeFirePlans(startingAttackers, startingDefenders, attackerResearch, defenderResearch, units, perLevel);
    const defenderPlans = makeFirePlans(startingDefenders, startingAttackers, defenderResearch, attackerResearch, units, perLevel);
    applyFirePlans(defenderStates, attackerPlans);
    applyFirePlans(attackerStates, defenderPlans);
    for (const state of Object.values(attackerStates)) explodeAndReset(state);
    for (const state of Object.values(defenderStates)) explodeAndReset(state);
    rounds = round;
    if (!(totalCount(countsFromStates(attackerStates)) > 1e-12) || !(totalCount(countsFromStates(defenderStates)) > 1e-12)) break;
  }

  return { attackerSurvivors: countsFromStates(attackerStates), defenderSurvivors: countsFromStates(defenderStates), rounds };
}
