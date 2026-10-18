import { BUILDINGS, BUILD_SPEED_RULES, RESEARCH, RESOURCE_KEYS, SHIPS } from "./catalog.js";
import { makeId } from "./state.js";

function validLevel(value) {
  const level = Number(value);
  return Number.isFinite(level) && level > 0 ? Math.floor(level) : 0;
}

function costForLevel(cost, growth, existingLevel) {
  const multiplier = Math.pow(Math.max(1, Number(growth) || 1), Math.max(0, existingLevel));
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [
    resource,
    Math.max(0, Math.ceil((Number(cost?.[resource]) || 0) * multiplier))
  ]));
}

function costForBuildingLevel(building, existingLevel) {
  if (building?.costFormula !== "level-exponential") {
    return costForLevel(building?.cost, building?.growth, existingLevel);
  }
  const targetLevel = Math.max(1, existingLevel + 1);
  const growth = Math.max(1, Number(building.growth) || 1);
  const multiplier = targetLevel * Math.pow(growth, targetLevel);
  return Object.fromEntries(RESOURCE_KEYS.map(resource => [
    resource,
    Math.max(0, Math.ceil((Number(building.cost?.[resource]) || 0) * multiplier))
  ]));
}

function buildDurationSeconds(cost, divisor) {
  const resourceCost = Math.max(0, Number(cost?.ore) || 0) + Math.max(0, Number(cost?.crystal) || 0);
  const hours = resourceCost / Math.max(1, Number(divisor) || 1);
  return Math.max(BUILD_SPEED_RULES.minimumSeconds, hours * 3600);
}

function foundryMultiplier(level) {
  return Math.pow(BUILD_SPEED_RULES.foundryLevelFactor, validLevel(level));
}

function queuedBuildingLevel(planet, buildingId) {
  const queued = (planet?.constructionQueue ?? []).filter(
    item => item.type === "building" && item.target === buildingId
  ).length;
  return validLevel(planet?.buildings?.[buildingId]) + queued;
}

function multipliedCost(cost, quantity) {
  return Object.fromEntries(RESOURCE_KEYS.map((resource) => [
    resource,
    Math.max(0, Math.ceil((Number(cost?.[resource]) || 0) * quantity))
  ]));
}

/** Cost to advance a building from currentLevel to the next level. */
export function getBuildingCost(buildingId, currentLevel = 0) {
  const building = BUILDINGS[buildingId];
  if (!building) return null;
  return costForBuildingLevel(building, validLevel(currentLevel));
}

/** Cost to advance a technology from currentLevel to the next level. */
export function getResearchCost(technologyId, currentLevel = 0) {
  const technology = RESEARCH[technologyId];
  if (!technology) return null;
  return costForLevel(technology.cost, technology.growth, validLevel(currentLevel));
}

/** Cost to produce a positive whole-number batch of a ship type. */
export function getShipCost(shipId, quantity = 1) {
  const ship = SHIPS[shipId];
  const count = Number(quantity);
  if (!ship || !Number.isSafeInteger(count) || count < 1) return null;
  return multipliedCost(ship.cost, count);
}

export function getBuildingDurationSeconds(planet, buildingId, currentLevel = queuedBuildingLevel(planet, buildingId)) {
  const cost = getBuildingCost(buildingId, currentLevel);
  if (!cost) return 0;
  const capitolLevel = queuedBuildingLevel(planet, "capitol");
  const foundryLevel = queuedBuildingLevel(planet, "foundry");
  const divisor = BUILD_SPEED_RULES.buildingBaseDivisor
    * (capitolLevel + 1)
    * foundryMultiplier(foundryLevel);
  return buildDurationSeconds(cost, divisor);
}

export function getShipDurationSeconds(planet, shipId, quantity = 1) {
  const cost = getShipCost(shipId, quantity);
  if (!cost) return 0;
  const shipyardLevel = queuedBuildingLevel(planet, "shipyard");
  const foundryLevel = queuedBuildingLevel(planet, "foundry");
  const divisor = BUILD_SPEED_RULES.shipBaseDivisor
    * (shipyardLevel + 1)
    * foundryMultiplier(foundryLevel);
  return buildDurationSeconds(cost, divisor);
}

export function getResearchDurationSeconds(planet, technologyId, currentLevel = 0) {
  const cost = getResearchCost(technologyId, currentLevel);
  if (!cost) return 0;
  const labLevel = validLevel(planet?.buildings?.researchLab);
  const divisor = BUILD_SPEED_RULES.researchBaseDivisor * (labLevel + 1);
  return buildDurationSeconds(cost, divisor);
}

