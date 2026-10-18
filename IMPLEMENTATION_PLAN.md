# SFC Browser Game — Implementation Plan

**Status:** First playable baseline implemented. Keep this plan as the scope and comparison checklist as gameplay rules and UI are refined.

This plan turns [the gameplay overview](GAMEPLAY_OVERVIEW.md) into a small, playable single-player browser game. The README describes a single-player version of both playstarfleet.com and playsfc2.com, with room for later changes.

## Current implementation status

- Static browser app and no-dependency local server are in place. Run `npm start` and open the printed localhost address.
- Economy, progression, combat, universe, fleet missions, persistence, and event-time simulation are separate modules under `src/game/`; the interface is in `src/app.js`.
- The game supports building/research/ship queues; attack, espionage, transport, harvest, and colonization missions; NPC respawns; battle reports; plunder; debris; and offline catch-up.
- Rules and catalogs are provisional single-player values in `src/game/catalog.js`. Treat them as tuning defaults rather than confirmed original-game balance.
- Automated verification: `npm test` currently covers 16 gameplay and persistence cases.
- The shared shell follows the live SFC structure with a user-refined dark gray-on-black palette. The Overview is an empire-wide colony table; Colony Overview opens the selected planet dashboard; Universe is a navigable 15-row slot table with a points-of-interest sidebar.

## Decisions and constraints

- **Hosting and stack:** Build a static, zero-build browser app with HTML, CSS, and JavaScript modules. Keep it deployable from the GitHub Pages repository root. Do not add a server or framework for v1.
- **Save model:** Keep all game state in the browser with a versioned `localStorage` save. Advance production, construction, research, shipbuilding, and fleets from saved timestamps when the app opens again.
- **Rules:** Use the gameplay overview's shared core. Put costs, rates, prerequisites, ship stats, NPC templates, and combat settings in data definitions so they can be tuned without rewriting the UI. Where the accessible SFC2 wiki supplies a specific value, treat it as a provisional default and label it accordingly.
- **Interface:** Recreate the classic SFC browser layout and navigation rather than the optimizer's interface. Use the supplied overview HTML as a structural reference for shared bars and colony views. The main Overview summarizes all colonies; Colony Overview is the selected-colony detail page. Universe navigation moves system by system and keeps points of interest in a side panel. Do not copy session-specific markup or actions; use local game controls and provisional CSS artwork.
- **Combat source:** Build from the neighboring `axu930/sfc-fleet-optimizer` combat module at commit `12c8a86`, especially `js/sfc2-combat.js` and its unit catalog in `js/units.js`. The SFC2 module accepts attacker/defender rosters and tech, simulates up to six simultaneous-fire rounds, and reports surviving rosters and losses. It is an expected-value model that can return fractional counts, so the game adapter must convert final counts to whole ships and clearly treat v1 outcomes as deterministic estimates. Keep combat behind an adapter so a discrete random battle model can replace it later.
- **Reuse boundaries:** Copy/adapt only the relevant battle logic and unit data; do not copy the optimizer UI or the whole sibling repository. The neighboring repository has unrelated working-tree changes, while the source combat modules are clean at the pinned commit. Both repositories use Apache License 2.0; preserve the source license and attribution and mark adapted files.
- **Scope:** Exclude Hephaestus, moon systems, alliances, multiplayer, missiles, and late-game mechanics. Start with one homeworld, a compact universe, basic ships, and a few NPC targets.

## Implementation sequence

### 1. Create the playable shell — implemented

- Add the root game page, classic SFC-style page navigation, selected-planet header, resource strip, main content area, and report/message area.
- Keep layout and controls usable on desktop and narrow screens. Use semantic buttons, labels, tables, and visible progress states.
- Add a small initial game state and a reset-save action so a new player can enter the loop immediately.

### 2. Implement planet economy and progression — implemented

- Define Ore, Crystal, Hydrogen, energy, production, storage, and building data in one catalog.
- Implement mine and power changes, resource accrual, affordability checks, building costs, and construction timers.
- Add Capitol, Research Lab, Shipyard, and Foundry as progression buildings. Keep their exact requirements and effects in data rather than hard-coding them into view code.
- Add a research catalog with prerequisites, costs, unlock effects, and ship-stat improvements. Add ship definitions and a shipyard queue that checks research and building prerequisites.

### 3. Implement the universe and fleet missions — implemented

