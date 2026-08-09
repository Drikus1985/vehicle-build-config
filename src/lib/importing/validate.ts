/**
 * Import validation. Never trusts the file extension or declared MIME type:
 * file signatures are checked byte-for-byte, sizes are capped, and glTF/STL
 * structure is sanity-checked before anything reaches the asset library.
 */

export type ImportKind = 'image' | 'gltf' | 'stl';

export interface ValidationOk {
  ok: true;
  kind: ImportKind;
  mime: string;
  detail: string;
}

export interface ValidationError {
  ok: false;
  reason: string;
  /** Actionable suggestion shown to the user. */
  hint: string;
}

export type ValidationResult = ValidationOk | ValidationError;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_MODEL_BYTES = 60 * 1024 * 1024;

export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return (
    base
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f<>:"|?*]/g, '')
      .replace(/^\.+/, '')
      .slice(0, 120) || 'file'
  );
}

/** Blob.arrayBuffer with a FileReader fallback (older engines, jsdom). */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export async function validateImportFile(file: File): Promise<ValidationResult> {
  if (file.size === 0) {
    return { ok: false, reason: 'The file is empty.', hint: 'Choose a non-empty file.' };
  }
  const head = new Uint8Array(await blobToArrayBuffer(file.slice(0, 512)));

  // --- Images ---------------------------------------------------------------
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return checkImageSize(file, 'image/png', 'PNG image');
  }
  if (startsWith(head, [0xff, 0xd8, 0xff])) {
    return checkImageSize(file, 'image/jpeg', 'JPEG image');
  }
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') {
    return checkImageSize(file, 'image/webp', 'WebP image');
  }

  // --- GLB ------------------------------------------------------------------
  if (ascii(head, 0, 4) === 'glTF') {
    if (file.size > MAX_MODEL_BYTES) return tooLarge(file, MAX_MODEL_BYTES);
    const view = new DataView(head.buffer);
    const version = view.getUint32(4, true);
    if (version !== 2) {
      return {
        ok: false,
        reason: `Unsupported GLB version ${version}.`,
        hint: 'Re-export the model as glTF 2.0 binary (.glb).',
      };
    }
    const declaredLength = view.getUint32(8, true);
    if (declaredLength !== file.size) {
      return {
        ok: false,
        reason: 'GLB header length does not match the file size (truncated or corrupt).',
        hint: 'Re-export or re-download the file and try again.',
      };
    }
    return { ok: true, kind: 'gltf', mime: 'model/gltf-binary', detail: 'glTF 2.0 binary' };
  }

  // --- glTF JSON ------------------------------------------------------------
  const textStart = ascii(head, 0, head.length).trimStart();
  if (textStart.startsWith('{')) {
    if (file.size > MAX_MODEL_BYTES) return tooLarge(file, MAX_MODEL_BYTES);
    try {
      const json: unknown = JSON.parse(new TextDecoder().decode(await blobToArrayBuffer(file)));
      const asset = (json as { asset?: { version?: string } }).asset;
      if (asset?.version?.startsWith('2')) {
        return { ok: true, kind: 'gltf', mime: 'model/gltf+json', detail: 'glTF 2.0 JSON' };
      }
      return {
        ok: false,
        reason: 'JSON file is not a glTF 2.0 document.',
        hint: 'Only glTF 2.0 (.gltf / .glb) is supported for runtime 3D.',
      };
    } catch {
      return {
        ok: false,
        reason: 'File looks like JSON but could not be parsed.',
        hint: 'Check the file is a valid .gltf export.',
      };
    }
  }

  // --- STL ------------------------------------------------------------------
  if (textStart.toLowerCase().startsWith('solid')) {
    if (file.size > MAX_MODEL_BYTES) return tooLarge(file, MAX_MODEL_BYTES);
    return {
      ok: true,
      kind: 'stl',
      mime: 'model/stl',
      detail: 'ASCII STL (reference/inspection only)',
    };
  }
  if (file.size >= 84) {
    const view = new DataView(await blobToArrayBuffer(file.slice(80, 84)));
    const triCount = view.getUint32(0, true);
    if (84 + triCount * 50 === file.size) {
      if (file.size > MAX_MODEL_BYTES) return tooLarge(file, MAX_MODEL_BYTES);
      if (triCount > 2_000_000) {
        return {
          ok: false,
          reason: `STL has ${triCount.toLocaleString()} triangles (limit 2,000,000).`,
          hint: 'Decimate the mesh before importing.',
        };
      }
      return {
        ok: true,
        kind: 'stl',
        mime: 'model/stl',
        detail: `Binary STL, ${triCount.toLocaleString()} triangles (reference/inspection only)`,
      };
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext && ['obj', 'fbx', '3mf', 'stp', 'step', 'iges'].includes(ext)) {
    return {
      ok: false,
      reason: `.${ext} is not supported for direct import.`,
      hint: 'Convert to glTF 2.0 (.glb) with Blender or a converter pipeline, then import.',
    };
  }
  return {
    ok: false,
    reason: 'Unrecognised or unsupported file type (signature check failed).',
    hint: 'Supported: PNG/JPEG/WebP reference images, glTF 2.0 (.glb/.gltf), STL.',
  };
}

function checkImageSize(file: File, mime: string, detail: string): ValidationResult {
  if (file.size > MAX_IMAGE_BYTES) return tooLarge(file, MAX_IMAGE_BYTES);
  return { ok: true, kind: 'image', mime, detail };
}

function tooLarge(file: File, limit: number): ValidationError {
  return {
    ok: false,
    reason: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${Math.round(limit / 1024 / 1024)} MB.`,
    hint: 'Compress or decimate the asset and try again.',
  };
}
