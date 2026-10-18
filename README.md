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
- [Original UI theme plan](UI_THEME_PLAN.md)

The rules catalog is intentionally provisional. The browser shell and planet overview follow the live SFC layout and palette; see [the UI theme plan](UI_THEME_PLAN.md) for the reference details and remaining page refinements.
