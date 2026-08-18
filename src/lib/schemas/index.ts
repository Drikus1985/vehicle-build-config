/**
 * Core data schemas for the vehicle build configurator.
 *
 * Everything the app renders or edits is described by these schemas; the UI
 * contains no hard-coded per-vehicle branches. Zod schemas double as runtime
 * validators at import boundaries (asset manifests, build files, Titanforge
 * exports) and as the source of the static types used across the app.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Shared enums and small values
// ---------------------------------------------------------------------------

export const vehicleTypeSchema = z.enum(['car', 'pickup', 'panel-truck', 'van', 'wagon']);
export type VehicleType = z.infer<typeof vehicleTypeSchema>;

export const bodyStyleSchema = z.enum([
  'coupe',
  'sedan',
  'hardtop',
  'convertible',
  'fastback',
  'wagon',
  'panel',
  'van',
  'stepside',
  'fleetside',
]);
export type BodyStyle = z.infer<typeof bodyStyleSchema>;

export const cabStyleSchema = z.enum(['standard', 'extended', 'crew', 'coe']);
export type CabStyle = z.infer<typeof cabStyleSchema>;

export const bedStyleSchema = z.enum(['stepside', 'fleetside', 'flatbed', 'none']);
export type BedStyle = z.infer<typeof bedStyleSchema>;

export const partCategorySchema = z.enum([
  'body-panel',
  'hood',
  'roof',
  'door',
  'fender',
  'quarter-panel',
  'bumper',
  'grille',
  'lights',
  'mirror',
  'glass',
  'trim',
  'aero',
  'chassis',
  'suspension',
  'brakes',
  'exhaust',
  'wheel',
  'tyre',
  'interior',
  'engine-bay',
  'cab',
  'bed',
  'tailgate',
  'accessory',
]);
export type PartCategory = z.infer<typeof partCategorySchema>;

export const vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof vec3Schema>;

export const attributionSchema = z.object({
  sourceName: z.string(),
  sourceUrl: z.string().optional(),
  creator: z.string().optional(),
  licence: z.string(),
  licenceUrl: z.string().optional(),
  attributionText: z.string(),
  reuseConfirmed: z.boolean(),
});
export type Attribution = z.infer<typeof attributionSchema>;

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export const vehicleSchema = z.object({
  id: z.string().min(1),
  year: z.number().int().min(1948).max(1978),
  make: z.string().min(1),
  model: z.string().min(1),
  trim: z.string().optional(),
  vehicleType: vehicleTypeSchema,
  bodyStyle: bodyStyleSchema,
  cabStyle: cabStyleSchema.optional(),
  bedStyle: bedStyleSchema.optional(),
  generation: z.string().optional(),
  /** Overall dimensions in millimetres; indicative catalogue data only. */
  dimensionsMm: z
    .object({ length: z.number(), width: z.number(), height: z.number(), wheelbase: z.number() })
    .optional(),
  tags: z.array(z.string()).default([]),
  thumbnail: z.string().optional(),
  description: z.string().optional(),
  attribution: attributionSchema.optional(),
  /**
   * ID of the asset manifest for this vehicle, or null when no 3D asset is
   * available. A vehicle without a manifest is browsable metadata only and
   * the UI must say so before any load attempt.
   */
  assetManifestId: z.string().nullable(),
  knownLimitations: z.array(z.string()).default([]),
});
export type Vehicle = z.infer<typeof vehicleSchema>;

// ---------------------------------------------------------------------------
// AssetManifest — how a 3D asset maps to editable components
// ---------------------------------------------------------------------------

export const assetSourceSchema = z.object({
  /** 'gltf' is the only runtime vehicle format; STL is part/reference only. */
  type: z.enum(['gltf', 'stl']),
  uri: z.string().min(1),
  sizeBytes: z.number().optional(),
  compression: z.enum(['none', 'draco', 'meshopt']).default('none'),
});

export const materialZoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  defaultColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultFinish: z.object({
    metallic: z.number().min(0).max(1),
    roughness: z.number().min(0).max(1),
    clearcoat: z.number().min(0).max(1),
  }),
  /** Paintable zones appear in the Paint & Finish tab. */
  paintable: z.boolean().default(true),
});
export type MaterialZone = z.infer<typeof materialZoneSchema>;

