# dreamweaver

Design tools for any local dev page. Pick an element, tweak it live, and send
what you changed to a coding agent as a note.

- **Pixel cursor** (bottom-right, or ⌥H) turns on selecting. Hover outlines, click picks,
  **Shift-click** picks several (again to drop one); tools edit them all together.
- **Card** beside the picked element: a shelf of tools above a note input. Drag it by its header.
- **Tools:** Note (⌥A), Color (⌥C, full HSL + eyedropper, SVG fill/stroke), Text size and weight (⌥T), Corners (⌥R).
- **Notes** carry what you typed plus every tracked change (`font-weight: 400 → 700`).
  **Build** sends the batch to the repo whose dev server served the page, as
  `.claude/annotations/<timestamp>.md`; `/notes` in that repo applies it.
- Edits are inline styles until reload. Nothing here edits code.

## How it fits together

| Piece | Where | What it does |
| --- | --- | --- |
| Chrome extension | `extension/` | On every `localhost` / `127.0.0.1` page, loads the overlay if the server answers `/health`. |
| Overlay | `src/overlay/` → `dist/overlay.js` | The tools, in a shadow root. One module per tool under `tools/`. |
| Server | `server/` | Serves the overlay, rebuilds it when `src/` changes, files note batches into the right repo. |
| Login agent | `launchd/` | Starts the server at login and restarts it if it exits. |

The server always serves the **last build that worked**: a change that fails to
bundle or parse is reported at `/health` (`buildError`) and in the log, and pages
keep the previous version.

## Install

```sh
sh scripts/install.sh
```

Links `~/.local/share/annotate` to this repo (so the unpacked extension Chrome
already has keeps working), links `dreamweaver` / `annotate` into `~/.local/bin`,
and registers the login agent. Re-run after upgrading Node. Remove the agent with
`sh scripts/install.sh --uninstall`.

First time on a machine: load `extension/` in `chrome://extensions` (Developer
mode → Load unpacked).

## Working on it

```sh
npm test          # unit: overlay flows in happy-dom, server, routing, build safety
npm run test:e2e  # real Chrome (the installed one, headless): picking, live edits, color, drag, Build
curl -s localhost:4747/health          # version, build error if any
tail -f ~/Library/Logs/dreamweaver.log # builds and filed batches
```

Edit anything under `src/` and reload the page: the agent rebuilds on save.
