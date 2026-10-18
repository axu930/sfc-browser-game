# Starfleet Commander Core Gameplay Overview

## Purpose and source note

This is an implementation-oriented overview of the basic gameplay loop for a future single-player browser version. It describes system roles and how they connect, rather than reproducing costs, formulas, ship statistics, or every edge case.

The supplied [wiki URL](https://playstarfleet.com/wiki) could not be retrieved. The [live Starfleet Commander site](https://playstarfleet.com/) links to SFC2 as a rebuilt next-generation version, and its [active wiki](https://playsfc2.com/wiki/buildings) was accessible for research. The concepts below stay at the level of the requested core systems. Exact rules, values, and version-specific details should be confirmed against the intended original ruleset before implementation.

## Core progression loop

1. **Produce resources** on planets through mines and supporting infrastructure.
2. **Invest resources** in buildings, ships, and research to increase production and expand available capabilities.
3. **Unlock and improve ships** as technology and construction prerequisites are met.
4. **Dispatch fleets** to attack, gather intelligence, transport resources, harvest debris, or establish colonies.
5. **Resolve encounters** against NPC defenders through the battle system. Successful attacks can return with plunder; destroyed ships can leave debris for recyclers.
6. **Reinvest the returns** into the economy, technology, fleet, or further expansion.

This creates a loop between economic growth and fleet activity: infrastructure enables stronger fleets, and fleet operations can return resources that accelerate infrastructure and research.

## Planets, resources, and buildings

Planets are the player's economic and construction bases. The basic resource set is **Ore, Crystal, and Hydrogen**. Production buildings generate these resources over time, while power infrastructure supports resource production. Storage and production capacity determine how much a planet can hold and produce efficiently; exact limits and formulas are outside this overview.

Resources are spent on buildings, ships, and research. Hydrogen also has an operational role in the accessible SFC2 rules as fleet fuel, so its economy can affect how often and how far fleets can travel; confirm that behavior for the intended original-version baseline.

The main building roles are:

- **Resource production:** mines generate Ore, Crystal, and Hydrogen.
- **Energy generation:** power buildings support the energy needs of production.
- **Capitol:** planet development and construction progression; in the accessible reference it also gates the Shipyard and contributes to local building speed.
- **Research Lab:** enables technology research.
- **Shipyard:** converts resources into ships.
- **Foundry:** advanced construction support; the accessible reference describes it as improving local construction speed.

Buildings therefore serve both as investments in future income and as gates into later capabilities. The original ruleset's exact prerequisites, queues, building names, and speed effects remain to be checked before they are encoded.

Sources: [Buildings](https://playsfc2.com/wiki/buildings), [Mines](https://playsfc2.com/wiki/mines), [Energy](https://playsfc2.com/wiki/energy), [Capitol](https://playsfc2.com/wiki/capitol), [Shipyard](https://playsfc2.com/wiki/shipyard), [Foundry](https://playsfc2.com/wiki/foundry), [Resources](https://playsfc2.com/wiki/resource).

## Research and progression

Research is a resource-funded progression system. Technologies can unlock ships and buildings, satisfy prerequisites for further technologies, and improve the capabilities of ships. This connects the research economy to both expansion and combat effectiveness.

For the single-player design, research should be understood as a dependency layer between the player's current infrastructure and later options. The overview intentionally does not prescribe research trees, numerical bonuses, research concurrency, or exact unlock thresholds, because those details can vary by version and balance.

Sources: [Research](https://playsfc2.com/wiki/research), [Research Lab](https://playsfc2.com/wiki/research-lab), [Ships](https://playsfc2.com/wiki/ships).

## Ships and fleet operations

Ships are specialized units assembled into fleets. The basic roles in scope are:

- **Combat ships** engage defenders during attacks.
- **Espionage probes** scout targets and report information that helps the player decide whether to attack.
- **Cargo ships** transport resources between owned planets and provide carrying capacity for returns.
- **Recyclers** collect Ore and Crystal from debris fields.
- **Colony ships** establish a new settlement at an available location.

Fleet missions turn these roles into actions: **attack, espionage, transport, debris harvesting, and colonization**. A mission determines the fleet's objective, destination, and relevant ship requirements. Specific fleet limits, fuel formulas, travel times, and mission edge cases are left open for later ruleset selection.

Sources: [Ships](https://playsfc2.com/wiki/ships), [Fleet interface and missions](https://playsfc2.com/wiki/interface), [Espionage](https://playsfc2.com/wiki/espionage), [Transport](https://playsfc2.com/wiki/transport), [Harvest](https://playsfc2.com/wiki/harvest).

## NPC encounters

NPCs provide targets in the universe for fleet activity. An encounter can contain defending ships and resources. The player can gather intelligence first, then choose whether to commit a fleet to an attack. This provides a repeatable single-player activity that connects ship construction, research, combat, and resource acquisition.

This overview does not specify spawn frequency, difficulty scaling, target lifetimes, or loot tables. Those are live-game tuning rules and should be designed for the single-player version rather than inherited implicitly.

Source: [Non-player characters](https://playsfc2.com/wiki/non-player-character).

## Battle, plunder, and debris

An attack mission triggers a battle between the attacking fleet and the target's defenders. The battle engine resolves the encounter and produces an outcome and report. If the attacker wins, surviving ships can carry resources away as **plunder**. The cargo capacity of surviving ships matters, and the loot returns with the fleet.

Ships destroyed in battle create a **debris field** that recyclers can harvest later. Plunder and debris are separate rewards: plunder comes from the defender's stored resources after a successful attack, while debris comes from ship losses during the battle. This gives combat both immediate rewards and a follow-up fleet operation.

Exact battle rounds, targeting, survival probabilities, plunder percentages, debris yields, and the treatment of defenses are intentionally omitted pending confirmation of the target ruleset.

Sources: [Combat](https://playsfc2.com/wiki/combat), [Plunder](https://playsfc2.com/wiki/plunder), [Debris](https://playsfc2.com/wiki/debris), [Harvest](https://playsfc2.com/wiki/harvest).

## Deliberate exclusions

This is a basic gameplay overview. It does not cover Hephaestus or other advanced unit systems, alliance or PvP rules, moon-specific systems, detailed ship catalogs, exact balance data, or a full combat specification. Those can be added after the intended single-player modifications are defined.
