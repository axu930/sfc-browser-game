# sfc-browser-game

A single-player browser prototype inspired by Starfleet Commander. It implements the shared economy, research, fleet mission, NPC, battle, plunder, and debris loop with provisional rules.

## Run locally

Requires Node.js 22 or newer; there are no package dependencies.

```sh
npm start
```

Open the localhost address printed by the server. The game saves to browser `localStorage` and runs as a static site on GitHub Pages.

Run the gameplay and persistence checks with:

```sh
npm test
```

## Project references

- [Gameplay overview](GAMEPLAY_OVERVIEW.md)
- [Implementation plan and acceptance checklist](IMPLEMENTATION_PLAN.md)

The rules catalog is intentionally provisional. The shared browser shell and planet overview now follow the structure of the user-supplied SFC overview HTML; other page views can be refined as their references become available.
