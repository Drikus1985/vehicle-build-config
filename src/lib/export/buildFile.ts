import { getVehicle } from '@/lib/catalog';
import { buildExportFileSchema, type Build, type BuildExportFile } from '@/lib/schemas';

export const BUILD_FILE_VERSION = 1;

export function serializeBuild(build: Build): string {
  const file: BuildExportFile = {
    format: 'vehicle-build-config/build',
    formatVersion: BUILD_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    build,
  };
  return JSON.stringify(file, null, 2);
}

export type BuildImportResult = { ok: true; build: Build } | { ok: false; reason: string };

export function parseBuildFile(text: string): BuildImportResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'Not valid JSON.' };
  }
  const parsed = buildExportFileSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      reason:
        `Not a valid build file: ${first?.path.join('.') ?? ''} ${first?.message ?? ''}`.trim(),
    };
  }
  if (parsed.data.formatVersion > BUILD_FILE_VERSION) {
    return {
      ok: false,
      reason: `Build file version ${parsed.data.formatVersion} is newer than this app supports.`,
    };
  }
  const vehicle = getVehicle(parsed.data.build.vehicleId);
  if (!vehicle) {
    return {
      ok: false,
      reason: `Unknown vehicle "${parsed.data.build.vehicleId}" — the catalogue does not contain it.`,
    };
  }
  return { ok: true, build: parsed.data.build };
}

/** Trigger a browser download for text or blob content. */
export function downloadFile(
  filename: string,
  content: string | Blob,
  mime = 'application/json',
): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
