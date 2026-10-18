import { GAME_RULES, MISSIONS, RESOURCE_KEYS, SHIPS } from "./catalog.js";
import { simulateBattle } from "./combat.js";
import { makeId } from "./state.js";

const EPSILON = 1e-9;
const lower = (value) => String(value ?? "").toLowerCase();

function positiveRoster(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const roster = {};
  for (const [id, raw] of Object.entries(input)) {
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 0) return null;
    if (count > 0) roster[id] = count;
  }
  return Object.keys(roster).length ? roster : null;
}

function normalizedResources(input = {}) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Math.max(0, Number(input?.[key]) || 0)]));
}

function countShips(roster) {
  return Object.values(roster || {}).reduce((sum, count) => sum + Math.max(0, Number(count) || 0), 0);
}

function shipRecord(id) {
  return SHIPS[id] ?? null;
}

function fleetCapacity(roster, predicate = () => true) {
  return Object.entries(roster || {}).reduce((sum, [id, count]) => {
    const ship = shipRecord(id);
    if (!ship || !predicate(ship, id)) return sum;
    return sum + Math.max(0, Number(ship.capacity ?? ship.cargo) || 0) * Number(count || 0);
  }, 0);
}

function cargoTotal(cargo) {
  return RESOURCE_KEYS.reduce((sum, key) => sum + Math.max(0, Number(cargo?.[key]) || 0), 0);
}

function coordinateDistance(a, b) {
  if (!a || !b) return 1;
  return Math.abs(Number(a.galaxy || 0) - Number(b.galaxy || 0)) * 200
    + Math.abs(Number(a.system || 0) - Number(b.system || 0)) * 10
    + Math.abs(Number(a.slot || 0) - Number(b.slot || 0));
}

function fleetFuelRequirement(roster, originCoordinates, targetCoordinates) {
  const shipFuel = Object.entries(roster).reduce((sum, [id, count]) => {
    return sum + Math.max(0, Number(shipRecord(id)?.fuel) || 0) * count;
  }, 0);
  const fuelPerDistanceUnit = Math.max(0, Number(GAME_RULES.fuelPerDistanceUnit) || 0);
  const roundTripMultiplier = Math.max(0, Number(GAME_RULES.roundTripFuelMultiplier) || 0);
  const requirement = shipFuel * coordinateDistance(originCoordinates, targetCoordinates)
    * fuelPerDistanceUnit * roundTripMultiplier;
  return Math.ceil(requirement - EPSILON);
}

function flightSeconds(origin, target, roster) {
  const slowest = Object.entries(roster || {}).reduce((speed, [id, count]) => {
    if (count <= 0) return speed;
    const shipSpeed = Number(shipRecord(id)?.speed) || 1000;
    return Math.min(speed, shipSpeed);
  }, Infinity);
  const speedScale = Math.max(1, (Number.isFinite(slowest) ? slowest : 1000) / 1000);
  const distance = coordinateDistance(origin, target);
  const estimate = distance * (Number(GAME_RULES.flightSecondsPerCoordinate) || 8) / speedScale;
  return Math.max(Number(GAME_RULES.minimumFlightSeconds) || 5, Math.ceil(estimate));
}

function researchLevel(state, researchId) {
  const raw = state.research?.[researchId];
  if (raw && typeof raw === "object") return Number(raw.level) || 0;
  return Number(raw) || 0;
}

function shipResearchRequirementsMet(state, roster) {
  for (const id of Object.keys(roster)) {
    const ship = shipRecord(id);
    if (!ship) return { ok: false, message: `Unknown ship type: ${id}.` };
    for (const [researchId, requiredLevel] of Object.entries(ship.research || {})) {
      if (researchLevel(state, researchId) < Number(requiredLevel)) {
        return { ok: false, message: `${ship.name} requires ${researchId} level ${requiredLevel}.` };
      }
    }
  }
  return { ok: true };
}

