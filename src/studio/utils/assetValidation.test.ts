import { describe, expect, it } from 'vitest';
import { validateGlb } from './assetValidation';

function glb(meta: object) {
  const text = new TextEncoder().encode(JSON.stringify(meta));
  const length = Math.ceil(text.length / 4) * 4;
  const buffer = new ArrayBuffer(20 + length);
  const view = new DataView(buffer);
  [0x46546c67, 2, buffer.byteLength, length, 0x4e4f534a].forEach((v, i) => view.setUint32(i * 4, v, true));
  new Uint8Array(buffer, 20).fill(32);
  new Uint8Array(buffer, 20).set(text);
  return buffer;
}

describe('self-contained model import', () => {
  it('reads animation names from a valid GLB', () => expect(validateGlb(glb({ animations: [{ name: 'Walking' }] }))).toEqual(['Walking']));
  it('rejects external resources', () => expect(() => validateGlb(glb({ images: [{ uri: 'https://example.com/image.png' }] }))).toThrow('internamente'));
  it('rejects unsupported decoder requirements', () => expect(() => validateGlb(glb({ extensionsRequired: ['KHR_draco_mesh_compression'] }))).toThrow('compressão'));
  it('rejects non-GLB files', () => expect(() => validateGlb(new ArrayBuffer(30))).toThrow('válido'));
});