export const meshNodeSchema = z.object({
  /** Exact mesh/object name inside the 3D asset. */
  nodeName: z.string().min(1),
  /** Component this node belongs to (Part.id). Null = static scenery. */
  componentId: z.string().nullable(),
  materialZoneId: z.string().nullable(),
  /** Direction * distance applied in exploded view. Omit = stays in place. */
  explodeOffset: vec3Schema.optional(),
});
export type MeshNode = z.infer<typeof meshNodeSchema>;

export const wheelAnchorSchema = z.object({
  id: z.enum(['FL', 'FR', 'RL', 'RR']),
  axle: z.enum(['front', 'rear']),
  side: z.enum(['left', 'right']),
  position: vec3Schema,
  /** Largest tyre radius (m) that clears the wheel well at stock ride height. */
  wellClearanceRadiusM: z.number(),
  /** Widest tyre section (m) before fender interference at stock offset. */
  wellClearanceWidthM: z.number(),
});
export type WheelAnchor = z.infer<typeof wheelAnchorSchema>;

export const cameraPresetSchema = z.object({
  id: z.string(),
  label: z.string(),
  position: vec3Schema,
  target: vec3Schema,
});
export type CameraPreset = z.infer<typeof cameraPresetSchema>;

/**
 * A mounting point for a generated numberplate. The named baked plate meshes
 * are hidden and replaced by a canvas-textured plate carrying the build's
 * plate text; `componentId` ties visibility/selection to a catalogue part.
 */
export const plateMountSchema = z.object({
  id: z.enum(['front', 'rear']),
  componentId: z.string().min(1),
  position: vec3Schema,
  rotationDeg: vec3Schema,
  widthM: z.number().positive(),
  heightM: z.number().positive(),
  hideNodeNames: z.array(z.string()),
});
export type PlateMount = z.infer<typeof plateMountSchema>;

export const assetManifestSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().default(SCHEMA_VERSION),
  source: assetSourceSchema,
  /**
   * Optional companion asset (e.g. project-original add-on parts fitted to a
   * licensed base model). Its nodes join the same meshNodes namespace.
   */
  addonSource: assetSourceSchema.optional(),
  attribution: attributionSchema,
  /** Multiplier applied so 1 world unit == 1 metre. */
  scale: z.number().positive(),
  units: z.enum(['m', 'cm', 'mm', 'in']),
  coordinateSystem: z.enum(['y-up-z-forward', 'y-up-x-forward', 'z-up']),
  supportedFeatures: z.object({
    componentEditing: z.boolean(),
    materialZones: z.boolean(),
    explodedView: z.boolean(),
    wheelSwap: z.boolean(),
    stance: z.boolean(),
  }),
  lods: z
    .array(z.object({ level: z.number().int(), maxDistanceM: z.number(), uri: z.string() }))
    .default([]),
  meshNodes: z.array(meshNodeSchema),
  materialZones: z.array(materialZoneSchema),
  wheelAnchors: z.array(wheelAnchorSchema),
  plateMounts: z.array(plateMountSchema).default([]),
  cameraTargets: z.object({
    defaultTarget: vec3Schema,
    defaultPosition: vec3Schema,
    presets: z.array(cameraPresetSchema),
  }),
  /** Approximate collision bounds (m) used for indicative fitment warnings. */
  fitmentBounds: z.object({
    overallLengthM: z.number(),
    overallWidthM: z.number(),
    overallHeightM: z.number(),
    trackWidthFrontM: z.number(),
    trackWidthRearM: z.number(),
    stockRideHeightM: z.number(),
    minRideHeightM: z.number(),
  }),
});
export type AssetManifest = z.infer<typeof assetManifestSchema>;

// ---------------------------------------------------------------------------
// Parts and variants
// ---------------------------------------------------------------------------

export const compatibilitySchema = z.object({
  vehicleIds: z.array(z.string()).optional(),
  vehicleTypes: z.array(vehicleTypeSchema).optional(),
  bodyStyles: z.array(bodyStyleSchema).optional(),
  yearRange: z.tuple([z.number(), z.number()]).optional(),
  /** Socket the part mounts to; must exist on the target vehicle's part set. */
  requiresSocket: z.string().optional(),
});
export type Compatibility = z.infer<typeof compatibilitySchema>;

