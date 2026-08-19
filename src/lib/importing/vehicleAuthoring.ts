/**
 * Manifest authoring for imported GLBs: turns an imported asset plus a
 * user-confirmed node→zone mapping into a full catalogue bundle (vehicle +
 * asset manifest + one removable part per node). Cameras, dimensions, scale
 * and grounding are derived from the model's geometry; everything derived is
 * labelled as such on the vehicle entry.
 */
import type {
  AssetManifest,
  BodyStyle,
  MaterialZone,
  Part,
  PartCategory,
  Vehicle,
  VehicleType,
} from '@/lib/schemas';
import type { ImportedAsset, UserVehicleBundle } from '@/lib/persistence/repositories';
import { newId } from '@/lib/build/defaults';

/** Zone id meaning "keep the asset's original materials" (maps to null). */
export const KEEP_ORIGINAL = 'keep';

/** Standard zone template offered for user-authored vehicles. */
export const USER_ZONES: MaterialZone[] = [
  {
    id: 'body',
    label: 'Body',
    defaultColorHex: '#8a1f1f',
    defaultFinish: { metallic: 0.15, roughness: 0.4, clearcoat: 0.7 },
    paintable: true,
  },
  {
    id: 'trim',
    label: 'Trim',
    defaultColorHex: '#c9cdd3',
    defaultFinish: { metallic: 1, roughness: 0.12, clearcoat: 0 },
    paintable: true,
  },
  {
    id: 'interior',
    label: 'Interior',
    defaultColorHex: '#6b5f52',
    defaultFinish: { metallic: 0, roughness: 0.7, clearcoat: 0 },
    paintable: true,
  },
  {
    id: 'glass',
    label: 'Glass',
    defaultColorHex: '#dfe9e7',
    defaultFinish: { metallic: 0, roughness: 0.02, clearcoat: 0 },
    paintable: false,
  },
  {
    id: 'chrome',
    label: 'Chrome',
    defaultColorHex: '#8a8a8a',
    defaultFinish: { metallic: 1, roughness: 0.1, clearcoat: 0 },
    paintable: false,
  },
  {
    id: 'trim-black',
    label: 'Black trim',
    defaultColorHex: '#111214',
    defaultFinish: { metallic: 0, roughness: 0.55, clearcoat: 0 },
    paintable: false,
  },
  {
    id: 'steel',
    label: 'Bare metal',
    defaultColorHex: '#d5d5d5',
    defaultFinish: { metallic: 0.8, roughness: 0.4, clearcoat: 0 },
    paintable: false,
  },
  {
    id: 'rubber',
    label: 'Rubber',
    defaultColorHex: '#141414',
    defaultFinish: { metallic: 0, roughness: 0.85, clearcoat: 0 },
    paintable: false,
  },
];

const ZONE_GUESSES: [RegExp, string][] = [
  [/glass|window|windshield|windscreen|lens/i, 'glass'],
  [/tire|tyre|rubber/i, 'rubber'],
  [/wheel|rim|hub|spoke/i, 'steel'],
  [/chrome|bumper|grill|mirror|badge|emblem|logo/i, 'chrome'],
  [/seat|interior|dash|cabin|carpet|steering|console/i, 'interior'],
  [/trim|molding|moulding|brightwork/i, 'trim'],
  [/plastic|black|wiper|gasket|seal/i, 'trim-black'],
  [/exhaust|pipe|chassis|frame|under|suspension|axle|engine|brake/i, 'steel'],
];

/** Best-guess material zone for a mesh node, from its name. */
export function guessZoneForNode(nodeName: string): string {
  for (const [pattern, zoneId] of ZONE_GUESSES) {
    if (pattern.test(nodeName)) return zoneId;
  }
  return 'body';
}

