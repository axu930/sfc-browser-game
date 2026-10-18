import { advancePlanetEconomy } from "./economy.js";
import { advanceFleets } from "./fleets.js";
import { completeDueQueues } from "./progression.js";

function nextEventAt(state, until) {
  const events = [];
  for (const planet of state.planets || []) {
    for (const job of [...(planet.constructionQueue || []), ...(planet.researchQueue || [])]) {
      const time = Number(job.completesAt);
      if (time > state.now && time <= until) events.push(time);
    }
  }
  for (const fleet of state.fleets || []) {
    const time = Number(fleet.arrivalAt);
    if (time > state.now && time <= until) events.push(time);
  }
  for (const target of state.universe?.targets || []) {
    const time = Number(target.respawnAt);
    if (time > state.now && time <= until) events.push(time);
  }
  return events.length ? Math.min(...events) : until;
}

/**
 * Advance the whole game from its saved timestamp to `until` in event order.
 * This makes offline production and timed fleet/queue events deterministic.
 * The state is mutated and the return value indicates whether a discrete event occurred.
 */
export function advanceGame(state, until = Date.now()) {
  if (!state || !Array.isArray(state.planets)) return false;
  state.now = Number.isFinite(Number(state.now)) ? Number(state.now) : Date.now();
  const targetTime = Math.max(state.now, Number(until) || state.now);
  const reportBefore = state.reports?.[0]?.id;
  const planetCountBefore = state.planets.length;
  let eventsProcessed = false;
  let iterations = 0;

  while (state.now < targetTime && iterations++ < 20000) {
    const nextAt = nextEventAt(state, targetTime);
    const elapsed = Math.max(0, (nextAt - state.now) / 1000);
    for (const planet of state.planets) advancePlanetEconomy(planet, elapsed);
    advanceFleets(state, elapsed);
    if (completeDueQueues(state).length) eventsProcessed = true;
    if (state.reports?.[0]?.id !== reportBefore) eventsProcessed = true;
    if (nextAt === targetTime) break;
  }

  if (state.now < targetTime) {
    const elapsed = (targetTime - state.now) / 1000;
    for (const planet of state.planets) advancePlanetEconomy(planet, elapsed);
    advanceFleets(state, elapsed);
    if (completeDueQueues(state).length) eventsProcessed = true;
  }
  if (state.planets.length !== planetCountBefore) eventsProcessed = true;
  return eventsProcessed;
}