export const partSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: partCategorySchema,
  /** Mesh nodes controlled by this part (per manifest meshNodes). */
  meshNodeIds: z.array(z.string()),
  compatibility: compatibilitySchema,
  variantIds: z.array(z.string()),
  defaultVariantId: z.string().nullable(),
  materialZoneIds: z.array(z.string()).default([]),
  /** Socket this part occupies (e.g. 'socket-front-bumper'). */
  socketId: z.string().nullable(),
  removable: z.boolean(),
  defaultTransform: z
    .object({ position: vec3Schema, rotationDeg: vec3Schema, scale: vec3Schema })
    .optional(),
  provenance: z.string().default('seed-catalogue'),
});
export type Part = z.infer<typeof partSchema>;

export const wheelStyleSchema = z.enum(['steelie', 'five-spoke', 'slot-mag', 'rally', 'smoothie']);
export type WheelStyle = z.infer<typeof wheelStyleSchema>;

export const partVariantVisualSchema = z.discriminatedUnion('kind', [
  /** Chooses which of a part's alternate mesh nodes are visible. */
  z.object({ kind: z.literal('mesh-swap'), visibleNodeIds: z.array(z.string()) }),
  /** Overrides material appearance of the part's nodes. */
  z.object({
    kind: z.literal('material-override'),
    colorHex: z.string().optional(),
    metallic: z.number().optional(),
    roughness: z.number().optional(),
    useBodyColor: z.boolean().optional(),
  }),
  /** Parametric wheel built at runtime (no external asset needed). */
  z.object({
    kind: z.literal('procedural-wheel'),
    style: wheelStyleSchema,
    finish: z.enum(['chrome', 'polished', 'satin-black', 'gloss-black', 'body-color', 'steel']),
  }),
  /** External GLB visual (for future catalogue growth). */
  z.object({ kind: z.literal('gltf'), uri: z.string() }),
]);
export type PartVariantVisual = z.infer<typeof partVariantVisualSchema>;

export const partVariantSchema = z.object({
  id: z.string().min(1),
  partId: z.string().min(1),
  name: z.string().min(1),
  visual: partVariantVisualSchema,
  dimensionsMm: z.object({ x: z.number(), y: z.number(), z: z.number() }).optional(),
  compatibility: compatibilitySchema.optional(),
  thumbnail: z.string().optional(),
  priceEstimateUsd: z.number().optional(),
  transformOverride: z
    .object({ position: vec3Schema.optional(), rotationDeg: vec3Schema.optional() })
    .optional(),
  provenance: z.string().default('seed-catalogue'),
});
export type PartVariant = z.infer<typeof partVariantSchema>;

// ---------------------------------------------------------------------------
// Wheels, tyres, stance
// ---------------------------------------------------------------------------

export const tyreSetupSchema = z.object({
  type: z.enum(['radial', 'bias-ply', 'drag-slick', 'all-terrain']),
  widthMm: z.number().min(125).max(455),
  aspectPct: z.number().min(25).max(90),
  rimIn: z.number().min(13).max(22),
  whitewall: z.boolean(),
  raisedLetters: z.boolean(),
});
export type TyreSetup = z.infer<typeof tyreSetupSchema>;

export const axleSetupSchema = z.object({
  wheelVariantId: z.string(),
  wheelWidthIn: z.number().min(4).max(14),
  offsetMm: z.number().min(-75).max(60),
  spacerMm: z.number().min(0).max(50),
  tyre: tyreSetupSchema,
});
export type AxleSetup = z.infer<typeof axleSetupSchema>;

export const stanceSchema = z.object({
  /** Ride-height change vs stock, mm (negative = lowered). */
  rideHeightFrontMm: z.number().min(-150).max(150),
  rideHeightRearMm: z.number().min(-150).max(150),
  camberFrontDeg: z.number().min(-10).max(2),
  camberRearDeg: z.number().min(-10).max(2),
  /** Track-width change per side, mm. */
  trackWidthFrontMm: z.number().min(-30).max(75),
  trackWidthRearMm: z.number().min(-30).max(75),
  /** Front wheel steering angle for inspection, degrees. */
  steeringAngleDeg: z.number().min(-35).max(35),
});
export type Stance = z.infer<typeof stanceSchema>;