const CATEGORY_GUESSES: [RegExp, PartCategory][] = [
  [/glass|window|windshield/i, 'glass'],
  [/wheel|tire|tyre|rim/i, 'wheel'],
  [/bumper/i, 'bumper'],
  [/grill/i, 'grille'],
  [/light|lamp|lens/i, 'lights'],
  [/mirror/i, 'mirror'],
  [/door/i, 'door'],
  [/hood|bonnet/i, 'hood'],
  [/roof/i, 'roof'],
  [/fender|wing/i, 'fender'],
  [/seat|interior|dash/i, 'interior'],
  [/exhaust|pipe/i, 'exhaust'],
  [/trim|molding|moulding/i, 'trim'],
];

function guessCategory(nodeName: string): PartCategory {
  for (const [pattern, category] of CATEGORY_GUESSES) {
    if (pattern.test(nodeName)) return category;
  }
  return 'body-panel';
}

/**
 * Unit inference from the model's largest bounding-box dimension: metre-scale
 * models pass through; cm/mm-scale models get 0.01/0.001; anything else is
 * fitted to a typical vehicle length.
 */
export function inferScale(maxDimension: number): number {
  if (maxDimension >= 2 && maxDimension <= 10) return 1;
  if (maxDimension >= 200 && maxDimension <= 1000) return 0.01;
  if (maxDimension >= 2000 && maxDimension <= 10000) return 0.001;
  return maxDimension > 0 ? 4.8 / maxDimension : 1;
}

export interface AuthoringNode {
  name: string;
  /** A `USER_ZONES` id, or KEEP_ORIGINAL to keep the asset's materials. */
  zoneId: string;
}

export interface AuthoringInput {
  asset: Pick<ImportedAsset, 'id' | 'name' | 'attribution'>;
  meta: {
    year: number;
    make: string;
    model: string;
    trim?: string;
    vehicleType: VehicleType;
    bodyStyle: BodyStyle;
  };
  nodes: AuthoringNode[];
  /** World bbox of the loaded scene at raw (unscaled) model units. */
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'node'
  );
}

