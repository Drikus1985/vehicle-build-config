/**
 * Titanforge fabrication workflow.
 *
 * Records live inside the Build (so they are undoable and persist with it).
 * This module provides the status metadata, the adapter seam for a future real
 * Titanforge API, and manifest exports (JSON + CSV).
 *
 * There is NO external Titanforge API today; the only adapter is the local
 * one, and the UI says so.
 */
import type {
  AssetManifest,
  Build,
  FabricationRecord,
  FabricationStatus,
  Vehicle,
} from '@/lib/schemas';
import { getPart } from '@/lib/catalog';

export interface FabricationStatusMeta {
  id: FabricationStatus;
  label: string;
  /** Short glyph used alongside colour so state never relies on colour alone. */
  glyph: string;
  /** Outline colour used in the 3D overlay system. */
  colorHex: string;
  description: string;
}

export const FABRICATION_STATUSES: FabricationStatusMeta[] = [
  {
    id: 'stock',
    label: 'Stock',
    glyph: 'ST',
    colorHex: '#8b939e',
    description: 'Factory part, no work planned.',
  },
  {
    id: 'modify-existing',
    label: 'Modify existing',
    glyph: 'MOD',
    colorHex: '#d9a44a',
    description: 'Existing part will be altered.',
  },
  {
    id: 'needs-3d-scan',
    label: 'Needs 3D scan',
    glyph: 'SCN',
    colorHex: '#4aa8d9',
    description: 'Requires a calibrated 3D scan before work.',
  },
  {
    id: 'reproduce',
    label: 'Reproduce',
    glyph: 'RPR',
    colorHex: '#b06ad9',
    description: 'Part will be reproduced from reference.',
  },
  {
    id: 'print-candidate',
    label: '3D print candidate',
    glyph: 'PRT',
    colorHex: '#5ecb8f',
    description: 'Candidate for additive manufacture.',
  },
  {
    id: 'cnc-fabricate',
    label: 'CNC / fabricate',
    glyph: 'CNC',
    colorHex: '#e07856',
    description: 'Machined or hand-fabricated replacement.',
  },
  {
    id: 'ordered',
    label: 'Ordered',
    glyph: 'ORD',
    colorHex: '#7a8be0',
    description: 'Replacement has been ordered.',
  },
  {
    id: 'approved',
    label: 'Approved',
    glyph: 'APP',
    colorHex: '#3fbfb2',
    description: 'Plan approved, awaiting execution.',
  },
  {
    id: 'complete',
    label: 'Complete',
    glyph: 'DONE',
    colorHex: '#9ac93f',
    description: 'Work finished and fitted.',
  },
];

export function statusMeta(id: FabricationStatus): FabricationStatusMeta {
  return FABRICATION_STATUSES.find((s) => s.id === id) ?? FABRICATION_STATUSES[0]!;
}

// ---------------------------------------------------------------------------
// Adapter seam
// ---------------------------------------------------------------------------

export interface TitanforgeAdapter {
  readonly kind: 'local' | 'remote';
  readonly label: string;
  /** Push a record to the backing system. Local adapter: no-op (records persist with the build). */
  syncRecord(buildId: string, record: FabricationRecord): Promise<void>;
}

class LocalTitanforgeAdapter implements TitanforgeAdapter {
  readonly kind = 'local' as const;
  readonly label = 'Local (stored with build)';
  async syncRecord(): Promise<void> {
    // Records are part of the Build and persist through the build repository.
  }
}

/** Selected via VITE_TITANFORGE_API_URL in a future integration; local-only today. */
export const titanforgeAdapter: TitanforgeAdapter = new LocalTitanforgeAdapter();

// ---------------------------------------------------------------------------
// Manifest export
// ---------------------------------------------------------------------------

export interface TitanforgeManifestExport {
  format: 'titanforge/manifest';
  formatVersion: 1;
  exportedAt: string;
  units: 'mm';
  vehicle: { id: string; year: number; make: string; model: string; trim?: string };
  build: { id: string; name: string; version: number; updatedAt: string };
  sourceAsset: {
    uri: string | null;
    licence: string | null;
    attributionText: string | null;
    note: string;
  };
  /** Global flag: true only if EVERY item is validated (never true from display geometry). */
  manufacturingValidated: boolean;
  items: Array<
    FabricationRecord & {
      partName: string;
      category: string;
      meshNodeIds: string[];
    }
  >;
}

export function buildTitanforgeManifest(
  build: Build,
  vehicle: Vehicle,
  manifest: AssetManifest | undefined,
): TitanforgeManifestExport {
  const items = Object.values(build.fabricationRecords)
    .sort((a, b) => a.componentId.localeCompare(b.componentId))
    .map((record) => {
      const part = getPart(record.componentId);
      return {
        ...record,
        partName: part?.name ?? record.componentId,
        category: part?.category ?? 'unknown',
        meshNodeIds: part?.meshNodeIds ?? [],
      };
    });
  return {
    format: 'titanforge/manifest',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    units: 'mm',
    vehicle: {
      id: vehicle.id,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      ...(vehicle.trim ? { trim: vehicle.trim } : {}),
    },
    build: {
      id: build.id,
      name: build.name,
      version: build.schemaVersion,
      updatedAt: build.updatedAt,
    },
    sourceAsset: {
      uri: manifest?.source.uri ?? null,
      licence: manifest?.attribution.licence ?? null,
      attributionText: manifest?.attribution.attributionText ?? null,
      note: 'Dimensions derive from display geometry and are NOT manufacturing-validated. Validate against a calibrated scan or engineering model before production.',
    },
    manufacturingValidated: items.length > 0 && items.every((i) => i.manufacturingValidated),
    items,
  };
}

/** CSV export. Values are quoted and formula-injection-prefixed where needed. */
export function titanforgeManifestToCsv(manifest: TitanforgeManifestExport): string {
  const headers = [
    'componentId',
    'partName',
    'category',
    'status',
    'priority',
    'process',
    'proposedMaterial',
    'dimX_mm',
    'dimY_mm',
    'dimZ_mm',
    'tolerance_mm',
    'scanRequired',
    'quantity',
    'estimatedCostUsd',
    'supplier',
    'assignee',
    'printOrientationNotes',
    'notes',
    'manufacturingValidated',
    'updatedAt',
  ];
  const escape = (value: unknown): string => {
    let s = value === null || value === undefined ? '' : String(value);
    // Guard against spreadsheet formula injection.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n]/.test(s)) s = `"${s.replaceAll('"', '""')}"`;
    return s;
  };
  const rows = manifest.items.map((i) =>
    [
      i.componentId,
      i.partName,
      i.category,
      i.status,
      i.priority,
      i.process,
      i.proposedMaterial,
      i.dimensionsMm?.x ?? '',
      i.dimensionsMm?.y ?? '',
      i.dimensionsMm?.z ?? '',
      i.toleranceMm ?? '',
      i.scanRequired,
      i.quantity,
      i.estimatedCostUsd ?? '',
      i.supplier,
      i.assignee,
      i.printOrientationNotes,
      i.notes,
      i.manufacturingValidated,
      i.updatedAt,
    ]
      .map(escape)
      .join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}
