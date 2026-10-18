import { BUILDINGS, MISSIONS, RESEARCH, RESOURCE_KEYS, SHIPS } from "./game/catalog.js";
import { getPlanetProduction } from "./game/economy.js";
import { getBuildingCost, getResearchCost, getShipCost, queueBuilding, queueShips, startResearch } from "./game/progression.js";
import { dispatchMission } from "./game/fleets.js";
import { advanceGame } from "./game/simulation.js";
import { loadState, resetState, saveState } from "./game/state.js";

const pageTitles = {
  overview: "All Planets", colonyOverview: "Colony Overview", buildings: "Planetary Buildings", research: "Research Projects",
  shipyard: "Shipyard", fleets: "Fleet Command", universe: "Universe",
  reports: "Commander Reports"
};
let state = loadState();
let currentPage = "overview";
let selectedPlanetId = state.planets[0]?.id;
let selectedUniverseGalaxy = Number(state.planets[0]?.coordinates?.galaxy) || 1;
let selectedUniverseSystem = Number(state.planets[0]?.coordinates?.system) || 1;
let selectedPoiId = "";
let toastTimer;
let lastSavedAt = 0;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const number = value => Math.floor(Number(value) || 0).toLocaleString();
const formatDuration = seconds => {
  seconds = Math.max(0, Math.ceil(seconds || 0));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${String(seconds % 60).padStart(2, "0")}s`;
};
const planet = () => state.planets.find(item => item.id === selectedPlanetId) || state.planets[0];
const coordinates = point => point ? `${point.galaxy}:${point.system}:${point.slot}` : "—";
const costText = cost => RESOURCE_KEYS.map(key => `${key.slice(0, 1).toUpperCase()} ${number(cost?.[key] ?? 0)}`).join(" · ");
const meetsBuilding = (planetData, requirement) => !requirement || (planetData.buildings[requirement.building] || 0) >= requirement.level;
const meetsResearch = (requirements = {}) => Object.entries(requirements).every(([id, level]) => (state.research[id] || 0) >= level);

function showToast(message, error = false) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast visible${error ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
}

function pushReport(type, title, text) {
  state.reports.unshift({ id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: state.now, type, title, text });
  state.reports = state.reports.slice(0, 100);
}

function persist() {
  if (saveState(state)) lastSavedAt = Date.now();
}

function advanceSimulation() {
  const processedEvents = advanceGame(state, Date.now());
  if (Date.now() - lastSavedAt > 8000) persist();
  return processedEvents;
}

function renderHeader() {
  const activePlanet = planet();
  const isEmpireOverview = currentPage === "overview";
  const empireResources = Object.fromEntries(RESOURCE_KEYS.map(key => [key, state.planets.reduce((sum, item) => sum + (Number(item.resources?.[key]) || 0), 0)]));
  const empireProduction = Object.fromEntries(RESOURCE_KEYS.map(key => [key, state.planets.reduce((sum, item) => sum + getPlanetProduction(item).productionPerHour[key], 0)]));
  const activeRates = activePlanet ? getPlanetProduction(activePlanet) : null;
  $("#planet-strip-inner").innerHTML = state.planets.map(item => `
    <button class="colony-chip${item.id === activePlanet.id ? " selected" : ""}" data-planet="${escapeHtml(item.id)}" aria-pressed="${item.id === activePlanet.id}">
      <span class="colony-orb" aria-hidden="true"></span>
      <span class="colony-copy"><strong>${escapeHtml(item.name)}</strong><small>${coordinates(item.coordinates)}</small></span>
    </button>
  `).join("");
  $("#resource-bar").innerHTML = RESOURCE_KEYS.map(key => `
    <div class="resource-chip ${key}"><span class="resource-symbol" aria-hidden="true">${key === "ore" ? "O" : key === "crystal" ? "C" : "H"}</span><span class="resource-label">${key}</span><span class="resource-value">${number(isEmpireOverview ? empireResources[key] : activePlanet?.resources[key])}</span><span class="resource-rate">+${number(isEmpireOverview ? empireProduction[key] : activeRates.productionPerHour[key])}/h</span></div>
  `).join("");
  $("#planet-select").innerHTML = `<div class="planet-name">${escapeHtml(activePlanet?.name || "Unknown Colony")}</div><div class="planet-coordinates">${coordinates(activePlanet?.coordinates)}</div>`;
  const structures = Object.values(activePlanet?.buildings || {}).filter(level => level > 0).length;
  const stationedShips = Object.values(activePlanet?.ships || {}).reduce((sum, count) => sum + count, 0);
  $("#planet-summary").innerHTML = `<div class="profile-facts"><div><span>Active facilities</span><strong>${number(structures)}</strong></div><div><span>Ships in orbit</span><strong>${number(stationedShips)}</strong></div></div>`;
  $("#report-count").textContent = state.reports.length ? `(${Math.min(state.reports.length, 99)})` : "";
  $("#clock-time").textContent = new Date(state.now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const point = activePlanet?.coordinates;
  $("#page-context").textContent = isEmpireOverview
    ? `COMMAND NETWORK · ${state.planets.length} ${state.planets.length === 1 ? "COLONY" : "COLONIES"}`
    : point ? `GALAXY ${point.galaxy} · SYSTEM ${point.system}` : "COLONY COMMAND";
  renderSidebar();
}

function renderSidebar() {
  const activePlanet = planet();
  if (!activePlanet) return;
  const rates = getPlanetProduction(activePlanet);
  $("#production-summary").innerHTML = `
    ${RESOURCE_KEYS.map(key => `<div class="status-line"><span>${key[0].toUpperCase() + key.slice(1)} / hr</span><strong>${number(rates.productionPerHour[key])}</strong></div>`).join("")}
    <div class="status-line"><span>Energy</span><strong>${number(rates.energy.production)} / ${number(rates.energy.consumption)}</strong></div>
    <div class="status-line"><span>Storage</span><strong>${number(rates.storageCapacity)}</strong></div>`;
  const ships = Object.entries(activePlanet.ships || {}).filter(([, count]) => count > 0);
  const traveling = state.fleets.reduce((total, fleet) => total + Object.values(fleet.ships || {}).reduce((sum, count) => sum + count, 0), 0);
  $("#fleet-summary").innerHTML = `${ships.length ? ships.map(([id, count]) => `<div class="status-line"><span>${escapeHtml(SHIPS[id]?.name || id)}</span><strong>${number(count)}</strong></div>`).join("") : `<div class="status-line"><span>No ships stationed</span><strong>—</strong></div>`}<div class="status-line"><span>In flight</span><strong>${number(traveling)}</strong></div>`;
}

function card(title, body, subtitle = "") {
  return `<section class="content-card"><div class="content-card-header"><div><h2>${title}</h2>${subtitle ? `<div class="subtext">${subtitle}</div>` : ""}</div></div><div class="content-card-body">${body}</div></section>`;
}

function renderQueue(world) {
  const jobs = [...(world.constructionQueue || []), ...(world.researchQueue || [])].sort((a, b) => a.completesAt - b.completesAt);
  if (!jobs.length) return `<div class="empty-state">No active construction or research projects.</div>`;
  const now = state.now;
  return `<div class="table-wrap"><table><thead><tr><th>Project</th><th>Completion</th><th>Remaining</th><th>Status</th></tr></thead><tbody>${jobs.map(job => {
    const isResearch = Boolean(job.technology);
    const title = isResearch ? RESEARCH[job.technology]?.name || job.technology : job.type === "ships" ? `${job.quantity} × ${SHIPS[job.target]?.name || job.target}` : `${BUILDINGS[job.target]?.name || job.target} upgrade`;
    const total = Math.max(1, job.completesAt - job.startedAt);
    const progress = Math.min(100, Math.max(0, ((now - job.startedAt) / total) * 100));
    return `<tr><td><strong>${escapeHtml(title)}</strong><div class="progress-track" data-start="${job.startedAt}" data-end="${job.completesAt}"><span style="width:${progress}%"></span></div></td><td class="mono">${new Date(job.completesAt).toLocaleTimeString()}</td><td class="mono" data-remaining="${job.completesAt}">${formatDuration((job.completesAt - now) / 1000)}</td><td><span class="tag">In progress</span></td></tr>`;
  }).join("")}</tbody></table></div>`;
}

function renderOverview() {
  const rows = state.planets.map(world => {
    const shipCount = Object.values(world.ships || {}).reduce((sum, count) => sum + (Number(count) || 0), 0);
    const shipManifest = Object.entries(world.ships || {})
      .filter(([, count]) => Number(count) > 0)
      .map(([id, count]) => `${number(count)} ${SHIPS[id]?.name || id}`)
      .join(" · ");
    return `<tr><td><button class="text-action colony-open-link" data-open-colony="${escapeHtml(world.id)}">${escapeHtml(world.name)}</button><span class="subtext">${coordinates(world.coordinates)}</span></td><td class="mono">${number(world.resources?.ore)}</td><td class="mono">${number(world.resources?.crystal)}</td><td class="mono">${number(world.resources?.hydrogen)}</td><td><strong>${number(shipCount)} ships</strong><span class="subtext">${escapeHtml(shipManifest || "No ships stationed")}</span></td></tr>`;
  }).join("");
  return card("Colonies", `<div class="table-wrap"><table class="empire-table"><thead><tr><th>Colony</th><th>Ore</th><th>Crystal</th><th>Hydrogen</th><th>Ships</th></tr></thead><tbody>${rows || `<tr><td colspan="5">No colonies established.</td></tr>`}</tbody></table></div>`, "Resource stocks and stationed fleets across your colonies");
}

function renderColonyOverview(world) {
  const rates = getPlanetProduction(world);
  const rows = Object.entries(world.buildings).filter(([, level]) => level > 0).map(([id, level]) => `<tr><td><strong>${escapeHtml(BUILDINGS[id]?.name || id)}</strong></td><td><span class="level-badge">${number(level)}</span></td></tr>`).join("");
  const resourceMeters = RESOURCE_KEYS.map(key => `<div class="overview-resource ${key}"><div class="overview-resource-head"><span>${key}</span><strong>+${number(rates.productionPerHour[key])}<small>/hr</small></strong></div><div class="overview-resource-stock">${number(world.resources[key])}<span> in storage</span></div></div>`).join("");
  return `<div class="overview-layout">
      <div class="overview-primary">
        <section class="overview-block">
          <div class="overview-block-heading"><div><div class="eyebrow">COLONY STATUS</div><h2>Overview</h2></div><span class="online-label"><span class="status-dot"></span> Online</span></div>
          <div class="overview-resources">${resourceMeters}<div class="overview-resource energy"><div class="overview-resource-head"><span>Energy</span><strong>${number(rates.energy.production - rates.energy.consumption)}<small> net</small></strong></div><div class="overview-resource-stock">${number(rates.energy.production)}<span> generated · ${number(rates.energy.consumption)} used</span></div></div></div>
          <div class="overview-quick-actions"><span>Colony actions</span><button class="text-action" data-navigate="buildings">Build something <span>›</span></button><button class="text-action" data-navigate="fleets">Run a mission <span>›</span></button></div>
        </section>
        <div class="grid-2 overview-lower-grid">
          ${card("Planetary Infrastructure", `<div class="table-wrap"><table><thead><tr><th>Building</th><th>Level</th></tr></thead><tbody>${rows || `<tr><td colspan="2">No facilities constructed.</td></tr>`}</tbody></table></div><div class="form-actions"><button class="button" data-navigate="buildings">Manage buildings</button></div>`, `${number(rows ? Object.keys(world.buildings).filter(id => world.buildings[id] > 0).length : 0)} active facilities`)}
          ${card("Local Fleet", renderShipTable(world), "Ships available for new orders")}
        </div>
        ${card("Active Projects", renderQueue(world))}
      </div>
      <aside class="overview-aside">
        ${card("Recent Activity", renderOverviewActivity())}
        ${card("System Snapshot", renderTargetSummary(), "Known contacts and recoverable debris")}
      </aside>
    </div>`;
}

function renderOverviewActivity() {
  const reports = (state.reports || []).slice(0, 5);
  if (!reports.length) return `<div class="empty-state">Nothing is happening. Build something or run a mission.</div>`;
  return `<div class="activity-list">${reports.map(report => `<article class="activity-item"><div class="activity-marker ${escapeHtml(report.type || "report")}"></div><div class="activity-copy"><div class="activity-meta"><span>${escapeHtml(report.type || "Report")}</span><time>${new Date(report.at || state.now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><strong>${escapeHtml(report.title || "Report")}</strong><p>${escapeHtml(report.text || "")}</p></div></article>`).join("")}</div><div class="form-actions"><button class="button" data-navigate="reports">All reports</button></div>`;
}

function renderShipTable(world) {
  const rows = Object.entries(world.ships || {}).map(([id, count]) => `<tr><td><strong>${escapeHtml(SHIPS[id]?.name || id)}</strong><span class="subtext">${escapeHtml(SHIPS[id]?.role || "Ship")}</span></td><td class="mono">${number(count)}</td></tr>`).join("");
  return rows ? `<div class="table-wrap"><table><thead><tr><th>Ship type</th><th>Available</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state">No ships in local orbit.</div>`;
}

