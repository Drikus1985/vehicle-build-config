# Verification report

Date: 2026-08-09 (initial) / 2026-08-15 (Nova integration) · Environment: Linux, Node 22.22,
npm 10.9, Chromium (pre-provisioned) with SwiftShader WebGL.

## Split-view variant compare (2026-08-19)

- Compare mode is now a true synchronised split viewport: the left/top pane stays the
  interactive current build; the right/bottom pane renders factory stock or any saved
  build/variant chosen in the "Compare against" picker. The follower pane has no
  controls of its own — it copies the primary camera's pose every frame (each pane
  keeps its own aspect) and listens for camera-change notifications so the sync also
  works under on-demand/reduced-motion rendering. Panes stack vertically on narrow
  screens.
- Scene chrome (environment map, background/fog, lights, shadows, grid) was factored
  into a shared rig used by both panes, so Scene settings apply to both sides. Saved
  builds load through the zod-validated repository path, so variants saved before
  newer build fields existed compare correctly. A B-side vehicle without a 3D asset
  shows a truthful placeholder.
- 106/106 unit tests (compare state resets on mode change; stock reference stays
  pristine while the working build changes); 6/6 e2e including a new split-view test
  (two canvases, pane labels, picker, clean exit back to one viewport); verified
  visually with a duplicated Nova variant (blue vs red) in ¾ and side views — framing
  identical across panes, zero console errors.

## Draco compression (2026-08-18)