function getPlanet(state, planetId) {
  return state?.planets?.find((planet) => planet.id === planetId) ?? null;
}

function fail(message) {
  return { ok: false, message };
}

function canAfford(planet, cost) {
  return RESOURCE_KEYS.every((resource) => {
    const balance = Number(planet?.resources?.[resource]);
    return Number.isFinite(balance) && balance >= cost[resource];
  });
}

function pay(planet, cost) {
  planet.resources ??= {};
  for (const resource of RESOURCE_KEYS) {
    planet.resources[resource] = Number(planet.resources[resource]) - cost[resource];
  }
}

function queueTail(queue) {
  return queue.reduce((latest, item) => Math.max(latest, Number(item.completesAt) || 0), 0);
}

function hasBuilding(planet, buildingId, requiredLevel) {
  return queuedBuildingLevel(planet, buildingId) >= validLevel(requiredLevel);
}

function prerequisitesMet(planet, requirements) {
  if (!requirements) return true;
  return hasBuilding(planet, requirements.building, requirements.level);
}

function missingRequirementMessage(definition, planet) {
  const requirement = definition?.prerequisite ?? definition?.requirements;
  if (!requirement || prerequisitesMet(planet, requirement)) return null;
  const buildingName = BUILDINGS[requirement.building]?.name ?? requirement.building;
  return `Requires ${buildingName} level ${requirement.level}.`;
}

function shipResearchMissing(state, ship) {
  for (const [technology, level] of Object.entries(ship.research ?? {})) {
    if (validLevel(state?.research?.[technology]) < validLevel(level)) {
      const name = RESEARCH[technology]?.name ?? technology;
      return `${name} level ${level} is required.`;
    }
  }
  return null;
}

function nextStartAt(queue, now) {
  return Math.max(Number(now) || 0, queueTail(queue));
}

function report(state, type, title, text) {
  state.reports ??= [];
  state.reports.push({ id: makeId(state, "report"), at: state.now, type, title, text });
}

/** Queue a single level of a building upgrade, charging resources immediately. */
export function queueBuilding(state, planetId, buildingId) {
  const planet = getPlanet(state, planetId);
  if (!planet) return fail("Planet not found.");
  const building = BUILDINGS[buildingId];
  if (!building) return fail("Unknown building.");
  planet.buildings ??= {};
  planet.resources ??= {};
  planet.constructionQueue ??= [];

  const missing = missingRequirementMessage(building, planet);
  if (missing) return fail(missing);

  const currentLevel = queuedBuildingLevel(planet, buildingId);
  const cost = getBuildingCost(buildingId, currentLevel);
  if (!canAfford(planet, cost)) return fail("Not enough resources.");

  const duration = getBuildingDurationSeconds(planet, buildingId, currentLevel);
  const startedAt = nextStartAt(planet.constructionQueue, state.now);
  pay(planet, cost);
  planet.constructionQueue.push({
    id: makeId(state, "construction"),
    type: "building",
    target: buildingId,
    startedAt,
    completesAt: startedAt + duration * 1000
  });
  return { ok: true, message: `${building.name} level ${currentLevel + 1} queued.` };
}

/** Queue a batch of ships, charging the full batch and placing it after existing work. */
export function queueShips(state, planetId, shipId, quantity) {
  const planet = getPlanet(state, planetId);
  if (!planet) return fail("Planet not found.");
  const ship = SHIPS[shipId];
  if (!ship) return fail("Unknown ship.");
  const count = Number(quantity);
  if (!Number.isSafeInteger(count) || count < 1) return fail("Quantity must be a positive whole number.");
  planet.buildings ??= {};
  planet.resources ??= {};
  planet.constructionQueue ??= [];

  const missingBuilding = missingRequirementMessage(ship, planet);
  if (missingBuilding) return fail(missingBuilding);
  const missingResearch = shipResearchMissing(state, ship);
  if (missingResearch) return fail(missingResearch);

  const cost = getShipCost(shipId, count);
  if (!canAfford(planet, cost)) return fail("Not enough resources.");

  const startedAt = nextStartAt(planet.constructionQueue, state.now);
  const duration = getShipDurationSeconds(planet, shipId, count);
  pay(planet, cost);
  planet.constructionQueue.push({
    id: makeId(state, "ships"),
    type: "ships",
    target: shipId,
    quantity: count,
    startedAt,
    completesAt: startedAt + duration * 1000
  });
  return { ok: true, message: `${count} ${ship.name}${count === 1 ? "" : "s"} queued.` };
}