export function buildUserVehicleBundle(input: AuthoringInput): UserVehicleBundle {
  const suffix = newId('user').slice('user-'.length, 'user-'.length + 8);
  const vehicleId = `veh-user-${suffix}`;
  const manifestId = `manifest-user-${suffix}`;

  const size = input.bboxMax.map((v, i) => v - input.bboxMin[i]!) as [number, number, number];
  const scale = inferScale(Math.max(...size));
  const scaled = size.map((v) => v * scale) as [number, number, number];
  const centre = input.bboxMin.map((v, i) => ((v + input.bboxMax[i]!) / 2) * scale) as [
    number,
    number,
    number,
  ];
  // Centre the model at the origin and sit it on the ground plane.
  const rootOffset: [number, number, number] = [-centre[0], -input.bboxMin[1]! * scale, -centre[2]];
  const [sx, sy, sz] = scaled;
  const lengthM = Math.max(sx, sz);
  const widthM = Math.min(sx, sz);
  const heightM = sy;
  const midY = heightM * 0.45;
  const dist = Math.max(lengthM, heightM * 2.4) * 1.35;

  // One removable part per named node; ids stay unique even when node names
  // slugify identically.
  const usedIds = new Set<string>();
  const parts: Part[] = [];
  const meshNodes: AssetManifest['meshNodes'] = [];
  for (const node of input.nodes) {
    let partId = `part-${vehicleId}-${slug(node.name)}`;
    let n = 2;
    while (usedIds.has(partId)) partId = `part-${vehicleId}-${slug(node.name)}-${n++}`;
    usedIds.add(partId);
    parts.push({
      id: partId,
      name: node.name,
      category: guessCategory(node.name),
      meshNodeIds: [node.name],
      compatibility: { vehicleIds: [vehicleId] },
      variantIds: [],
      defaultVariantId: null,
      materialZoneIds: node.zoneId === KEEP_ORIGINAL ? [] : [node.zoneId],
      socketId: null,
      removable: true,
      provenance: 'user-authored',
    });
    meshNodes.push({
      nodeName: node.name,
      componentId: partId,
      materialZoneId: node.zoneId === KEEP_ORIGINAL ? null : node.zoneId,
    });
  }

  const manifest: AssetManifest = {
    id: manifestId,
    schemaVersion: 1,
    source: { type: 'gltf', uri: `asset:${input.asset.id}`, compression: 'none' },
    attribution: { ...input.asset.attribution },
    scale,
    rootOffset,
    units: 'm',
    coordinateSystem: 'y-up-z-forward',
    supportedFeatures: {
      componentEditing: true,
      materialZones: true,
      explodedView: false,
      wheelSwap: false,
      stance: false,
    },
    lods: [],
    meshNodes,
    materialZones: USER_ZONES,
    wheelAnchors: [],
    plateMounts: [],
    stripeZones: [],
    liveryZones: [],
    liveryAnchors: [],
    liveryPanels: [],
    cameraTargets: {
      defaultTarget: [0, midY, 0],
      defaultPosition: [dist * 0.75, heightM * 1.2, dist * 0.85],
      presets: [
        {
          id: 'front',
          label: 'Front',
          position: [0, midY + heightM * 0.2, dist],
          target: [0, midY, 0],
        },
        {
          id: 'rear',
          label: 'Rear',
          position: [0, midY + heightM * 0.2, -dist],
          target: [0, midY, 0],
        },
        {
          id: 'left',
          label: 'Left',
          position: [dist, midY + heightM * 0.15, 0],
          target: [0, midY, 0],
        },
        {
          id: 'right',
          label: 'Right',
          position: [-dist, midY + heightM * 0.15, 0],
          target: [0, midY, 0],
        },
        {
          id: 'three-quarter',
          label: '3/4 Front',
          position: [dist * 0.75, heightM * 1.2, dist * 0.85],
          target: [0, midY, 0],
        },
        {
          id: 'three-quarter-rear',
          label: '3/4 Rear',
          position: [-dist * 0.75, heightM * 1.2, -dist * 0.85],
          target: [0, midY, 0],
        },
        { id: 'top', label: 'Top', position: [0, dist * 1.4, 0.01], target: [0, midY * 0.8, 0] },
        {
          id: 'detail-front-wheel',
          label: 'Front wheel',
          position: [widthM, heightM * 0.35, lengthM * 0.55],
          target: [widthM * 0.45, heightM * 0.25, lengthM * 0.3],
        },
        {
          id: 'detail-grille',
          label: 'Front detail',
          position: [widthM * 0.6, midY, lengthM * 0.75],
          target: [0, midY * 0.9, lengthM * 0.45],
        },
      ],
    },
    fitmentBounds: {
      overallLengthM: Number(lengthM.toFixed(3)),
      overallWidthM: Number(widthM.toFixed(3)),
      overallHeightM: Number(heightM.toFixed(3)),
      trackWidthFrontM: Number((widthM * 0.84).toFixed(3)),
      trackWidthRearM: Number((widthM * 0.84).toFixed(3)),
      stockRideHeightM: 0,
      minRideHeightM: -0.05,
    },
  };

  const vehicle: Vehicle = {
    id: vehicleId,
    year: input.meta.year,
    make: input.meta.make,
    model: input.meta.model,
    trim: input.meta.trim || undefined,
    vehicleType: input.meta.vehicleType,
    bodyStyle: input.meta.bodyStyle,
    dimensionsMm: {
      length: Math.round(lengthM * 1000),
      width: Math.round(widthM * 1000),
      height: Math.round(heightM * 1000),
      wheelbase: Math.round(lengthM * 1000 * 0.58),
    },
    tags: ['user-import'],
    description: `Mapped in-app from the imported asset "${input.asset.name}" (${input.nodes.length} mesh nodes).`,
    attribution: { ...input.asset.attribution },
    assetManifestId: manifestId,
    knownLimitations: [
      'User-imported asset mapped in-app — dimensions, cameras and grounding are derived from the model geometry, not measured data.',
      'No wheel anchors: parametric wheels, tyres and stance are unavailable for this vehicle.',
      'Stripes, liveries, plates and exploded view are not configured for user-mapped assets.',
      'Deleting the underlying imported asset from the library breaks this vehicle.',
    ],
  };

  return { vehicle, manifest, parts };
}