- `scripts/compress-glb.mjs` (gltf-transform + draco3dgltf, ALL_EXTENSIONS registered
  so the original asset's KHR transmission/specular/ior glass passes through):
  nova-1970.glb 30.8 MB → 2.7 MB, nova-1970-uv.glb 31.8 MB → 2.8 MB (9 % of
  original). Quantization 14-bit position / 10-bit normal / 12-bit UV.
- Decoder hosted locally at `public/draco/` (Apache-2.0, from the three.js
  distribution) and wired into the vehicle loader (`useGLTF(urls, '/draco/')`), the
  imported-wheel loader and the import preview — fetched only when a file requires
  the extension, so uncompressed assets keep loading identically.
- New test: manifest `compression` metadata must match `extensionsRequired` in the
  local files (skips when assets absent). Node-name JSON parsing (and therefore the
  GLB↔manifest cross-checks) is unaffected by Draco.
- Verified visually with the full appearance stack on the compressed assets — twin
  rally stripes (crisp mask edges, no quantization artefacts), two-tone scheme,
  roundels, lettering, patina at 35 %, plates — zero console errors; 104/104 unit
  tests, 5/5 e2e. Hood roundel anchor moved to the classic driver's-side offset
  position, clear of the SS hood vent strips (verified from the top view).

## Patina & weathering (2026-08-18)

- Seeded procedural weathering drawn onto the livery canvas above all graphics:
  chalky fade blobs (rimless radial falloff) on horizontal panels and upper sides,
  rust blotch clusters biased low on the body and toward horizontal-panel edges,
  grime gradient pooling along the rockers — all generated in car space through the
  `liveryPanels` frames. Material response: roughness rises and clearcoat falls with
  the amount on livery-mapped materials.
- One mulberry32 PRNG seeded from the build drives all randomness, so a saved build
  restores pixel-identical weathering; "Re-roll pattern" just picks a new seed.
  `patina` on the Build is zod-defaulted for older saves and undoable.
- 103/103 unit tests (legacy parsing, range/int rejection, active-state logic, PRNG
  determinism + range, undo); 5/5 e2e; verified visually at 55 % and 90 % over stock
  paint and over the Hockey-stick livery + roundel, zero console errors. Labelled a
  cosmetic display effect in-app; hood/roof fade appears only via the UV atlas zones
  (body + hood), other zones (chrome, bumpers) deliberately stay clean.

## Pre-designed livery schemes (2026-08-18)

- Four full-car schemes (Side spear, Hockey stick, Lower two-tone, Nose & tail bands)
  with configurable scheme + keyline colours, drawn under roundels/lettering on the
  livery canvas. Shapes are car-space polygons projected through `liveryPanels` — one
  affine car-space→UV frame per atlas island, emitted by the probe script. Each body
  side proved to be a single affine island (door frame predicts the quarter and fender
  vertex UVs to < 0.001 UV), so one polygon per side covers fender+door+quarter, and
  shapes sharing z ranges wrap continuously over shoulders (verified: the tail band
  lines up across trunk lid and quarters, the nose band across hood and fenders).
- Accent polygons draw before primaries, giving clean keyline borders without stroke
  seams. Unknown scheme ids draw nothing and count as no livery content.
- `scheme` on the Build (zod-defaulted for saves that predate it), undoable, printable
  summary line. 98/98 unit tests (scheme/panel validity, frame regression against
  independently probed vertices, legacy parsing, colour rejection, undo); 5/5 e2e; all
  four schemes verified visually (left/¾ front/¾ rear/top) with zero console errors.

## UV livery system (2026-08-18)

- Racing roundels (number, disc/ring colours, size) on doors/hood/roof/trunk and
  lettering (text, colour, size) on fenders/quarters — every placement an independent
  toggle. Graphics are drawn onto a 2048² canvas in the asset's UV space and composited
  over paint and stripes in the zone shader by alpha (uniform-driven, one shared program,
  no recompiles).
- Placement data: `liveryAnchors` in the manifest — centre UV plus a measured UV-per-metre
  frame per panel, derived from the UV asset's geometry by
  `scripts/probe-nova-livery-anchors.mjs` (the atlas is an affine orthographic unwrap at
  ~0.20 UV/m). Both body sides carry identical text orientation in UV space, so decals
  read correctly and unmirrored on either side; hood/roof read from the front, the trunk
  from the rear — all verified in screenshots (¾ front, left, right, ¾ rear, top).
- Runtime asset selection: the viewer HEAD-checks the manifest's `liverySource`
  (`nova-1970-uv.glb`, licensed → gitignored) and prefers it; without it the original GLB
  loads and the Paint tab explains that liveries need the UV asset. The two UV-only glass
  nodes (`Object001`/`Object002`) are mapped to the glass zone; add-on parts (scoops,
  spoilers) are excluded from livery sampling because their UVs are unrelated.
- `livery` on the Build (zod-defaulted for legacy saves), sanitised inputs (number ≤3
  alphanumerics, lettering ≤18 printable chars), undoable actions, printable-summary
  section, GLB↔manifest cross-check extended to the UV asset.
- 94/94 unit tests (anchor validity/frames, legacy parsing, range rejection, sanitisers,
  undo, UV-asset node coverage); e2e 4 passed + 1 flaky-passed-on-retry (the autosave
  reload test, timing-sensitive under SwiftShader); zero console errors in all livery
  screenshot runs.

## Racing stripes (2026-08-18)

- Shader extension (onBeforeCompile on the zone materials the manifest lists in
  `stripeZones`) computes stripe masks from car-space position + normal: single centre and
  twin rally cover top surfaces plus upper nose/tail faces; side rockers band the lower
  body sides between the wheel arches. No UVs or decal textures required; stripes follow
  the cowl scoops and stay glued through stance/isolate/explode. Uniform-driven, so style/
  colour/width changes never recompile shaders; all stripe materials share one program.
- `stripes` on the Build (style, colour, width 50-150%), zod-defaulted for legacy builds;
  undoable action; Paint tab UI; printable summary line. Nova enables zones body+hood;
  the TF-100 opts out (it has a physical stripe part).
- 86/86 unit tests (style indices, zone validity, legacy parsing, range rejection, undo);
  5/5 e2e; all three styles verified visually with zero console errors.

## Custom numberplate (2026-08-18)

- Generic `plateMounts` manifest metadata (position/size/rotation measured from the baked
  `LicPlate` meshes, which are force-hidden) + `plateSetup` on the Build (zod-defaulted so
  builds saved before the field existed keep loading — covered by a legacy-parse test).
- Canvas-texture plates (1024px, sRGB) with sanitised text (uppercase, A-Z 0-9 space
  hyphen, 10 chars) in four generic colourways — deliberately no real jurisdiction's
  plate design. Front & rear render at the measured 520 x 110 mm mounts; clicks resolve to
  the "Licence plates" part; removing/hiding/isolating that part controls the plates.
- Paint tab UI (text input + style buttons), printable summary line, undo/redo coverage.
- 80/80 unit tests; 5/5 e2e; verified visually front + rear with custom text and zero
  console errors.

## UV-mapped asset conversion (2026-08-18)

- Seller's UV package (OBJ/MTL/FBX/MAX + UV template PNG, no glTF) fetched from the user's
  Google Drive and converted via `scripts/convert-nova-uv-to-glb.mjs`: cm/Z-up/nose--Y →
  m/Y-up/nose-+Z (verified against the original GLB's wheel coordinates), vertex welding
  (106 MB → 31.8 MB), Phong→PBR material conversion.
- 117 named nodes: all 115 original names byte-identical, plus `Object001`/`Object002`
  (window glass split by the UV work). UVs present on every node except the `text_396`/
  `text_397` badge scripts. Bounding box identical to the original asset.
- Rendered in-app via temporary swap with zero console errors; original asset kept as the
  runtime file (nicer KHR transmission glass), UV variant staged as `nova-1970-uv.glb`
  (gitignored, Standard License) for upcoming texture features.

## Nova customisation upgrades (2026-08-16)

- **Independent paint zones** for Hood, Front/Rear bumper, Grille and Trim mouldings (plus
  the existing Body/Interior). 74/74 unit tests including a zone-exposure test; verified
  visually (black hood over red body, chrome elsewhere untouched, zero console errors).
- **Interchange parts**: project-original CC0 add-on GLB (`nova-addons.glb`, committed;
  regenerable via `npm run generate:nova-addons`) with 2"/4" cowl-induction scoops, chin
  spoiler and ducktail/wing trunk spoilers. Manifest schema gained an optional
  `addonSource`; the renderer merges both assets into one node namespace. Scoops follow the
  Hood paint zone; spoilers follow Body. Cross-checked GLB↔manifest in tests and verified
  installed in-browser.
- **Imported wheels**: Import dialog can tag a GLB/STL as a wheel model; it appears in
  Wheels & Tyres per axle, is auto-oriented (rotation-axis detection), centred and scaled to
  the configured overall tyre diameter, with a steelie fallback when the asset is missing in
  the current browser. Normalization covered by unit tests for all three source axes.
- Deferred (next): custom numberplate text — planned as generated plates (canvas texture)
  replacing the baked `LicPlate` meshes.

## Nova SS 396 integration (2026-08-15)

- 66/66 unit tests including Nova manifest/parts schema + reference consistency, OEM-wheelset
  suspend/restore behaviour, and (when the licensed GLB is installed locally) a two-way
  GLB↔manifest node cross-check (every manifest node exists in the GLB, every GLB node is
  mapped).
- Renderer refactor verified visually with the real asset: body repaint affects only the body
  zone; chrome/glass (KHR transmission)/black trim/interior keep the asset's original PBR
  materials; multi-primitive nodes (licence plates) are handled.
- Factory wheel set: installed by default; removing it (Wheels tab banner or Parts tab)
  enables parametric wheels/stance — verified in-browser with zero console errors; undo
  restores the factory set.
- The purchased GLB is `.gitignore`d (Standard License forbids public redistribution); tests
  that need it skip cleanly when absent, and the viewer shows a truthful missing-asset path.
- Note: the 32 MB, ~1M-triangle asset is slow under headless SwiftShader (software WebGL);
  fine on hardware GPUs. Draco/meshopt compression is a sensible next optimisation.

## Commands run and results

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc -b`, strict) | ✅ clean |
| `npm run lint` (ESLint + typescript-eslint + react-hooks) | ✅ clean |
| `npm run format` (Prettier) | ✅ clean |
| `npm test` (Vitest, jsdom + fake-indexeddb) | ✅ 60/60 across 10 files |
| `npm run test:e2e` (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`) | ✅ 5/5 |
| `npm run build` (production) | ✅ ~8.5 s; three.js/R3F split into lazy chunks |
| `npm run generate:demo-vehicle` | ✅ 307 KiB GLB, 37 named meshes |

## What the tests cover (mapped to the required checklist)

1. **Filters/selection → correct manifest**: `VehicleLibrary.test.tsx` (search, type filter,
   3D-ready filter; selection creates a build wired to `manifest-tf100`).
2. **Paint affects intended zone only**: zone-scoped paint state (`buildStore.test.ts`) +
   per-node zone materials verified visually; e2e reload test asserts the Body zone value.
3. **Component add/remove/replace/isolate/restore**: `buildStore.test.ts`, e2e undo/redo test.
4. **Wheels/tyres/stance update model + derived specs**: `tyres.test.ts`, `WheelsTab.test.tsx`
   (designation + Ø recompute), stance presets test.
5. **Incompatible combinations warn without corrupting**: `tyres.test.ts` fitment warnings,
   `compat.test.ts` vehicle-change analysis, `WheelsTab.test.tsx` warning render.
6. **Titanforge records highlight/persist/filter/export**: `titanforge.test.ts` (export
   contents, CSV escaping/injection, `manufacturingValidated:false` invariant), e2e export
   menu wiring; overlay filtering is driven by the same state verified in unit tests.
7. **360 orbit + camera presets**: e2e clicks presets/turntable with a live WebGL canvas
   (mouse); touch uses the same OrbitControls handlers.
8. **Valid imports previewed, invalid fail safely**: `validate.test.ts` (12 cases: signatures,
   truncated/old GLB, oversize, STL structure, OBJ hint, filename sanitisation).
9. **Save/reload reproduces the build**: `idb.test.ts` byte-identical round-trip + e2e
   reload test through real autosave.
10. **Undo/redo restores state**: `buildStore.test.ts` across paint/parts/wheels/records +
    e2e.
11. **Empty/loading/error/unsupported states**: empty + no-asset states asserted in e2e/unit;
    loading overlay and viewer error boundary implemented (error path exercised manually).
12. **No dead controls**: e2e console-error check is clean; every top-bar/panel control is
    wired or explains itself (Share dialog, geometry-export note, metadata-only vehicles).

## UI inspection

Checked at 1440×900, 1024×768 and 390×844 via scripted screenshots: no horizontal overflow,
clipped text or broken controls after fixes (library cards no longer flex-shrink; top bar
scrolls on narrow screens; panels overlay with toggles on small viewports). Browser console:
no errors or warnings during load, vehicle selection, painting, mode switches.

## Remaining limitations

- The TF-100 is a stylised primitive-based demo asset; real scanned/modelled vehicles will
  look dramatically better through the same pipeline.
- Imported GLB/STL assets are library/preview items only; they cannot yet be attached to a
  build or mapped into components (that requires authoring a manifest).
- Fitment warnings are indicative geometry checks, not measured engineering clearances.
- The e2e error-state test for a corrupt GLB is manual; automated coverage exists for
  validation rejection but not for a mid-stream loader failure.
- No server backend: single-browser persistence, no share links (by design, stated in-app).

## Next highest-value improvements

1. **Manifest authoring flow for imported GLBs** — inspect an imported GLB's node tree in-app
   and interactively map nodes → components/zones, unlocking full editing for user assets.
2. **Backend reference implementation** — a small API implementing the repository interfaces
   (auth + Postgres + object storage) to enable real share links and multi-device sync.
