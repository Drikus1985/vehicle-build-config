/**
 * High-level, history-tracked build mutations used by the UI. All go through
 * buildStore.update so every build-changing action is undoable.
 */
import { getPart, getVariantsForPart } from '@/lib/catalog';
import { STANCE_PRESETS } from '@/lib/build/defaults';
import type {
  Annotation,
  AxleSetup,
  FabricationRecord,
  FabricationStatus,
  LiverySetup,
  PaintZoneSetting,
  PlateSetup,
  Stance,
  StripeSetup,
} from '@/lib/schemas';
import { sanitizePlateText } from '@/lib/plates';
import { sanitizeLetteringText, sanitizeRoundelNumber } from '@/lib/livery';
import { useBuildStore } from './buildStore';

const update = (...args: Parameters<ReturnType<typeof useBuildStore.getState>['update']>) =>
  useBuildStore.getState().update(...args);

// --- Components -------------------------------------------------------------

export function setPartRemoved(partId: string, removed: boolean): void {
  const part = getPart(partId);
  if (!part || (!part.removable && removed)) return;
  update((draft) => {
    const entry = draft.installed.find((p) => p.partId === partId);
    if (entry) {
      entry.removed = removed;
      if (removed) entry.hidden = false;
      if (!removed && entry.variantId === null && part.variantIds.length > 0) {
        entry.variantId = part.defaultVariantId ?? part.variantIds[0] ?? null;
      }
    } else if (!removed) {
      draft.installed.push({
        partId,
        variantId: part.defaultVariantId ?? part.variantIds[0] ?? null,
        removed: false,
        hidden: false,
      });
    }
  });
}

export function setPartHidden(partId: string, hidden: boolean): void {
  update((draft) => {
    const entry = draft.installed.find((p) => p.partId === partId);
    if (entry) entry.hidden = hidden;
  });
}

export function setPartVariant(partId: string, variantId: string): void {
  const valid = getVariantsForPart(partId).some((v) => v.id === variantId);
  if (!valid) return;
  update((draft) => {
    const entry = draft.installed.find((p) => p.partId === partId);
    if (entry) {
      entry.variantId = variantId;
      entry.removed = false;
    } else {
      draft.installed.push({ partId, variantId, removed: false, hidden: false });
    }
  });
}

export function restoreAllParts(): void {
  update((draft) => {
    for (const entry of draft.installed) {
      const part = getPart(entry.partId);
      entry.hidden = false;
      // Restore removals only for parts installed on the stock build.
      if (part && !(part.variantIds.length > 0 && part.defaultVariantId === null)) {
        entry.removed = false;
      }
    }
  });
}

// --- Paint ------------------------------------------------------------------

export function setPaintZone(zoneId: string, setting: Partial<PaintZoneSetting>): void {
  update((draft) => {
    const current = draft.paint[zoneId];
    if (!current) return;
    draft.paint[zoneId] = { ...current, ...setting };
  });
}

export function setGlassTint(tint: number): void {
  update((draft) => {
    draft.glassTint = Math.min(0.85, Math.max(0, tint));
  });
}

export function resetPaintToStock(): void {
  const stock = useBuildStore.getState().stockBuild;
  if (!stock) return;
  update((draft) => {
    draft.paint = structuredClone(stock.paint);
    draft.glassTint = stock.glassTint;
  });
}

// --- Wheels & stance --------------------------------------------------------

export function setAxleSetup(axle: 'front' | 'rear' | 'both', patch: Partial<AxleSetup>): void {
  update((draft) => {
    const apply = (target: AxleSetup) => {
      Object.assign(target, patch, patch.tyre ? { tyre: { ...target.tyre, ...patch.tyre } } : {});
    };
    if (axle === 'both' || draft.wheels.linked) {
      apply(draft.wheels.front);
      apply(draft.wheels.rear);
    } else if (axle === 'front') {
      apply(draft.wheels.front);
    } else {
      apply(draft.wheels.rear);
    }
  });
}

export function setTyre(axle: 'front' | 'rear', patch: Partial<AxleSetup['tyre']>): void {
  update((draft) => {
    const targets = draft.wheels.linked
      ? [draft.wheels.front, draft.wheels.rear]
      : axle === 'front'
        ? [draft.wheels.front]
        : [draft.wheels.rear];
    for (const t of targets) t.tyre = { ...t.tyre, ...patch };
  });
}

export function setWheelsLinked(linked: boolean): void {
  update((draft) => {
    draft.wheels.linked = linked;
    if (linked) draft.wheels.rear = structuredClone(draft.wheels.front);
  });
}

export function setStance(patch: Partial<Stance>): void {
  update((draft) => {
    draft.stance = { ...draft.stance, ...patch };
  });
}