// ---------------------------------------------------------------------------
// Fabrication (Titanforge)
// ---------------------------------------------------------------------------

export const fabricationStatusSchema = z.enum([
  'stock',
  'modify-existing',
  'needs-3d-scan',
  'reproduce',
  'print-candidate',
  'cnc-fabricate',
  'ordered',
  'approved',
  'complete',
]);
export type FabricationStatus = z.infer<typeof fabricationStatusSchema>;

export const fabricationRecordSchema = z.object({
  componentId: z.string().min(1),
  status: fabricationStatusSchema,
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assignee: z.string().default(''),
  process: z.enum([
    'none',
    'fdm-print',
    'sla-print',
    'cnc-mill',
    'sheet-metal',
    'cast',
    'hand-fabricate',
  ]),
  proposedMaterial: z.string().default(''),
  dimensionsMm: z.object({ x: z.number(), y: z.number(), z: z.number() }).nullable(),
  toleranceMm: z.number().nullable(),
  scanRequired: z.boolean(),
  printOrientationNotes: z.string().default(''),
  quantity: z.number().int().min(1).default(1),
  estimatedCostUsd: z.number().nullable(),
  supplier: z.string().default(''),
  attachments: z.array(z.object({ name: z.string(), note: z.string().default('') })).default([]),
  notes: z.string().default(''),
  /**
   * Always false until measurements come from a calibrated scan or an
   * engineering model. Render geometry alone can never set this true.
   */
  manufacturingValidated: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FabricationRecord = z.infer<typeof fabricationRecordSchema>;

export const annotationSchema = z.object({
  id: z.string(),
  componentId: z.string().nullable(),
  /** Position on the model, local metres. */
  position: vec3Schema,
  text: z.string().max(500),
  createdAt: z.string(),
});
export type Annotation = z.infer<typeof annotationSchema>;

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export const paintZoneSettingSchema = z.object({
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  metallic: z.number().min(0).max(1),
  roughness: z.number().min(0.02).max(1),
  clearcoat: z.number().min(0).max(1),
});
export type PaintZoneSetting = z.infer<typeof paintZoneSettingSchema>;

export const installedPartSchema = z.object({
  partId: z.string(),
  variantId: z.string().nullable(),
  removed: z.boolean().default(false),
  hidden: z.boolean().default(false),
});
export type InstalledPart = z.infer<typeof installedPartSchema>;

export const plateSetupSchema = z.object({
  /** Uppercase display text; sanitised by the UI layer. */
  text: z.string().max(12),
  styleId: z.string(),
});
export type PlateSetup = z.infer<typeof plateSetupSchema>;

export const cameraStateSchema = z.object({
  position: vec3Schema,
  target: vec3Schema,
});
export type CameraState = z.infer<typeof cameraStateSchema>;

export const buildSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int(),
  name: z.string().min(1).max(120),
  vehicleId: z.string().min(1),
  installed: z.array(installedPartSchema),
  paint: z.record(z.string(), paintZoneSettingSchema),
  glassTint: z.number().min(0).max(0.85),
  wheels: z.object({
    linked: z.boolean(),
    front: axleSetupSchema,
    rear: axleSetupSchema,
  }),
  stance: stanceSchema,
  /** Defaulted so builds saved before this field existed keep loading. */
  plateSetup: plateSetupSchema.default({ text: 'NOVA 70', styleId: 'classic-black' }),
  annotations: z.array(annotationSchema),
  fabricationRecords: z.record(z.string(), fabricationRecordSchema),
  cameraState: cameraStateSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Build = z.infer<typeof buildSchema>;

/** Versioned envelope used for build export/import files. */
export const buildExportFileSchema = z.object({
  format: z.literal('vehicle-build-config/build'),
  formatVersion: z.number().int(),
  exportedAt: z.string(),
  build: buildSchema,
});
export type BuildExportFile = z.infer<typeof buildExportFileSchema>;