/** Start a technology level on a planet; only one research job can run at a time. */
export function startResearch(state, technologyId, planetId) {
  const planet = getPlanet(state, planetId);
  if (!planet) return fail("Planet not found.");
  const technology = RESEARCH[technologyId];
  if (!technology) return fail("Unknown research project.");
  planet.buildings ??= {};
  planet.resources ??= {};
  planet.researchQueue ??= [];

  if ((state.planets ?? []).some((candidate) => (candidate.researchQueue ?? []).length > 0)) {
    return fail("Research is already in progress.");
  }
  const requiredBuilding = technology.requirements?.building;
  const requiredLevel = validLevel(technology.requirements?.level);
  if (requiredBuilding && validLevel(planet.buildings[requiredBuilding]) < requiredLevel) {
    const buildingName = BUILDINGS[technology.requirements?.building]?.name
      ?? technology.requirements?.building
      ?? "Research Lab";
    return fail(`Requires ${buildingName} level ${technology.requirements?.level ?? 1}.`);
  }

  const currentLevel = validLevel(state.research?.[technologyId]);
  const cost = getResearchCost(technologyId, currentLevel);
  if (!canAfford(planet, cost)) return fail("Not enough resources.");

  const duration = getResearchDurationSeconds(planet, technologyId, currentLevel);
  const startedAt = Number(state.now) || Date.now();
  pay(planet, cost);
  planet.researchQueue.push({
    id: makeId(state, "research"),
    technology: technologyId,
    startedAt,
    completesAt: startedAt + duration * 1000
  });
  return { ok: true, message: `${technology.name} level ${currentLevel + 1} started.` };
}

/** Complete every building, ship, and research job due at state.now. */
export function completeDueQueues(state) {
  if (!state || !Array.isArray(state.planets)) return [];
  state.reports ??= [];
  const completed = [];
  const now = Number(state.now) || 0;

  for (const planet of state.planets) {
    planet.buildings ??= {};
    planet.ships ??= {};
    planet.constructionQueue ??= [];
    planet.researchQueue ??= [];

    const pendingConstruction = [];
    for (const item of planet.constructionQueue) {
      if ((Number(item.completesAt) || 0) > now) {
        pendingConstruction.push(item);
        continue;
      }
      if (item.type === "building" && item.migrateSharedStorage) {
        for (const buildingId of ["oreWarehouse", "crystalWarehouse", "hydrogenStorage"]) {
          planet.buildings[buildingId] = validLevel(planet.buildings[buildingId]) + 1;
        }
        const level = planet.buildings.oreWarehouse;
        const name = "Resource Storage Facilities";
        report(state, "building", `${name} complete`, `${name} have reached level ${level} on ${planet.name}.`);
        completed.push({ type: "building", planetId: planet.id, target: "storageFacilities", level });
        continue;
      }
      if (item.type === "building" && BUILDINGS[item.target]) {
        planet.buildings[item.target] = validLevel(planet.buildings[item.target]) + 1;
        const name = BUILDINGS[item.target].name;
        const level = planet.buildings[item.target];
        const title = `${name} complete`;
        const text = `${name} has reached level ${level} on ${planet.name}.`;
        report(state, "building", title, text);
        completed.push({ type: "building", planetId: planet.id, target: item.target, level });
      } else if (item.type === "ships" && SHIPS[item.target]) {
        const count = Number.isSafeInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1;
        planet.ships[item.target] = validLevel(planet.ships[item.target]) + count;
        const name = SHIPS[item.target].name;
        const title = "Ships constructed";
        const text = `${count} ${name}${count === 1 ? "" : "s"} completed on ${planet.name}.`;
        report(state, "ships", title, text);
        completed.push({ type: "ships", planetId: planet.id, target: item.target, quantity: count });
      }
    }
    planet.constructionQueue = pendingConstruction;

    const pendingResearch = [];
    for (const item of planet.researchQueue) {
      if ((Number(item.completesAt) || 0) > now) {
        pendingResearch.push(item);
        continue;
      }
      if (!RESEARCH[item.technology]) continue;
      state.research ??= {};
      state.research[item.technology] = validLevel(state.research[item.technology]) + 1;
      const technology = RESEARCH[item.technology];
      const level = state.research[item.technology];
      const title = "Research complete";
      const text = `${technology.name} has reached level ${level}.`;
      report(state, "research", title, text);
      completed.push({ type: "research", planetId: planet.id, target: item.technology, level });
    }
    planet.researchQueue = pendingResearch;
  }

  return completed;
}