export function applyStancePreset(presetId: string): void {
  const preset = STANCE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  update((draft) => {
    draft.stance = structuredClone(preset.stance);
    const applyAxle = (target: AxleSetup, patch: typeof preset.front) => {
      const { tyre, ...rest } = patch;
      Object.assign(target, rest);
      if (tyre) target.tyre = { ...tyre };
    };
    applyAxle(draft.wheels.front, preset.front);
    applyAxle(draft.wheels.rear, preset.rear);
    draft.wheels.linked = JSON.stringify(draft.wheels.front) === JSON.stringify(draft.wheels.rear);
  });
}

// --- Titanforge -------------------------------------------------------------

export function createFabricationRecord(componentId: string): FabricationRecord {
  const now = new Date().toISOString();
  return {
    componentId,
    status: 'stock',
    priority: 'medium',
    assignee: '',
    process: 'none',
    proposedMaterial: '',
    dimensionsMm: null,
    toleranceMm: null,
    scanRequired: false,
    printOrientationNotes: '',
    quantity: 1,
    estimatedCostUsd: null,
    supplier: '',
    attachments: [],
    notes: '',
    manufacturingValidated: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function upsertFabricationRecord(
  componentId: string,
  patch: Partial<Omit<FabricationRecord, 'componentId' | 'createdAt' | 'manufacturingValidated'>>,
): void {
  update((draft) => {
    const existing = draft.fabricationRecords[componentId] ?? createFabricationRecord(componentId);
    draft.fabricationRecords[componentId] = {
      ...existing,
      ...patch,
      componentId,
      // Display geometry can never make a record manufacturing-validated.
      manufacturingValidated: false,
      updatedAt: new Date().toISOString(),
    };
  });
}

export function setFabricationStatus(componentId: string, status: FabricationStatus): void {
  upsertFabricationRecord(componentId, { status });
}

export function removeFabricationRecord(componentId: string): void {
  update((draft) => {
    delete draft.fabricationRecords[componentId];
  });
}

// --- Numberplates -----------------------------------------------------------

export function setPlateSetup(patch: Partial<PlateSetup>): void {
  update((draft) => {
    draft.plateSetup = {
      ...draft.plateSetup,
      ...patch,
      ...(patch.text !== undefined ? { text: sanitizePlateText(patch.text) } : {}),
    };
  });
}

// --- Racing stripes ---------------------------------------------------------

export function setStripes(patch: Partial<StripeSetup>): void {
  update((draft) => {
    draft.stripes = { ...draft.stripes, ...patch };
  });
}

// --- Livery -----------------------------------------------------------------

export interface LiveryPatch {
  roundels?: Partial<LiverySetup['roundels']>;
  lettering?: Partial<LiverySetup['lettering']>;
}

export function setLivery(patch: LiveryPatch): void {
  update((draft) => {
    if (patch.roundels) {
      draft.livery.roundels = {
        ...draft.livery.roundels,
        ...patch.roundels,
        ...(patch.roundels.number !== undefined
          ? { number: sanitizeRoundelNumber(patch.roundels.number) }
          : {}),
      };
    }
    if (patch.lettering) {
      draft.livery.lettering = {
        ...draft.livery.lettering,
        ...patch.lettering,
        ...(patch.lettering.text !== undefined
          ? { text: sanitizeLetteringText(patch.lettering.text) }
          : {}),
      };
    }
  });
}

/** Toggle one livery anchor id on a roundel/lettering anchor list. */
export function toggleLiveryAnchor(kind: 'roundels' | 'lettering', anchorId: string): void {
  update((draft) => {
    const list = draft.livery[kind].anchorIds;
    draft.livery[kind].anchorIds = list.includes(anchorId)
      ? list.filter((id) => id !== anchorId)
      : [...list, anchorId];
  });
}

// --- Annotations ------------------------------------------------------------

export function addAnnotation(annotation: Annotation): void {
  update((draft) => {
    draft.annotations.push(annotation);
  });
}

export function updateAnnotationText(id: string, text: string): void {
  update((draft) => {
    const a = draft.annotations.find((x) => x.id === id);
    if (a) a.text = text.slice(0, 500);
  });
}

export function removeAnnotation(id: string): void {
  update((draft) => {
    draft.annotations = draft.annotations.filter((x) => x.id !== id);
  });
}

// --- Misc -------------------------------------------------------------------

export function renameBuild(name: string): void {
  // eslint-disable-next-line no-control-regex
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120);
  if (!clean.trim()) return;
  update((draft) => {
    draft.name = clean;
  });
}

export function setCameraState(
  position: [number, number, number],
  target: [number, number, number],
): void {
  update(
    (draft) => {
      draft.cameraState = { position, target };
    },
    { history: false },
  );
}
