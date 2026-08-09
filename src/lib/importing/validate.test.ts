import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, sanitizeFilename, validateImportFile } from './validate';

function fileOf(bytes: number[] | Uint8Array | string, name: string, pad = 0): File {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
  const parts: BlobPart[] = [data.slice().buffer as ArrayBuffer];
  if (pad > 0) parts.push(new Uint8Array(pad).slice().buffer as ArrayBuffer);
  return new File(parts, name);
}

describe('validateImportFile', () => {
  it('accepts a PNG by signature', async () => {
    const result = await validateImportFile(
      fileOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0], 'photo.png'),
    );
    expect(result.ok && result.kind === 'image' && result.mime === 'image/png').toBe(true);
  });

  it('rejects an empty file', async () => {
    const result = await validateImportFile(new File([], 'empty.png'));
    expect(result.ok).toBe(false);
  });

  it('rejects a renamed non-image regardless of extension', async () => {
    const result = await validateImportFile(fileOf('this is not an image', 'fake.png'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/signature/i);
  });

  it('rejects oversized images with an actionable message', async () => {
    const result = await validateImportFile(
      fileOf([0xff, 0xd8, 0xff, 0xe0], 'huge.jpg', MAX_IMAGE_BYTES + 10),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/limit/);
  });

  it('accepts a well-formed GLB header and rejects a truncated one', async () => {
    const makeGlb = (declaredLength: number, actual: number) => {
      const buffer = new ArrayBuffer(actual);
      const view = new DataView(buffer);
      new Uint8Array(buffer).set([0x67, 0x6c, 0x54, 0x46]); // 'glTF'
      view.setUint32(4, 2, true);
      view.setUint32(8, declaredLength, true);
      return new File([buffer], 'model.glb');
    };
    const good = await validateImportFile(makeGlb(64, 64));
    expect(good.ok && good.kind === 'gltf').toBe(true);
    const bad = await validateImportFile(makeGlb(9999, 64));
    expect(bad.ok).toBe(false);
  });

  it('rejects GLB version 1', async () => {
    const buffer = new ArrayBuffer(32);
    const view = new DataView(buffer);
    new Uint8Array(buffer).set([0x67, 0x6c, 0x54, 0x46]);
    view.setUint32(4, 1, true);
    view.setUint32(8, 32, true);
    const result = await validateImportFile(new File([buffer], 'old.glb'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/version/i);
  });

  it('accepts glTF JSON and rejects arbitrary JSON', async () => {
    const good = await validateImportFile(fileOf('{"asset":{"version":"2.0"}}', 'scene.gltf'));
    expect(good.ok && good.kind === 'gltf').toBe(true);
    const bad = await validateImportFile(fileOf('{"hello":"world"}', 'notgltf.gltf'));
    expect(bad.ok).toBe(false);
  });

  it('accepts binary STL with a consistent triangle count', async () => {
    const tris = 10;
    const buffer = new ArrayBuffer(84 + tris * 50);
    new DataView(buffer).setUint32(80, tris, true);
    const result = await validateImportFile(new File([buffer], 'part.stl'));
    expect(result.ok && result.kind === 'stl').toBe(true);
  });

  it('accepts ASCII STL', async () => {
    const result = await validateImportFile(fileOf('solid part\nendsolid part\n', 'part.stl'));
    expect(result.ok && result.kind === 'stl').toBe(true);
  });

  it('rejects OBJ/FBX with a conversion hint', async () => {
    const result = await validateImportFile(fileOf('v 0 0 0\nv 1 0 0\n', 'part.obj'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.hint).toMatch(/glTF/);
  });
});

describe('sanitizeFilename', () => {
  it('strips paths, control chars and unsafe characters', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\dir\\my<file>.png')).toBe('myfile.png');
    expect(sanitizeFilename('a\u0000b\u001fc.glb')).toBe('abc.glb');
    expect(sanitizeFilename('...hidden')).toBe('hidden');
    expect(sanitizeFilename('')).toBe('file');
  });
});
