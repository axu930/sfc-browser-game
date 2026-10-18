# Starfleet Commander UI Theme Plan

**Status:** Reference captured; current prototype direction refined to an empire overview, system slot table, and dark gray-on-black palette.

Use the live Starfleet Commander planet overview as the visual reference for the single-player interface. The goal is to carry over its recognizable space-game layout, contrast, and color cues while keeping the local game readable, responsive, and independent of the live game's assets or account actions.

## Reference observations

- The page uses a black starfield backdrop and a compact Arial-based interface.
- A shallow top bar holds the game mark, universe selector, account utilities, and clock.
- Owned planets form a horizontal strip with small circular planet and moon images and coordinate labels.
- Resource totals sit in a separate narrow row above two navigation bands: global navigation and planet facilities.
- The main area puts the selected planet, coordinates, image, and compact status panels on the left. The right side holds the overview and a recent-battles table.
- Main text and navigation are white. Planet and section headings are orange, links are bright cyan, successful battle results are green, and resource balances use a vivid red accent. Small information panels use muted blue-gray surfaces with dark text.
- Major headers and controls are compact and mostly flat. The starfield remains visible behind the main content; panels use restrained borders rather than large rounded cards.
- The Buildings view keeps the same command bars and sidebar. Its central area uses a vertical list of facility rows with an icon, cyan facility title, orange bonus link, short description, compact production details, a green action, and thin separators.

## Theme tokens

| Role | Reference value | Use |
| --- | --- | --- |
| Space background | `#000000` with sparse blue-white stars | Page background, recreated with CSS gradients |
| Main text | `#ffffff` | Navigation, labels, and overview copy |
| Planet and section headings | `#ff9219` | Planet name, section titles, selected emphasis |
| Links | `#00d5ff` | Coordinates and navigable text |
| Positive status | `#40ff50` | Successful outcomes and online indicators |
| Resource balance accent | `#ff4050` | Ore, Crystal, and Hydrogen totals |
| Muted text | `#666666` to `#aeb9bd` | Table headers, secondary labels, utility text |
| Information surfaces | `#b7c5c5` over `#363636` | Compact planet facts and status blocks |

These values are sampled from computed styles on the live overview. Use them as a palette guide; keep sufficient contrast for the local interface and do not depend on the live site's background or chrome image URLs.

## Current prototype direction

The prototype keeps the live site's compact command-bar structure, while following the user's refinements to layout and contrast:

- Keep the header, planet strip, menus, and page content on a shared centered width. The shared width expands on large screens so the interface does not remain narrow at fullscreen.
- Dock Ore, Crystal, and Hydrogen as three stacked resource rows to the right of the global and colony navigation rows. On narrow screens, move the resource rows below navigation and place them side by side.
- Use charcoal and black surfaces with light gray text for the general interface. Reserve light boxes with dark text for high-value readouts such as fleet counts and research levels.
- Make Overview the all-planets view: one compact table with per-colony Ore, Crystal, Hydrogen, and stationed ships. Show empire-wide resource totals in the command ribbon.
- Make Colony Overview a button in the colony navigation row. It opens the detailed dashboard for the currently selected planet.
- Make Universe a system-by-system view with previous/next navigation, a 15-row slot table, and a points-of-interest sidebar for colonies, contacts, fleets, and debris. Each system has eight planetary berths separated by seven orbital positions; orbital contents remain open for later design.

## Layout and component direction

1. **Command header:** Keep the game's name and single-player context in a shallow dark topbar. Place simulation time and connection status on the right.
2. **Planet strip:** Keep colonies in a horizontally scrollable row. Give each planet a small CSS-rendered globe, name, and coordinates; mark the selected colony with a muted light-gray edge.
3. **Resource dock:** Align the three resource readouts at the right edge of the two-row navigation stack. Show empire totals on Overview and selected-colony balances on colony pages.
4. **Navigation:** Keep global destinations in a primary bar and Colony Overview, Buildings, Shipyard, and Research in a thinner secondary bar. Use light-gray text and a restrained silver active marker.
5. **All-planets view:** Use a concise full-width table with each colony's coordinates, resource amounts, and ship inventory. Selecting a colony opens Colony Overview.
6. **Colony and universe views:** Keep the detailed economy, infrastructure, queue, and activity panels on Colony Overview. The Universe view uses a 15-row table that describes each planet/orbit position, debris field, presence, and available action, with a side panel for points of interest.
7. **Responsive behavior:** Preserve the planet strip as a horizontal scroller. On narrow screens, move resources beneath navigation, stack the universe sidebar below its map, and let wide tables scroll horizontally.

## Implementation boundaries

- Apply the theme in `styles/game.css` and make only the semantic class or markup adjustments needed in `index.html` and `src/app.js`.
- Keep local game mechanics, labels, and navigation actions intact. Do not add online-game controls such as credits, alliances, moons, or account actions unless the local game supports them.
- Recreate starfield, buttons, active states, and planet-globe decoration with local CSS. Do not hotlink the live site's assets or copy authenticated page markup.
- Keep the current SFC2 rules caveats and single-player-only scope from `GAMEPLAY_OVERVIEW.md`.

## Validation checklist

- [x] Compare the local command layout against the reference at desktop, tablet, and phone widths.
- [x] Check that resource text, section headings, links, active navigation, and status remain legible on dark surfaces.
- [x] Confirm primary and facility navigation work, including the separate All Planets and Colony Overview destinations.
- [x] Add system-by-system navigation and a points-of-interest sidebar to the Universe view.
- [ ] Refine the Buildings list into reference-inspired facility rows; compare Research, Shipyard, Fleet Command, Universe, and Reports as additional references are available.

## Reference

Live [Starfleet Commander](https://playstarfleet.com/) Overview and Buildings views, observed 2026-10-18. Palette values were read from rendered CSS; account-specific values and live asset URLs are not part of this specification.
