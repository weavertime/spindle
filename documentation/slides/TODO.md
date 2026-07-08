# Slides — deferred work & manual QA

## Deferred (Tier 3+ follow-ups)

Not in the current scope; the data model already carries what most of these need.

- **PPTX import / export** — the schema keeps `layoutRef`, placeholder `{type, idx}`, symbolic theme colors, and flat text bodies precisely so this stays honest.
- **Tables and charts** as first-class element types.
- **Video / audio** elements.
- **Element animations** and slide-transition library (v1 ships only a present-mode cross-fade).
- **Nested groups** (v1 groups are flat via a shared `groupId`).
- **Presenter view** with speaker timer and next-slide preview.
- **In-text remote carets** — needs per-fragment cursor handling that `y-prosemirror`'s `yCursorPlugin` doesn't support with per-element fragments; presence is element-level for now.
- **Gradient / image fills** and picture-fill shapes.
- **Master-slide editing UI** — the schema supports masters/layouts; only the editing surface is out of scope.
- **Upload hook for images** — v1 inlines images as data URLs (with a size caveat); a host upload callback is a follow-up.
- **Real PDF backend** — v1 exports through the browser print pipeline ("Save as PDF").

## Manual QA checklist

No React test infrastructure exists in this repo by design; `examples/slides-demo` and the website demo are the smoke tests. Run through this before shipping changes to the editor:

- [ ] **Drag performance** — with ~50 elements on a slide, dragging stays at 60 fps and produces no React commits mid-move (verify in devtools: transforms update on the DOM nodes, the component tree doesn't re-render until pointerup).
- [ ] **Resize / rotate** — the opposite anchor stays fixed at several rotations; Shift aspect-locks; rotation snaps near 45° steps.
- [ ] **Snapping** — smart guides appear against other elements' edges/centres and the slide centre; the box snaps within threshold.
- [ ] **Rich text** — double-click / Enter enters edit with no visual jump; bold/italic/color/size/align/list work both in the live editor and on an idle selection; **IME** composition is never interrupted; test the caret at **25 / 50 / 100 / 200 / 400 %** zoom (the stage uses `transform: scale`; if the caret drifts, fall back to the CSS `zoom` property).
- [ ] **Z-order / align / group** — front/back/forward/backward, align & distribute, group/ungroup, and undo of each.
- [ ] **Layouts & themes** — the new-slide gallery materializes placeholders; the theme picker recolors accents live; slide backgrounds apply.
- [ ] **Present mode** — fullscreen, letterboxed at 16:9, arrow/space/home/end/number-jump nav, cross-fade.
- [ ] **PDF export** — one page per slide at the correct size; fonts and images render (test Chrome and Firefox — Firefox has `@page size` quirks).
- [ ] **Collaboration** — run the demo in two-pane and `?ws=` modes: concurrent moves/reorders/text-in-different-elements converge; undo reverts only the local user's edits; remote presence outlines appear; comments sync; orphaned threads survive element deletion.
