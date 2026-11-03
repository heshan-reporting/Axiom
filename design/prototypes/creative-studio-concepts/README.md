# Creative Studio concepts (prototypes, not the app)

Three interactive prototypes of the Creative Studio for choosing a direction, 6 November 2026. They are isolated from production:
they live outside `docs/` (GitHub Pages serves only `docs/`), load nothing from the app, and talk to no worker, model or key.
Every client detail is invented (Harbourline Ferries, the synthetic demo client).

- `concept-a.html` - **Production Desk**: a persistent three-panel desk (pieces and layers, canvas, inspector) with the
  production checks always in view. For direct editing and production control.
- `concept-b.html` - **Creative Direction Board**: a pin-up wall of direction boards with the Creative Partner's reasoning,
  requirements per direction, brand references, compare, combine, set aside and choose. No canvas, no inspector.
- `concept-c.html` - **Guided Production**: seven steps from brief to delivery in one focused column; Design opens a full-window
  canvas with a floating toolbar, exact positioning, a version strip and a collapsible Creative Partner. Every wait shows the call,
  elapsed time, typical time and an estimated share, and never blocks.
- `index.html` - the three side by side, with the structural comparison.
- `shared.js` / `shared.css` - the one sample (client, brief, copy, requirements, four routes) and the tile renderer all three use,
  so they differ in structure only. The checks here are stand-ins for the Studio's measurement, not the Studio's own.

Open them:

```
cd design/prototypes/creative-studio-concepts
python3 -m http.server 8080
# http://localhost:8080/  (or concept-a.html, concept-b.html, concept-c.html)
```

Nothing here is wired to production. A chosen concept is planned into `docs/studio*.js` separately, after the choice.
