# Anne's Den: four UI concepts

Clickable prototypes for the redesign of Anne's Den (`docs/den.js`, `docs/den.css`). The brief, with the audit of
the current interface, is `prompts/annes-den-ui-variations.md`.

**Isolated from production.** Nothing here is served (it is outside `docs/`), loads anything from the app, or talks
to a worker, a model or a key. **Every client, outlet, account, post and sentence is invented**: Harbourline Ferries
is a synthetic demo client. Den reports are client material and none of it is here.

## Open them

Open `index.html` in a browser (double-click works: everything runs from `file://`), or

    cd design/prototypes/annes-den-concepts && python3 -m http.server 8765

| File | Concept | The idea |
|---|---|---|
| `concept-a.html` | The Storyboard | Organised by the report: each brief section is a column holding its evidence, and opens into that section's writing surface |
| `concept-b.html` | The Front Page | The window as a newspaper edition ranked by weight; the brief is the facing page |
| `concept-c.html` | The Reading Room | A reader: list, reading pane, brief; the same shape for Watch and Collection |
| `concept-d.html` | The Clock | A 24-hour timeline of volume, checks and collection gaps; brushing it filters the stream |

Each concept has the same routes: `#today`, `#brief`, `#watch`, `#collection`, `#options`, `#system` (its design
system). Demo states: add `?state=loading|empty|error|busy|dropped|readonly|filed|nogap` before the hash.

`shared.js` is the one synthetic data set and state machine (`window.DEN`); every concept renders from it. `fonts/`
holds DM Sans and Manrope (SIL OFL 1.1, copied from `docs/vendor/fonts/`).

## Screenshots

    node design/prototypes/annes-den-concepts/shots.mjs          # all four, every route, two sizes, five states
    node design/prototypes/annes-den-concepts/shots.mjs b --quick

Writes `shots/<concept>-<view>-<width>.png` and `shots/report.json` (page errors, horizontal overflow, unnamed
controls). It needs Playwright's Chromium and cannot run inside the Claude sandbox, which refuses to launch a browser.

## What happens next

The owner chooses one concept, or a named mix. Only then is it built into `docs/den.js` and `docs/den.css`, test
first, under the constraints in phase 2 of the brief. Nothing in this folder ships.