function isMissionRole(ship, mission, definition) {
  const role = lower(ship.role);
  const requiredRole = lower(definition?.requiredRole);
  if (requiredRole && role !== requiredRole) return false;
  if (mission === "attack") return Number(ship.weapon) > 0;
  if (mission === "espionage") return role.includes("espion") || role.includes("scout");
  if (mission === "transport") return Number(ship.cargo ?? ship.capacity) > 0;
  if (mission === "harvest") return role.includes("harvest") || role.includes("recycl");
  if (mission === "colonize") return role.includes("colon") || ship.id === "colonyShip";
  return false;
}

function missionShipRequirement(roster, mission, definition) {
  const selected = Object.keys(roster).filter((id) => isMissionRole(shipRecord(id) || {}, mission, definition));
  if (!selected.length) {
    const messages = {
      attack: "An attack fleet needs at least one armed ship.",
      espionage: "An espionage mission needs an espionage probe.",
      transport: "A transport mission needs a ship with cargo capacity.",
      harvest: "A harvest mission needs a recycler.",
      colonize: "A colonization mission needs a colony ship."
    };
    return { ok: false, message: messages[mission] ?? "This fleet does not meet the mission requirements." };
  }
  return { ok: true, eligibleShips: selected };
}

function resolveTarget(state, targetId) {
  return state.universe?.targets?.find((entry) => entry.id === targetId) ?? null;
}

function ensureCollections(state) {
  state.planets ??= [];
  state.universe ??= { targets: [], debris: [] };
  state.universe.targets ??= [];
  state.universe.debris ??= [];
  state.fleets ??= [];
  state.reports ??= [];
}

function appendReport(state, { type, title, text, at = state.now, details = undefined }) {
  const report = { id: makeId(state, "report"), at, type, title, text };
  if (details !== undefined) report.details = details;
  state.reports.unshift(report);
  return report;
}

function emptyCargo() {
  return { ore: 0, crystal: 0, hydrogen: 0 };
}

function normalizeCargo(input) {
  const cargo = emptyCargo();
  if (input == null) return cargo;
  if (typeof input !== "object" || Array.isArray(input)) return null;
  for (const [key, value] of Object.entries(input)) {
    if (!RESOURCE_KEYS.includes(key)) {
      if (Number(value) > 0) return null;
      continue;
    }
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount < 0) return null;
    cargo[key] = amount;
  }
  return cargo;
}

function playerTargetAtCoordinates(state, coordinates) {
  return state.planets.some((planet) => coordinateDistance(planet.coordinates, coordinates) === 0);
}

function validateMissionTarget(state, origin, targetId, mission) {
  const targetPlanet = state.planets.find((planet) => planet.id === targetId);
  const target = resolveTarget(state, targetId);
  if (mission === "transport") {
    if (!targetPlanet || targetPlanet.id === origin.id) {
      return { ok: false, message: "Choose a different colony as the transport destination." };
    }
    return { ok: true, coordinates: targetPlanet.coordinates, target: targetPlanet };
  }
  if (mission === "harvest") {
    const debris = state.universe.debris.find((field) => field.id === targetId);
    const coordinateTarget = target ?? debris;
    if (!coordinateTarget) return { ok: false, message: "That destination is no longer available." };
    const field = debris ?? state.universe.debris.find((entry) => coordinateDistance(entry.coordinates, coordinateTarget.coordinates) === 0);
    if (!field || (Number(field.ore) <= 0 && Number(field.crystal) <= 0)) {
      return { ok: false, message: "There is no debris field at that location." };
    }
    return { ok: true, coordinates: field.coordinates, target: field };
  }
  if (!target) return { ok: false, message: "That destination is no longer available." };
  if (mission === "attack" || mission === "espionage") {
    if (target.npcType === "empty") return { ok: false, message: "There is no NPC target at that location." };
    if (target.respawnAt != null) return { ok: false, message: `${target.name} is regrouping and cannot be targeted yet.` };
    return { ok: true, coordinates: target.coordinates, target };
  }
  if (mission === "colonize") {
    const available = target.npcType === "empty" || target.habitable === true || target.available === true;
    if (!available) return { ok: false, message: "Choose an unclaimed, habitable location." };
    if (playerTargetAtCoordinates(state, target.coordinates)) {
      return { ok: false, message: "That coordinate is already occupied by one of your colonies." };
    }
    return { ok: true, coordinates: target.coordinates, target };
  }
  return { ok: false, message: "Unsupported mission." };
}

