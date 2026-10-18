import { BUILDINGS, MISSIONS, RESEARCH, RESOURCE_KEYS, SHIPS } from "./game/catalog.js";
import { getPlanetProduction } from "./game/economy.js";
import { getBuildingCost, getResearchCost, getShipCost, queueBuilding, queueShips, startResearch } from "./game/progression.js";
import { dispatchMission } from "./game/fleets.js";
import { advanceGame } from "./game/simulation.js";
import { loadState, resetState, saveState } from "./game/state.js";

const pageTitles = {
  overview: "Planet Overview", buildings: "Planetary Buildings", research: "Research Projects",
  shipyard: "Shipyard", fleets: "Fleet Command", universe: "Universe",
  reports: "Commander Reports"
};
let state = loadState();
let currentPage = "overview";
let selectedPlanetId = state.planets[0]?.id;
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
  const rates = getPlanetProduction(activePlanet);
  $("#planet-strip-inner").innerHTML = state.planets.map(item => `
    <button class="colony-chip${item.id === activePlanet.id ? " selected" : ""}" data-planet="${escapeHtml(item.id)}" aria-pressed="${item.id === activePlanet.id}">
      <span class="colony-orb" aria-hidden="true"></span>
      <span class="colony-copy"><strong>${escapeHtml(item.name)}</strong><small>${coordinates(item.coordinates)}</small></span>
    </button>
  `).join("");
  $("#resource-bar").innerHTML = RESOURCE_KEYS.map(key => `
    <div class="resource-chip ${key}"><span class="resource-symbol" aria-hidden="true">${key === "ore" ? "O" : key === "crystal" ? "C" : "H"}</span><span class="resource-label">${key}</span><span class="resource-value">${number(activePlanet?.resources[key])}</span><span class="resource-rate">+${number(rates.productionPerHour[key])}/h</span></div>
  `).join("");
  $("#planet-select").innerHTML = `<div class="planet-name">${escapeHtml(activePlanet?.name || "Unknown Colony")}</div><div class="planet-coordinates">${coordinates(activePlanet?.coordinates)}</div>`;
  const structures = Object.values(activePlanet?.buildings || {}).filter(level => level > 0).length;
  const stationedShips = Object.values(activePlanet?.ships || {}).reduce((sum, count) => sum + count, 0);
  $("#planet-summary").innerHTML = `<div class="profile-facts"><div><span>Active facilities</span><strong>${number(structures)}</strong></div><div><span>Ships in orbit</span><strong>${number(stationedShips)}</strong></div></div>`;
  $("#report-count").textContent = state.reports.length ? `(${Math.min(state.reports.length, 99)})` : "";
  $("#clock-time").textContent = new Date(state.now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const point = activePlanet?.coordinates;
  $("#page-context").textContent = point ? `GALAXY ${point.galaxy} · SYSTEM ${point.system}` : "COLONY COMMAND";
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

function renderOverview(world) {
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

function renderUniverse() {
  const targets = state.universe.targets || [];
  const debris = state.universe.debris || [];
  const targetRows = targets.map(target => {
    const isEmpty = target.npcType === "empty";
    const isColony = state.planets.some(item => item.id === target.id);
    const action = isEmpty
      ? `<button class="button" data-navigate="fleets" data-target="${escapeHtml(target.id)}" data-mission="colonize">Colonize</button>`
      : `<button class="button" data-navigate="fleets" data-target="${escapeHtml(target.id)}">Plan mission</button>`;
    return `<tr><td><strong>${escapeHtml(target.name)}</strong><span class="subtext">${escapeHtml(target.npcType || (isColony ? "Colony" : "Unknown contact"))}</span></td><td class="mono">${coordinates(target.coordinates)}</td><td class="mono">${Object.entries(target.ships || {}).map(([id, count]) => `${number(count)} ${SHIPS[id]?.name || id}`).join(", ") || "None"}</td><td class="cost-line">${costText(target.resources)}</td><td>${action}</td></tr>`;
  }).join("");
  const debrisRows = debris.map(field => `<tr><td><strong>Debris field</strong></td><td class="mono">${coordinates(field.coordinates)}</td><td colspan="2" class="cost-line">${number(field.ore)} Ore · ${number(field.crystal)} Crystal</td><td><button class="button" data-navigate="fleets" data-target="${escapeHtml(field.id)}" data-mission="harvest">Harvest</button></td></tr>`).join("");
  const targetCard = card("Known Signals", targetRows || debrisRows ? `<div class="table-wrap"><table><thead><tr><th>Signal</th><th>Coordinates</th><th>Defense / Resources</th><th>Plunder</th><th>Orders</th></tr></thead><tbody>${targetRows}${debrisRows}</tbody></table></div>` : `<div class="empty-state">No known contacts or debris fields.</div>`, "Targets can be scouted before committing an attack fleet");
  return `${targetCard}${card("Colonies", `<div class="table-wrap"><table><thead><tr><th>Planet</th><th>Coordinates</th><th>Fleet</th><th>Resources</th></tr></thead><tbody>${state.planets.map(item => `<tr><td><strong>${escapeHtml(item.name)}</strong></td><td class="mono">${coordinates(item.coordinates)}</td><td class="mono">${Object.values(item.ships || {}).reduce((sum, count) => sum + count, 0)} ships</td><td class="cost-line">${costText(item.resources)}</td></tr>`).join("")}</tbody></table></div>`)}`;
}

function renderReports() {
  const reports = state.reports || [];
  return card("Recent Dispatches", reports.length ? reports.map(report => `<article class="report-item"><div class="report-meta"><span>${escapeHtml(report.type || "Report").toUpperCase()}</span><time>${new Date(report.at || state.now).toLocaleString()}</time></div><div class="report-title">${escapeHtml(report.title || "Report")}</div><div class="report-text">${escapeHtml(report.text || "")}</div></article>`).join("") : `<div class="empty-state">No reports received.</div>`);
}

function render() {
  if (!planet()) return;
  renderHeader();
  $("#page-title").textContent = pageTitles[currentPage] || pageTitles.overview;
  $$(".nav-item, .planet-nav-item").forEach(button => button.classList.toggle("active", button.dataset.page === currentPage));
  const activePlanet = planet();
  const renderers = { overview: renderOverview, buildings: renderBuildings, research: renderResearch, shipyard: renderShipyard, fleets: renderFleets, universe: renderUniverse, reports: renderReports };
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
  const colony = event.target.closest("[data-planet]");
  if (colony) {
    selectedPlanetId = colony.dataset.planet;
    render();
    return;
  }
  const nav = event.target.closest("[data-page]");
  if (nav) {
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