function renderBuildings(world) {
  const rows = Object.values(BUILDINGS).map(building => {
    const level = world.buildings[building.id] || 0;
    const cost = getBuildingCost(building.id, level);
    const requirement = meetsBuilding(world, building.prerequisite);
    const label = building.production ? `Produces ${Object.entries(building.production).map(([key, amount]) => `${number(amount * level)} ${key}/hr`).join(", ")} · ${number((building.energyUse || 0) * level)} energy` : building.energyProduction ? `Generates ${number(building.energyProduction * level)} energy` : building.storage ? `Adds ${number(building.storage * level)} storage` : building.description;
    return `<tr><td><strong>${escapeHtml(building.name)}</strong><span class="subtext">${escapeHtml(label)}</span></td><td><span class="level-badge">${level}</span></td><td class="cost-line">${costText(cost)}</td><td class="mono">${formatDuration(building.baseSeconds * Math.pow(building.growth, level))}</td><td>${requirement ? `<button class="button" data-build="${escapeHtml(building.id)}">Upgrade</button>` : `<span class="tag">Prerequisite missing</span>`}</td></tr>`;
  }).join("");
  return `${card("Construction Queue", renderQueue(world), "Building and ship projects currently underway")}${card("Buildings", `<div class="table-wrap"><table><thead><tr><th>Facility</th><th>Level</th><th>Next cost</th><th>Time</th><th>Order</th></tr></thead><tbody>${rows}</tbody></table></div>`, "Spend planetary resources to expand infrastructure")}`;
}