/** Remove ships and cargo from a planet and dispatch a mission fleet. */
export function dispatchMission(state, {
  originPlanetId,
  targetId,
  mission,
  ships: requestedShips,
  cargo: requestedCargo = {}
} = {}) {
  ensureCollections(state);
  const origin = state.planets.find((planet) => planet.id === originPlanetId);
  if (!origin) return { ok: false, message: "Choose an origin colony." };

  const missionId = String(mission || "").toLowerCase();
  const definition = MISSIONS[missionId];
  if (!definition) return { ok: false, message: "Choose a supported fleet mission." };

  const roster = positiveRoster(requestedShips);
  if (!roster) return { ok: false, message: "Select at least one ship using whole-number quantities." };
  for (const [id, count] of Object.entries(roster)) {
    if (!shipRecord(id)) return { ok: false, message: `Unknown ship type: ${id}.` };
    if (Number(origin.ships?.[id] || 0) < count) return { ok: false, message: `Not enough ${shipRecord(id).name} at the origin colony.` };
  }

  const techCheck = shipResearchRequirementsMet(state, roster);
  if (!techCheck.ok) return techCheck;
  const roleCheck = missionShipRequirement(roster, missionId, definition);
  if (!roleCheck.ok) return roleCheck;

  const destinationCheck = validateMissionTarget(state, origin, targetId, missionId);
  if (!destinationCheck.ok) return destinationCheck;

  const cargo = normalizeCargo(requestedCargo);
  if (!cargo) return { ok: false, message: "Cargo must contain non-negative Ore, Crystal, and Hydrogen amounts." };
  for (const key of RESOURCE_KEYS) {
    const fuelCost = key === "hydrogen"
      ? fleetFuelRequirement(roster, origin.coordinates, destinationCheck.coordinates)
      : 0;
    if (cargo[key] + fuelCost > Number(origin.resources?.[key] || 0)) {
      if (key === "hydrogen" && fuelCost > 0) {
        return { ok: false, message: `Not enough Hydrogen for the loaded cargo and round-trip fleet fuel (${fuelCost} Hydrogen required).` };
      }
      return { ok: false, message: `Not enough ${key} at the origin colony.` };
    }
  }
  const fuelCost = fleetFuelRequirement(roster, origin.coordinates, destinationCheck.coordinates);
  const hold = fleetCapacity(roster);
  if (cargoTotal(cargo) > hold + EPSILON) {
    return { ok: false, message: "The selected ships do not have enough cargo capacity." };
  }
  if (missionId === "transport" && cargoTotal(cargo) <= 0) {
    return { ok: false, message: "Load resources before dispatching a transport mission." };
  }

  const outboundSeconds = flightSeconds(origin.coordinates, destinationCheck.coordinates, roster);
  const dispatchedAt = Number.isFinite(Number(state.now)) ? Number(state.now) : Date.now();
  for (const [id, count] of Object.entries(roster)) origin.ships[id] -= count;
  for (const key of RESOURCE_KEYS) origin.resources[key] -= cargo[key];
  origin.resources.hydrogen -= fuelCost;

  const fleet = {
    id: makeId(state, "fleet"),
    originPlanetId,
    targetId,
    targetName: destinationCheck.target.name ?? (missionId === "harvest" ? "Debris Field" : "Unknown location"),
    targetCoordinates: { ...destinationCheck.coordinates },
    mission: missionId,
    ships: roster,
    cargo,
    fuelCost,
    status: "outbound",
    dispatchedAt,
    arrivalAt: dispatchedAt + outboundSeconds * 1000,
    outboundSeconds
  };
  state.fleets.push(fleet);
  appendReport(state, {
    type: "fleet",
    title: `${definition.name} fleet dispatched`,
    text: `${Object.values(roster).reduce((sum, value) => sum + value, 0)} ship(s) departed ${origin.name} for ${fleet.targetName}, consuming ${fuelCost} Hydrogen for the round trip.`,
    at: dispatchedAt,
    details: { fleetId: fleet.id, mission: missionId, ships: { ...roster }, cargo: { ...cargo }, fuelCost }
  });
  return { ok: true, message: `${definition.name} fleet dispatched.`, fleet };
}

