# Galaxy slots and orbital positions

**Status:** The slot structure and table presentation are implemented. What orbital positions contain remains undecided.

## Reference point

The supplied original-game Galaxy page is a 15-row slot table with columns for slot, planet, debris, player, status, alliance, and actions. The rows expose actions such as colonizing a planet, harvesting debris, attacking, and espionage. This page is the reference for the table presentation; it does not settle the single-player game's future orbital content.

Reference: [Starfleet Commander](https://playstarfleet.com/) Galaxy page, HTML supplied for this project on 2026-10-18.

## Design chosen for this game

Each system has 15 numbered positions, displayed as one row per slot. The positions alternate:

| Slots | Position type | Colonizable |
| --- | --- | --- |
| 1, 3, 5, 7, 9, 11, 13, 15 | Planetary berth | Yes, when unoccupied |
| 2, 4, 6, 8, 10, 12, 14 | Orbital position between planetary berths | No |

This gives every system eight colonizable planets with one orbital position between each adjacent pair. An empty planetary berth offers a Colonize action. An empty orbital position is shown as Open Orbit and has no colonization action.

Each row summarizes its position, planet or orbit, debris field, known presence, and available actions. The Points of Interest sidebar remains alongside the table and provides a detail view for colonies, contacts, fleets, and debris. Choosing Colonize on an empty berth creates its target and opens Fleet Command with the colonization mission selected.

Colonization checks both dispatch and arrival, so an orbital position cannot become a colony through a stale or manually constructed fleet order. Existing saves move legacy colonies and empty-world targets to the nearest open planetary berth when one is available; cached destinations for their in-flight fleets are updated too.

## Why it differs

The original reference presents the system as a list of 15 slots. This game gives those rows two different spatial roles: eight are planetary berths and the seven positions between them are orbits. That creates room for future stations, asteroid belts, or other anomalies without treating all 15 positions as colonizable planets.

## Kept open

- Whether orbital positions hold stations, asteroid belts, anomalies, or some mixture.
- Which actions or game rules any future orbital object will have.
- Whether an orbital position can ever become colonizable through a special object or rule.
- Whether the initial alternating layout will vary by system.

The slot layout is data-driven per system, so these choices can be made later without changing the 15-slot coordinate model. No specific orbital object or one-way progression rule is established here.

## Implementation references

- [Universe slot layout and save migration](../src/game/universe.js)
- [Colonization validation](../src/game/fleets.js)
- [Universe table rendering](../src/app.js)