- Model each system as 15 ordered positions: eight alternating planetary berths and seven orbital positions. Keep per-system slot layouts data-driven so orbital stations, anomalies, and other future objects can be added without locking in their types now. NPCs use a small set of data-driven defender and resource templates.
- Add fleet inventory and dispatch for espionage, attack, transport, harvest, and colonization. Validate mission-specific ship requirements, fuel, cargo, and destination before departure.
- Advance travel as scheduled events. Apply arrivals and return trips to the same simulation clock as production and queues.

### 4. Integrate combat and mission rewards — implemented

- Adapt the pinned optimizer battle module behind a game-facing `simulateBattle` interface. Map game ship counts and research into the engine, then convert expected survivors to integer inventory with a documented deterministic rounding rule.
- Create a battle report with starting fleets, outcome, losses, plunder, and debris. NPC defense and resource values come from the target definition.
- Add a game-specific reward resolver. On attacker victory, calculate plunder from the configured share and cap it by surviving cargo. Add debris from destroyed ships to the target location; recyclers collect it on a later harvest mission.
- Do not use the optimizer's plunder estimator as the game's reward system; its expected multi-wave rules and cargo guidance are analysis-specific.

### 5. Save, resume, and close the loop — implemented

- Persist the complete game state and simulation timestamp after player actions and completed events.
- On load, advance the simulation through elapsed time and resolve all due events in order, respecting resource storage and available ship counts.
- Add visible completion messages for construction, research, ship production, fleet arrivals, battle outcomes, and harvesting.

## State and module boundaries

Keep simulation functions independent of DOM rendering. The initial save contains:

- `schemaVersion`, `now` (the last simulated epoch timestamp), and the player's resource balances.
- Owned planets, building levels, active construction and ship queues, and current storage.
- Research levels and the active research job.
- Ship inventories, in-flight fleets, NPC targets, debris fields, and recent reports.

Keep static catalogs separate from saves: buildings, technologies, ships, missions, NPC templates, and tunable game rules. UI actions call game commands; commands validate costs and prerequisites, update state, and emit report entries. Rendering reads state and does not own game rules.

## Acceptance checklist

- [x] A new save opens on an all-planets overview with per-colony resources and ship inventories; Colony Overview opens detailed planet status.
- [x] Building upgrades and research spend configured resources, run to completion, and expose options through prerequisite checks.
- [x] Ship production updates the home fleet; resources and energy/storage constraints are reflected in the planet view.
- [x] The player can scout an NPC, attack it, receive a battle report, and return with eligible plunder.
- [x] A battle creates debris from destroyed ships, and a recycler mission can harvest that debris.
- [x] Transport moves resources between owned planets and colonization creates a new owned planet.
- [x] Reloading preserves state; offline simulation advances production and resolves due queues and fleet events chronologically.
- [x] Align the shared command bars with the main content, use the dark gray-on-black palette, and dock resources beside navigation on wide screens.
- [x] Add an all-planets resource and ship table, a selected-colony dashboard, and a system-by-system 15-row slot table with planet/orbit descriptors, debris, actions, and a points-of-interest sidebar.
- [ ] Compare Buildings, Research, Shipyard, Fleet Command, Universe, and Reports against page-specific references when available.

## Reference material

- [Gameplay overview](GAMEPLAY_OVERVIEW.md) — scoped system summary and source caveats.
- [UI theme plan](UI_THEME_PLAN.md) — live overview palette, layout reference, and styling checklist.
- [SFC fleet optimizer](https://github.com/axu930/sfc-fleet-optimizer/tree/12c8a86) — pinned combat source; relevant modules are `js/sfc2-combat.js` and `js/units.js`.
- [SFC2 combat source](https://github.com/axu930/sfc-fleet-optimizer/blob/12c8a86/js/sfc2-combat.js) — expected-value battle implementation.
- [SFC2 wiki combat rules](https://playsfc2.com/wiki/combat) — provisional reference for round, shield, and outcome behavior.
- [SFC2 wiki buildings](https://playsfc2.com/wiki/buildings) and [research](https://playsfc2.com/wiki/research) — provisional reference for progression systems.

## Decisions to revisit

- Replace the CSS planet artwork with approved original assets if the user supplies them.
- Refine the remaining page views as their HTML or screenshots become available.
- Confirm which exact original/SFC2 rules to use for building timers, research effects, ship stats, battle outcomes, plunder, and debris before tuning the initial data catalog.
- Revisit deterministic expected-value combat if the desired single-player feel requires randomized, per-battle ship losses.
- Keep the exact contents and actions for orbital positions open; only the 15-slot, 8-berth/7-orbit structure is defined so far.