function safeRoster(roster) {
  const normalized = {};
  for (const [id, raw] of Object.entries(roster || {})) {
    const count = Math.max(0, Math.floor(Number(raw) || 0));
    if (count) normalized[id] = count;
  }
  return normalized;
}

function addDebris(state, coordinates, debris) {
  const ore = Math.max(0, Number(debris?.ore) || 0);
  const crystal = Math.max(0, Number(debris?.crystal) || 0);
  if (ore <= 0 && crystal <= 0) return null;
  const existing = state.universe.debris.find((field) => coordinateDistance(field.coordinates, coordinates) === 0);
  if (existing) {
    existing.ore = (Number(existing.ore) || 0) + ore;
    existing.crystal = (Number(existing.crystal) || 0) + crystal;
    return existing;
  }
  const field = { id: makeId(state, "debris"), coordinates: { ...coordinates }, ore, crystal };
  state.universe.debris.push(field);
  return field;
}

function collectPlunder(target, cargo, ships) {
  const used = cargoTotal(cargo);
  let availableCapacity = Math.max(0, fleetCapacity(ships) - used);
  const fraction = Math.max(0, Math.min(1, Number(GAME_RULES.plunderFraction) || 0.5));
  const plunder = emptyCargo();
  // Shared-core prototype rule: take up to the configured fraction in resource
  // order, bounded by surviving cargo capacity.
  for (const key of RESOURCE_KEYS) {
    const stock = Math.max(0, Number(target.resources?.[key]) || 0);
    const amount = Math.min(Math.floor(stock * fraction), Math.floor(availableCapacity));
    plunder[key] = amount;
    availableCapacity -= amount;
    target.resources[key] = stock - amount;
  }
  return plunder;
}

function mergeCargo(target, incoming) {
  for (const key of RESOURCE_KEYS) target[key] = (Number(target[key]) || 0) + (Number(incoming?.[key]) || 0);
  return target;
}

function resolveAttack(state, fleet, target, at) {
  target.spawnProfile ??= {
    ships: { ...(target.ships || {}) },
    resources: normalizedResources(target.resources)
  };
  const battle = simulateBattle(fleet.ships, target.ships || {}, state.research || {}, target.research || {});
  fleet.ships = safeRoster(battle.attackerShips);
  target.ships = safeRoster(battle.defenderShips);
  const victory = battle.winner === "attacker";
  const debris = battle.debris || {};
  addDebris(state, fleet.targetCoordinates, debris);
  let plunder = emptyCargo();
  if (victory) {
    plunder = collectPlunder(target, fleet.cargo, fleet.ships);
    mergeCargo(fleet.cargo, plunder);
    target.respawnAt = at + Math.max(1, Number(GAME_RULES.npcRespawnSeconds) || 3600) * 1000;
  }
  const destroyed = Object.values(battle.attackerLosses || {}).reduce((sum, n) => sum + Number(n || 0), 0)
    + Object.values(battle.defenderLosses || {}).reduce((sum, n) => sum + Number(n || 0), 0);
  appendReport(state, {
    type: "battle",
    title: victory ? `Victory at ${target.name}` : `Battle at ${target.name}`,
    text: `${battle.summary || (victory ? "The attack succeeded." : "The attack did not prevail.")} ${destroyed} ship(s) were destroyed.${victory ? ` Recovered ${plunder.ore} Ore, ${plunder.crystal} Crystal, and ${plunder.hydrogen} Hydrogen.` : " No resources were plundered."}`,
    details: {
      fleetId: fleet.id,
      winner: battle.winner,
      rounds: battle.rounds,
      attackerLosses: battle.attackerLosses,
      defenderLosses: battle.defenderLosses,
      debris: { ore: Number(debris.ore) || 0, crystal: Number(debris.crystal) || 0 },
      plunder
    }
  });
}

