import { describe, expect, test } from 'bun:test';
import { inspectNormalizedWebp, jpegContainsExifGps } from '../../../src/modules/profiles/infrastructure/media/cloudinary-profile-media-smoke-support';

function riff(chunks: readonly { type: string; data: Uint8Array }[]): Uint8Array {
  const payloadSize = chunks.reduce((total, chunk) => total + 8 + chunk.data.length + (chunk.data.length % 2), 4);
  const bytes = new Uint8Array(8 + payloadSize);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, payloadSize, true);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  let offset = 12;
  for (const chunk of chunks) {
    bytes.set(new TextEncoder().encode(chunk.type), offset);
    view.setUint32(offset + 4, chunk.data.length, true);
    bytes.set(chunk.data, offset + 8);
    offset += 8 + chunk.data.length + (chunk.data.length % 2);
  }
  return bytes;
}

describe('Cloudinary profile media smoke helpers', () => {
  test('reads a normalized VP8X WebP and reports forbidden metadata chunks', () => {
    const vp8x = new Uint8Array(10);
    vp8x.set([0xff, 0x01, 0x00], 4);
    vp8x.set([0xff, 0x01, 0x00], 7);
    expect(inspectNormalizedWebp(riff([{ type: 'VP8X', data: vp8x }]))).toEqual({ width: 512, height: 512, metadataChunks: [], animated: false });
    expect(inspectNormalizedWebp(riff([{ type: 'VP8X', data: vp8x }, { type: 'EXIF', data: new Uint8Array([1]) }])).metadataChunks).toEqual(['EXIF']);
    expect(inspectNormalizedWebp(riff([{ type: 'VP8X', data: vp8x }, { type: 'ANIM', data: new Uint8Array(6) }])).animated).toBeTrue();
  });

  test('rejects a fixture without JPEG EXIF GPS metadata', () => {
    expect(jpegContainsExifGps(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeFalse();
  });
});
