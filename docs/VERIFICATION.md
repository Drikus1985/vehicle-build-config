# Verification report

Date: 2026-08-09 (initial) / 2026-08-15 (Nova integration) · Environment: Linux, Node 22.22,
npm 10.9, Chromium (pre-provisioned) with SwiftShader WebGL.

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
- Compare mode is a synchronised A/B toggle (current vs factory stock), not a split view, and
  compares against stock rather than another saved variant.
- Imported GLB/STL assets are library/preview items only; they cannot yet be attached to a
  build or mapped into components (that requires authoring a manifest).
- Fitment warnings are indicative geometry checks, not measured engineering clearances.
- The e2e error-state test for a corrupt GLB is manual; automated coverage exists for
  validation rejection but not for a mid-stream loader failure.
- No server backend: single-browser persistence, no share links (by design, stated in-app).

## Next three highest-value improvements

1. **Variant-vs-variant compare and split view** — extend Compare mode to pick any saved
   build/variant for the B side and render a true synchronised split viewport.
2. **Manifest authoring flow for imported GLBs** — inspect an imported GLB's node tree in-app
   and interactively map nodes → components/zones, unlocking full editing for user assets.
3. **Backend reference implementation** — a small API implementing the repository interfaces
   (auth + Postgres + object storage) to enable real share links and multi-device sync.