function resolveEspionage(state, fleet, target) {
  const probeCount = Object.entries(fleet.ships).reduce((sum, [id, count]) => {
    const ship = shipRecord(id);
    return sum + (ship && isMissionRole(ship, "espionage", MISSIONS.espionage) ? count : 0);
  }, 0);
  const tech = researchLevel(state, "espionageTechnology");
  const opposingShips = countShips(target.ships);
  const strength = probeCount * (1 + tech * 0.25);
  const quality = strength >= Math.max(1, opposingShips) ? "complete" : strength >= Math.max(1, opposingShips * 0.5) ? "partial" : "limited";
  const visibleShips = quality === "complete" ? { ...(target.ships || {}) } : null;
  const intel = {
    resources: { ...normalizedResources(target.resources) },
    ships: visibleShips,
    defenseStrength: quality === "complete" ? opposingShips : null,
    quality
  };
  appendReport(state, {
    type: "espionage",
    title: `Espionage report: ${target.name}`,
    text: `${quality[0].toUpperCase()}${quality.slice(1)} intelligence gathered from ${target.name}. Resource stock is ${intel.resources.ore} Ore, ${intel.resources.crystal} Crystal, and ${intel.resources.hydrogen} Hydrogen.${visibleShips ? ` The report identifies ${opposingShips} defending ship(s).` : " Defender ship composition could not be confirmed."}`,
    details: { fleetId: fleet.id, targetId: target.id, intel }
  });
}

function resolveTransport(state, fleet, destination) {
  destination.resources ??= emptyCargo();
  mergeCargo(destination.resources, fleet.cargo);
  appendReport(state, {
    type: "fleet",
    title: `Transport arrived at ${destination.name}`,
    text: `Delivered ${fleet.cargo.ore} Ore, ${fleet.cargo.crystal} Crystal, and ${fleet.cargo.hydrogen} Hydrogen to ${destination.name}.`,
    details: { fleetId: fleet.id, destinationPlanetId: destination.id, delivered: { ...fleet.cargo } }
  });
  fleet.cargo = emptyCargo();
}

function resolveHarvest(state, fleet) {
  const field = state.universe.debris.find((entry) => entry.id === fleet.targetId)
    ?? state.universe.debris.find((entry) => coordinateDistance(entry.coordinates, fleet.targetCoordinates) === 0);
  if (!field) {
    appendReport(state, { type: "fleet", title: "Harvest returned empty", text: "The debris field was collected before the fleet arrived.", details: { fleetId: fleet.id } });
    return;
  }
  const recyclerIds = Object.keys(fleet.ships).filter((id) => isMissionRole(shipRecord(id) || {}, "harvest", MISSIONS.harvest));
  const capacity = fleetCapacity(fleet.ships, (ship, id) => recyclerIds.includes(id));
  let remaining = Math.max(0, capacity - cargoTotal(fleet.cargo));
  const recovered = { ore: 0, crystal: 0 };
  for (const key of ["ore", "crystal"]) {
    const amount = Math.min(Math.max(0, Number(field[key]) || 0), remaining);
    recovered[key] = amount;
    remaining -= amount;
    field[key] -= amount;
    fleet.cargo[key] += amount;
  }
  state.universe.debris = state.universe.debris.filter((entry) => entry.id !== field.id || entry.ore > 0 || entry.crystal > 0);
  appendReport(state, {
    type: "harvest",
    title: "Debris field harvested",
    text: `Recovered ${recovered.ore} Ore and ${recovered.crystal} Crystal from the debris field.`,
    details: { fleetId: fleet.id, recovered }
  });
}

