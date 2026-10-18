import { BUILDINGS, GAME_RULES, RESOURCE_KEYS } from "./catalog.js";

const EPSILON = 1e-9;

function positiveLevel(value) {
  const level = Number(value);
  return Number.isFinite(level) && level > 0 ? level : 0;
}

export function getMineLevelMultiplier(levelValue, growthValue = 1.3) {
  const level = positiveLevel(levelValue);
  const growth = Math.max(1, Number(growthValue) || 1);
  return level ? level * Math.pow(growth, level) : 0;
}

function storageCapacities(planet) {
  const base = Math.max(0, Number(GAME_RULES.defaultStorage) || 0);
  return Object.fromEntries(RESOURCE_KEYS.map(resource => {
    const facility = Object.values(BUILDINGS).find(definition => definition.storageResource === resource);
    const level = positiveLevel(planet?.buildings?.[facility?.id]);
    const perLevel = Math.max(0, Number(facility?.storageCapacity) || base);
    return [resource, base + perLevel * (Math.pow(2, level) - 1)];
  }));
}

/** Calculate energy-adjusted output rates and planetary storage capacity. */
export function getPlanetProduction(planet) {
  const productionPerHour = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));
  if (!planet || typeof planet !== "object") {
    return {
      energy: { production: 0, consumption: 0, efficiency: 0 },
      productionPerHour,
      storageCapacity: Object.fromEntries(RESOURCE_KEYS.map(key => [key, 0]))
    };
  }

  let energyProduction = 0;
  let energyConsumption = 0;
  for (const [id, definition] of Object.entries(BUILDINGS)) {
    const level = positiveLevel(planet.buildings?.[id]);
    energyProduction += Math.max(0, Number(definition.energyProduction) || 0) * level;
    const levelMultiplier = definition.mineGrowth
      ? getMineLevelMultiplier(level, definition.mineGrowth)
      : level;
    energyConsumption += Math.max(0, Number(definition.energyUse) || 0) * levelMultiplier;
  }

  const energyEfficiency = energyConsumption <= EPSILON
    ? 1
    : Math.min(1, energyProduction / energyConsumption);
  for (const [id, definition] of Object.entries(BUILDINGS)) {
    const level = positiveLevel(planet.buildings?.[id]);
    if (!level || !definition.production) continue;
    const levelMultiplier = definition.mineGrowth
      ? getMineLevelMultiplier(level, definition.mineGrowth)
      : level;
    for (const resource of RESOURCE_KEYS) {
      const perLevel = Math.max(0, Number(definition.production[resource]) || 0);
      productionPerHour[resource] += perLevel * levelMultiplier * energyEfficiency;
    }
  }

  return {
    energy: {
      production: energyProduction,
      consumption: energyConsumption,
      efficiency: energyEfficiency
    },
    productionPerHour,
    storageCapacity: storageCapacities(planet)
  };
}

/**
 * Advance a planet's resource production for elapsed seconds.
 * Mine output is reduced proportionally when total energy demand exceeds supply.
 * The planet is mutated and an economy snapshot is returned for UI/reporting.
 */
export function advancePlanetEconomy(planet, elapsedSeconds) {
  const seconds = Number.isFinite(Number(elapsedSeconds))
    ? Math.max(0, Number(elapsedSeconds))
    : 0;
  if (!planet || typeof planet !== "object") {
    return {
      elapsedSeconds: seconds,
      energy: { production: 0, consumption: 0, efficiency: 0 },
      storageCapacity: Object.fromEntries(RESOURCE_KEYS.map(key => [key, 0])),
      productionPerHour: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])),
      produced: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]))
    };
  }

  planet.resources ??= {};
  planet.buildings ??= {};

  const production = getPlanetProduction(planet);
  const capacities = production.storageCapacity;
  const produced = Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0]));
  for (const resource of RESOURCE_KEYS) {
    const balance = Number(planet.resources[resource]);
    const current = Number.isFinite(balance) ? Math.max(0, balance) : 0;
    const accrued = (production.productionPerHour[resource] * seconds) / 3600;
    const capacity = capacities[resource];
    const next = current >= capacity ? current : Math.min(capacity, current + accrued);
    planet.resources[resource] = next;
    produced[resource] = next - current;
  }

  return {
    elapsedSeconds: seconds,
    energy: production.energy,
    storageCapacity: capacities,
    productionPerHour: production.productionPerHour,
    produced
  };
}
