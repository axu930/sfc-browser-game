# Starfleet Commander UI Theme Plan

**Status:** Reference captured; CSS theme pass implemented and checked at desktop, tablet, and phone widths.

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

## Layout and component direction

1. **Command header:** Keep the game's name and single-player context in a shallow black topbar. Use a compact blue circular star mark and place simulation time and connection status on the right.
2. **Planet strip:** Keep colonies in a horizontally scrollable row. Give each planet a small CSS-rendered globe, name, and coordinates; mark the selected colony with an orange edge.
3. **Resource row:** Show all three balances in one narrow dark strip with their colored abbreviations, amounts, and local production rates.
4. **Navigation:** Keep the global destinations in a dark primary bar and Buildings, Shipyard, and Research in a thinner secondary bar. Use white text and a restrained orange active marker.
5. **Planet profile:** Use the left column for a larger globe, orange planet name, cyan coordinates, facilities and fleet facts, and compact status blocks. Preserve all current controls and factual values.
6. **Overview and facilities:** Use a wide right column with an orange Overview heading, concise economy summary, facility and fleet tables, active projects, recent activity, and known signals. Keep table headers muted and battle outcomes green. Facility rows should use the reference's compact icon, title, details, and action rhythm as the building screen receives a deeper layout pass.
7. **Responsive behavior:** Preserve the planet strip as a horizontal scroller. At tablet widths, stack overview sections while retaining the profile rail where space allows. On narrow phones, stack the profile and content and allow tables and navigation rows to scroll horizontally.

## Implementation boundaries

- Apply the theme in `styles/game.css` and make only the semantic class or markup adjustments needed in `index.html` and `src/app.js`.
- Keep local game mechanics, labels, and navigation actions intact. Do not add online-game controls such as credits, alliances, moons, or account actions unless the local game supports them.
- Recreate starfield, buttons, active states, and planet-globe decoration with local CSS. Do not hotlink the live site's assets or copy authenticated page markup.
- Keep the current SFC2 rules caveats and single-player-only scope from `GAMEPLAY_OVERVIEW.md`.

## Validation checklist

- [x] Compare the local overview against this layout and palette at desktop, tablet, and phone widths.
- [x] Check that resource text, section headings, links, active navigation, and positive status remain legible on the starfield.
- [x] Confirm primary and facility navigation still work after styling changes.
- [ ] Refine the Buildings list into reference-inspired facility rows; compare Research, Shipyard, Fleet Command, Universe, and Reports as additional references are available.

## Reference

Live [Starfleet Commander](https://playstarfleet.com/) Overview and Buildings views, observed 2026-10-18. Palette values were read from rendered CSS; account-specific values and live asset URLs are not part of this specification.