function resolveColonization(state, fleet, target) {
  const colonyShip = Number(fleet.ships.colonyShip || 0);
  const available = target.npcType === "empty" || target.habitable === true || target.available === true;
  if (!colonyShip || !available || playerTargetAtCoordinates(state, target.coordinates)) {
    appendReport(state, {
      type: "fleet",
      title: "Colonization failed",
      text: "The location was unavailable when the fleet arrived. The surviving ships are returning.",
      details: { fleetId: fleet.id }
    });
    return false;
  }
  const colony = {
    id: makeId(state, "planet"),
    name: `Colony ${state.planets.length}`,
    coordinates: { ...target.coordinates },
    resources: { ore: 500, crystal: 500, hydrogen: 250 },
    buildings: {
      capitol: 1, oreMine: 1, crystalMine: 1, hydrogenSynthesizer: 0, solarPlant: 1,
      storageDepot: 0, roboticsFactory: 0, researchLab: 0, shipyard: 0, foundry: 0
    },
    ships: { ...fleet.ships, colonyShip: colonyShip - 1 },
    constructionQueue: [],
    researchQueue: []
  };
  mergeCargo(colony.resources, fleet.cargo);
  if (!colony.ships.colonyShip) delete colony.ships.colonyShip;
  state.planets.push(colony);
  state.universe.targets = state.universe.targets.filter((entry) => entry.id !== target.id);
  appendReport(state, {
    type: "colony",
    title: `${colony.name} established`,
    text: `A new colony has been established at ${colony.coordinates.galaxy}:${colony.coordinates.system}:${colony.coordinates.slot}. ${countShips(colony.ships)} escort ship(s) remain in orbit.`,
    details: { fleetId: fleet.id, planetId: colony.id, coordinates: colony.coordinates }
  });
  return true;
}

function startReturn(state, fleet, now) {
  const factor = Math.max(1, Number(MISSIONS[fleet.mission]?.returnFactor) || 2);
  const returnSeconds = Math.ceil(fleet.outboundSeconds * (factor - 1));
  fleet.status = "returning";
  fleet.arrivalAt = now + returnSeconds * 1000;
}

function resolveOutboundArrival(state, fleet, now) {
  if (fleet.mission === "attack") {
    const target = resolveTarget(state, fleet.targetId);
    if (target?.respawnAt != null && Number(target.respawnAt) > now) {
      appendReport(state, { type: "fleet", title: "Attack target regrouping", text: `${target.name} is regrouping. The fleet returns without engaging.`, details: { fleetId: fleet.id, targetId: target.id } });
    } else if (target) resolveAttack(state, fleet, target, now);
    else appendReport(state, { type: "fleet", title: "Attack target unavailable", text: "The destination could not be reached. The fleet is returning.", details: { fleetId: fleet.id } });
  } else if (fleet.mission === "espionage") {
    const target = resolveTarget(state, fleet.targetId);
    if (target?.respawnAt != null && Number(target.respawnAt) > now) {
      appendReport(state, { type: "fleet", title: "Espionage target regrouping", text: `${target.name} is regrouping. No report was gathered.`, details: { fleetId: fleet.id, targetId: target.id } });
    } else if (target) resolveEspionage(state, fleet, target);
  } else if (fleet.mission === "transport") {
    const destination = state.planets.find((planet) => planet.id === fleet.targetId);
    if (destination) resolveTransport(state, fleet, destination);
  } else if (fleet.mission === "harvest") {
    resolveHarvest(state, fleet);
  } else if (fleet.mission === "colonize") {
    const target = resolveTarget(state, fleet.targetId);
    if (target && resolveColonization(state, fleet, target)) return true;
  }
  startReturn(state, fleet, now);
  return false;
}