function renderResearch(world) {
  const rows = Object.values(RESEARCH).map(tech => {
    const level = state.research[tech.id] || 0;
    const cost = getResearchCost(tech.id, level);
    const unlocked = meetsBuilding(world, tech.requirements) && meetsResearch(tech.research || {});
    return `<tr><td><strong>${escapeHtml(tech.name)}</strong><span class="subtext">${escapeHtml(tech.description)}</span></td><td><span class="level-badge research-level-badge">${level}</span></td><td class="cost-line">${costText(cost)}</td><td class="mono">${formatDuration(tech.baseSeconds * Math.pow(tech.growth, level))}</td><td>${unlocked ? `<button class="button" data-research="${escapeHtml(tech.id)}">Research</button>` : `<span class="tag">Locked</span>`}</td></tr>`;
  }).join("");
  return `${card("Research Queue", renderQueue(world))}${card("Technology Database", `<div class="table-wrap"><table><thead><tr><th>Technology</th><th>Level</th><th>Next cost</th><th>Time</th><th>Order</th></tr></thead><tbody>${rows}</tbody></table></div>`, "Technology unlocks ships and improves fleet capabilities")}`;
}

function renderShipyard(world) {
  const rows = Object.values(SHIPS).map(ship => {
    const cost = getShipCost(ship.id, 1);
    const unlocked = meetsBuilding(world, ship.requirements) && meetsResearch(ship.research || {});
    const damage = [ship.ore ? `${number(ship.ore)} O` : "", ""].filter(Boolean).join(" ");
    return `<tr><td><strong>${escapeHtml(ship.name)}</strong><span class="subtext">${escapeHtml(ship.role)} · Cargo ${number(ship.cargo)} · ${escapeHtml(ship.description)}</span></td><td class="cost-line">${costText(cost)}</td><td class="mono">${formatDuration(ship.baseSeconds)}</td><td>${unlocked ? `<form class="inline-ship-form" data-ship-form="${escapeHtml(ship.id)}"><label class="visually-hidden" for="qty-${escapeHtml(ship.id)}">Quantity</label><input id="qty-${escapeHtml(ship.id)}" name="quantity" type="number" min="1" max="100" value="1"><button class="button" type="submit">Build</button></form>` : `<span class="tag">Locked</span>`}</td><td class="mono">${number(world.ships[ship.id] || 0)}</td></tr>`;
  }).join("");
  return `${card("Ship Construction Queue", renderQueue(world))}${card("Shipyard", `<div class="table-wrap"><table><thead><tr><th>Ship / role</th><th>Unit cost</th><th>Time</th><th>Order</th><th>Owned</th></tr></thead><tbody>${rows}</tbody></table></div>`, "Ship availability follows facility and technology requirements")}`;
}