function resolveReturnArrival(state, fleet, now) {
  const origin = state.planets.find((planet) => planet.id === fleet.originPlanetId);
  if (origin) {
    origin.ships ??= {};
    for (const [id, count] of Object.entries(fleet.ships)) origin.ships[id] = (Number(origin.ships[id]) || 0) + count;
    origin.resources ??= emptyCargo();
    mergeCargo(origin.resources, fleet.cargo);
  }
  appendReport(state, {
    type: "fleet",
    title: `${MISSIONS[fleet.mission]?.name ?? "Fleet"} fleet returned`,
    text: `${countShips(fleet.ships)} surviving ship(s) returned to ${origin?.name ?? "their origin colony"} with ${fleet.cargo.ore} Ore, ${fleet.cargo.crystal} Crystal, and ${fleet.cargo.hydrogen} Hydrogen.`,
    at: now,
    details: { fleetId: fleet.id, ships: { ...fleet.ships }, cargo: { ...fleet.cargo } }
  });
}

function resolveNpcRespawn(state, target, at) {
  const profile = target.spawnProfile || {
    ships: { ...(target.ships || {}) },
    resources: normalizedResources(target.resources)
  };
  target.spawnProfile = {
    ships: { ...profile.ships },
    resources: normalizedResources(profile.resources)
  };
  target.ships = { ...target.spawnProfile.ships };
  target.resources = { ...target.spawnProfile.resources };
  delete target.respawnAt;
  appendReport(state, {
    type: "system",
    title: `${target.name} has regrouped`,
    text: `${target.name} has replenished its ships and supplies.`,
    at,
    details: { targetId: target.id }
  });
}

/** Advance the shared clock and resolve outbound arrivals and fleet returns. */
export function advanceFleets(state, elapsedSeconds = 0) {
  ensureCollections(state);
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const currentTime = Number.isFinite(Number(state.now)) ? Number(state.now) : Date.now();
  const now = currentTime + elapsed * 1000;

  // Resolve chronologically so arrivals remain deterministic if a large offline
  // time step contains multiple fleet or NPC-respawn events.
  let progressed = true;
  while (progressed) {
    progressed = false;
    const dueFleets = state.fleets
      .filter((fleet) => Number(fleet.arrivalAt) <= now)
      .sort((a, b) => Number(a.arrivalAt) - Number(b.arrivalAt) || String(a.id).localeCompare(String(b.id)));
    const dueRespawns = state.universe.targets
      .filter((target) => target.respawnAt != null && Number(target.respawnAt) <= now)
      .sort((a, b) => Number(a.respawnAt) - Number(b.respawnAt) || String(a.id).localeCompare(String(b.id)));
    const fleet = dueFleets[0];
    const target = dueRespawns[0];
    if (!fleet && !target) break;
    progressed = true;
    if (target && (!fleet || Number(target.respawnAt) <= Number(fleet.arrivalAt))) {
      const at = Number(target.respawnAt);
      state.now = at;
      resolveNpcRespawn(state, target, at);
    } else if (fleet) {
      const at = Number(fleet.arrivalAt);
      state.now = at;
      if (fleet.status === "returning") {
        resolveReturnArrival(state, fleet, at);
        state.fleets = state.fleets.filter((entry) => entry.id !== fleet.id);
      } else if (resolveOutboundArrival(state, fleet, at)) {
        state.fleets = state.fleets.filter((entry) => entry.id !== fleet.id);
      }
    }
  }
  state.now = now;
  return state;
}