function renderTargetSummary() {
  const targets = state.universe.targets || [];
  const debris = state.universe.debris || [];
  const targetRows = targets.map(target => `<tr><td><strong>${escapeHtml(target.name)}</strong><span class="subtext">${escapeHtml(target.npcType || "Unknown")}</span></td><td class="mono">${coordinates(target.coordinates)}</td><td class="mono">${Object.values(target.ships || {}).reduce((sum, count) => sum + count, 0)} defenders</td></tr>`).join("");
  const debrisRows = debris.map(field => `<tr><td><strong>Debris field</strong></td><td class="mono">${coordinates(field.coordinates)}</td><td class="cost-line">${number(field.ore)} Ore · ${number(field.crystal)} Crystal</td></tr>`).join("");
  return `<div class="table-wrap"><table><thead><tr><th>Location</th><th>Coordinates</th><th>Signal</th></tr></thead><tbody>${targetRows}${debrisRows}</tbody></table></div><div class="form-actions"><button class="button" data-navigate="universe">Open universe</button></div>`;
}

function renderFleets(world) {
  const targets = [
    ...(state.universe.targets || []),
    ...(state.universe.debris || []),
    ...state.planets.filter(item => item.id !== world.id)
  ];
  const fleetRows = state.fleets.map(fleet => `<tr><td><strong>${escapeHtml(MISSIONS[fleet.mission]?.name || fleet.mission)}</strong><span class="subtext">${coordinates(fleet.coordinates)} · ${Object.entries(fleet.ships || {}).map(([id, count]) => `${number(count)} ${SHIPS[id]?.name || id}`).join(", ")}</span></td><td class="mono">${fleet.phase === "return" ? "Returning" : "Outbound"}</td><td class="mono">${formatDuration((fleet.arrivesAt - state.now) / 1000)}</td></tr>`).join("");
  const missionOptions = Object.values(MISSIONS).map(mission => `<option value="${escapeHtml(mission.id)}">${escapeHtml(mission.name)}</option>`).join("");
  const targetOptions = targets.map(target => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.name || "Debris field")} (${coordinates(target.coordinates)})</option>`).join("");
  const shipInputs = Object.entries(SHIPS).map(([id, ship]) => `<div class="ship-pick"><label for="fleet-${id}">${escapeHtml(ship.name)} <small>available ${number(world.ships[id] || 0)}</small></label><input id="fleet-${id}" data-fleet-ship="${escapeHtml(id)}" type="number" min="0" max="${number(world.ships[id] || 0)}" value="0"></div>`).join("");
  const form = targets.length ? `<form id="fleet-dispatch-form"><div class="form-grid">
      <div class="field"><label for="mission-kind">Mission</label><select id="mission-kind" name="mission">${missionOptions}</select></div>
      <div class="field"><label for="mission-target">Destination</label><select id="mission-target" name="target">${targetOptions}</select></div>
      <div class="field"><label for="mission-cargo">Cargo manifest (resources)</label><div class="cost-line">Use transport missions to move resources</div></div>
    </div><div class="ship-picker">${shipInputs}</div>
    <div class="form-grid" style="margin-top:10px"><div class="field"><label for="cargo-ore">Ore</label><input id="cargo-ore" name="ore" type="number" min="0" value="0"></div><div class="field"><label for="cargo-crystal">Crystal</label><input id="cargo-crystal" name="crystal" type="number" min="0" value="0"></div><div class="field"><label for="cargo-hydrogen">Hydrogen</label><input id="cargo-hydrogen" name="hydrogen" type="number" min="0" value="0"></div></div>
    <div class="form-actions"><button class="button button-primary" type="submit">Dispatch Fleet</button></div></form>` : `<div class="empty-state">No known destinations. Explore the universe to find missions.</div>`;
  return `${card("Dispatch Orders", form, "Select a mission, target, and ships stationed at this planet")}${card("Fleets in Flight", fleetRows ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Phase</th><th>ETA</th></tr></thead><tbody>${fleetRows}</tbody></table></div>` : `<div class="empty-state">All ships are currently stationed at a planet.</div>`)}`;
}

function systemPointsOfInterest() {
  const inSystem = point => Number(point?.galaxy) === selectedUniverseGalaxy && Number(point?.system) === selectedUniverseSystem;
  const colonies = state.planets.filter(item => inSystem(item.coordinates)).map(item => ({
    poiId: `colony:${item.id}`, sourceId: item.id, kind: "colony", name: item.name,
    coordinates: item.coordinates, ships: item.ships, resources: item.resources
  }));
  const targets = (state.universe.targets || []).filter(item => inSystem(item.coordinates)).map(item => ({
    poiId: `target:${item.id}`, sourceId: item.id, kind: item.npcType === "empty" ? "empty" : "npc",
    name: item.name, coordinates: item.coordinates, ships: item.ships, resources: item.resources
  }));
  const debris = (state.universe.debris || []).filter(item => inSystem(item.coordinates)).map(item => ({
    poiId: `debris:${item.id}`, sourceId: item.id, kind: "debris", name: "Debris Field",
    coordinates: item.coordinates, resources: { ore: item.ore, crystal: item.crystal, hydrogen: 0 }
  }));
  const fleets = (state.fleets || []).filter(item => inSystem(item.targetCoordinates)).map(item => ({
    poiId: `fleet:${item.id}`, sourceId: item.id, kind: "fleet", name: `${MISSIONS[item.mission]?.name || "Fleet"} Fleet`,
    coordinates: item.targetCoordinates, ships: item.ships, status: item.status
  }));
  return [...colonies, ...targets, ...debris, ...fleets].sort((a, b) => Number(a.coordinates.slot) - Number(b.coordinates.slot));
}

function poiKindLabel(point) {
  return ({ colony: "Colony", npc: "Hostile Contact", empty: "Unclaimed World", debris: "Debris Field", fleet: "Fleet" })[point.kind] || "Point of Interest";
}

function poiSummary(point) {
  if (point.kind === "colony") {
    const ships = Object.values(point.ships || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    return `${number(ships)} stationed ships · ${number(point.resources?.ore)} Ore`;
  }
  if (point.kind === "npc") {
    const ships = Object.values(point.ships || {}).reduce((sum, count) => sum + Number(count || 0), 0);
    return `${number(ships)} defenders · ${number(point.resources?.ore)} Ore, ${number(point.resources?.crystal)} Crystal`;
  }
  if (point.kind === "empty") return "Available for colonization";
  if (point.kind === "debris") return `${number(point.resources?.ore)} Ore · ${number(point.resources?.crystal)} Crystal`;
  return `${point.status || "In transit"} · ${Object.values(point.ships || {}).reduce((sum, count) => sum + Number(count || 0), 0)} ships`;
}

function poiAction(point) {
  if (point.kind === "colony") return `<button class="button" data-open-colony="${escapeHtml(point.sourceId)}">Open Colony</button>`;
  if (point.kind === "npc") return `<button class="button" data-navigate="fleets" data-target="${escapeHtml(point.sourceId)}">Plan Attack</button>`;
  if (point.kind === "empty") return `<button class="button" data-navigate="fleets" data-target="${escapeHtml(point.sourceId)}" data-mission="colonize">Plan Colonization</button>`;
  if (point.kind === "debris") return `<button class="button" data-navigate="fleets" data-target="${escapeHtml(point.sourceId)}" data-mission="harvest">Harvest Debris</button>`;
  return `<button class="button" data-navigate="fleets">Fleet Command</button>`;
}

function renderUniverse() {
  const points = systemPointsOfInterest();
  if (!points.some(point => point.poiId === selectedPoiId)) selectedPoiId = points[0]?.poiId || "";
  const selectedPoint = points.find(point => point.poiId === selectedPoiId);
  const slots = Array.from({ length: 15 }, (_, index) => {
    const slot = index + 1;
    const occupants = points.filter(point => Number(point.coordinates.slot) === slot);
    const primary = occupants[0];
    if (!primary) return `<div class="system-slot system-slot-empty"><span class="system-slot-number">${slot}</span><span class="system-slot-copy"><strong>Open Slot</strong><small>Unoccupied</small></span></div>`;
    const isSelected = occupants.some(point => point.poiId === selectedPoiId);
    const slotType = primary.kind === "empty" ? "unclaimed" : primary.kind;
    return `<button class="system-slot system-slot-${slotType}${isSelected ? " selected" : ""}" data-poi-id="${escapeHtml(primary.poiId)}" aria-pressed="${isSelected}"><span class="system-slot-number">${slot}</span><span class="system-slot-copy"><strong>${escapeHtml(primary.name)}</strong><small>${poiKindLabel(primary)}${occupants.length > 1 ? ` · +${occupants.length - 1} more` : ""}</small></span></button>`;
  }).join("");
  const poiRows = points.map(point => `<button class="poi-item${point.poiId === selectedPoiId ? " selected" : ""}" data-poi-id="${escapeHtml(point.poiId)}" aria-pressed="${point.poiId === selectedPoiId}"><span class="poi-item-type">${poiKindLabel(point)}</span><strong>${escapeHtml(point.name)}</strong><span class="poi-item-meta">Slot ${number(point.coordinates.slot)} · ${escapeHtml(poiSummary(point))}</span></button>`).join("");
  const selectedCard = selectedPoint
    ? card("Selected Point", `<div class="poi-detail"><div class="poi-detail-coordinate">${coordinates(selectedPoint.coordinates)}</div><h3>${escapeHtml(selectedPoint.name)}</h3><p>${escapeHtml(poiSummary(selectedPoint))}</p>${poiAction(selectedPoint)}</div>`)
    : card("Selected Point", `<div class="empty-state">Select a point in the system to inspect it.</div>`);
  return `<div class="universe-layout">
    <div class="universe-main">
      ${card("System View", `<div class="universe-controls">
        <div class="universe-control-group"><button class="button" data-universe-step="galaxy" data-delta="-1" aria-label="Previous galaxy" ${selectedUniverseGalaxy <= 1 ? "disabled" : ""}>‹</button><span>Galaxy ${selectedUniverseGalaxy}</span><button class="button" data-universe-step="galaxy" data-delta="1" aria-label="Next galaxy">›</button></div>
        <div class="universe-control-group"><button class="button" data-universe-step="system" data-delta="-1" aria-label="Previous system" ${selectedUniverseSystem <= 1 ? "disabled" : ""}>‹</button><strong>System ${selectedUniverseSystem}</strong><button class="button" data-universe-step="system" data-delta="1" aria-label="Next system">›</button></div>
      </div><div class="system-grid" aria-label="Galaxy ${selectedUniverseGalaxy}, system ${selectedUniverseSystem}">${slots}</div><div class="system-legend"><span class="system-legend-colony">Colony</span><span class="system-legend-npc">Hostile contact</span><span class="system-legend-empty">Unclaimed world</span><span class="system-legend-debris">Debris</span></div>`, "Navigate neighboring systems and select a slot to inspect known locations")}
    </div>
    <aside class="universe-sidebar">${card("Points of Interest", poiRows || `<div class="empty-state">No known points of interest in this system.</div>`, `${points.length} known location${points.length === 1 ? "" : "s"}`)}${selectedCard}</aside>
  </div>`;
}

function renderReports() {
  const reports = state.reports || [];
  return card("Recent Dispatches", reports.length ? reports.map(report => `<article class="report-item"><div class="report-meta"><span>${escapeHtml(report.type || "Report").toUpperCase()}</span><time>${new Date(report.at || state.now).toLocaleString()}</time></div><div class="report-title">${escapeHtml(report.title || "Report")}</div><div class="report-text">${escapeHtml(report.text || "")}</div></article>`).join("") : `<div class="empty-state">No reports received.</div>`);
}

function render() {
  if (!planet()) return;
  renderHeader();
  $(".layout").classList.toggle("empire-overview", currentPage === "overview");
  $("#page-title").textContent = pageTitles[currentPage] || pageTitles.overview;
  $$(".nav-item, .planet-nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === currentPage));
  const activePlanet = planet();
  const renderers = { overview: renderOverview, colonyOverview: renderColonyOverview, buildings: renderBuildings, research: renderResearch, shipyard: renderShipyard, fleets: renderFleets, universe: renderUniverse, reports: renderReports };
  $("#game-content").innerHTML = renderers[currentPage](activePlanet);
}

function updateDynamicContent() {
  const activePlanet = planet();
  if (!activePlanet) return;
  for (const node of $$("[data-stock]")) node.textContent = number(activePlanet.resources[node.dataset.stock]);
  for (const track of $$(".progress-track[data-start][data-end]")) {
    const start = Number(track.dataset.start);
    const end = Number(track.dataset.end);
    const progress = end <= start ? 100 : Math.min(100, Math.max(0, ((state.now - start) / (end - start)) * 100));
    $("span", track).style.width = `${progress}%`;
  }
  for (const node of $$("[data-remaining]")) node.textContent = formatDuration((Number(node.dataset.remaining) - state.now) / 1000);
}

function act(result) {
  if (result?.ok) {
    persist();
    showToast(result.message || "Order accepted.");
  } else {
    showToast(result?.message || "Unable to issue that order.", true);
  }
  render();
}

document.addEventListener("click", event => {
  const systemStep = event.target.closest("[data-universe-step]");
  if (systemStep) {
    const delta = Number(systemStep.dataset.delta) || 0;
    if (systemStep.dataset.universeStep === "galaxy") selectedUniverseGalaxy = Math.max(1, selectedUniverseGalaxy + delta);
    else selectedUniverseSystem = Math.max(1, selectedUniverseSystem + delta);
    selectedPoiId = "";
    render();
    return;
  }
  const pointOfInterest = event.target.closest("[data-poi-id]");
  if (pointOfInterest) {
    selectedPoiId = pointOfInterest.dataset.poiId;
    render();
    return;
  }
  const openColony = event.target.closest("[data-open-colony]");
  if (openColony) {
    selectedPlanetId = openColony.dataset.openColony;
    currentPage = "colonyOverview";
    render();
    return;
  }
  const colony = event.target.closest("[data-planet]");
  if (colony) {
    selectedPlanetId = colony.dataset.planet;
    render();
    return;
  }
  const nav = event.target.closest("[data-page]");
  if (nav) {
    if (nav.dataset.page === "universe" && currentPage !== "universe") {
      selectedUniverseGalaxy = Number(planet()?.coordinates?.galaxy) || selectedUniverseGalaxy;
      selectedUniverseSystem = Number(planet()?.coordinates?.system) || selectedUniverseSystem;
      selectedPoiId = "";
    }
    currentPage = nav.dataset.page;
    render();
    return;
  }
  const pageAction = event.target.closest("[data-navigate]");
  if (pageAction) {
    currentPage = pageAction.dataset.navigate;
    render();
    const targetSelect = $("#mission-target");
    if (targetSelect && pageAction.dataset.target) targetSelect.value = pageAction.dataset.target;
    const missionSelect = $("#mission-kind");
    if (missionSelect && pageAction.dataset.mission) missionSelect.value = pageAction.dataset.mission;
    return;
  }
  const buildButton = event.target.closest("[data-build]");
  if (buildButton) return act(queueBuilding(state, selectedPlanetId, buildButton.dataset.build));
  const researchButton = event.target.closest("[data-research]");
  if (researchButton) return act(startResearch(state, researchButton.dataset.research, selectedPlanetId));
});

document.addEventListener("submit", event => {
  if (event.target.matches("[data-ship-form]")) {
    event.preventDefault();
    const quantity = Number(new FormData(event.target).get("quantity"));
    act(queueShips(state, selectedPlanetId, event.target.dataset.shipForm, quantity));
  }
  if (event.target.id === "fleet-dispatch-form") {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    const ships = Object.fromEntries($$("[data-fleet-ship]", form).map(input => [input.dataset.fleetShip, Number(input.value) || 0]).filter(([, count]) => count > 0));
    act(dispatchMission(state, {
      originPlanetId: selectedPlanetId,
      targetId: String(data.get("target")),
      mission: String(data.get("mission")),
      ships,
      cargo: Object.fromEntries(RESOURCE_KEYS.map(key => [key, Number(data.get(key)) || 0]))
    }));
  }
});

$("#reset-save").addEventListener("click", () => {
  if (!confirm("Erase this commander save and start a new game?")) return;
  state = resetState();
  selectedPlanetId = state.planets[0].id;
  selectedUniverseGalaxy = Number(state.planets[0]?.coordinates?.galaxy) || 1;
  selectedUniverseSystem = Number(state.planets[0]?.coordinates?.system) || 1;
  selectedPoiId = "";
  currentPage = "overview";
  showToast("New commander save created.");
  render();
});

window.addEventListener("beforeunload", persist);
setInterval(() => {
  const eventsChanged = advanceSimulation();
  renderHeader();
  updateDynamicContent();
  if (eventsChanged) render();
}, 1000);
setInterval(persist, 15000);
render();
