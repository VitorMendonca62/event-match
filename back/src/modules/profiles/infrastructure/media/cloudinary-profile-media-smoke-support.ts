function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

export function inspectNormalizedWebp(bytes: Uint8Array): {
  width: number;
  height: number;
  metadataChunks: readonly string[];
  animated: boolean;
} {
  const ascii = (offset: number, length: number) => new TextDecoder('ascii').decode(bytes.subarray(offset, offset + length));
  if (bytes.length < 20 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') throw new Error('Cloudinary variant is not a WebP image.');
  let width = 0;
  let height = 0;
  const metadataChunks: string[] = [];
  let animated = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const chunk = ascii(offset, 4);
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset + 4, 4).getUint32(0, true);
    const dataOffset = offset + 8;
    if (dataOffset + length > bytes.length) throw new Error('Cloudinary variant contains a truncated WebP chunk.');
    if (['EXIF', 'XMP ', 'ICCP'].includes(chunk)) metadataChunks.push(chunk.trim());
    if (chunk === 'ANIM' || chunk === 'ANMF') animated = true;
    if (chunk === 'VP8X' && length >= 10) {
      width = readUint24LittleEndian(bytes, dataOffset + 4) + 1;
      height = readUint24LittleEndian(bytes, dataOffset + 7) + 1;
    } else if (chunk === 'VP8L' && length >= 5 && bytes[dataOffset] === 0x2f) {
      const first = bytes[dataOffset + 1]!;
      const second = bytes[dataOffset + 2]!;
      const third = bytes[dataOffset + 3]!;
      const fourth = bytes[dataOffset + 4]!;
      width = 1 + first + ((second & 0x3f) << 8);
      height = 1 + ((second & 0xc0) >> 6) + (third << 2) + ((fourth & 0x0f) << 10);
    } else if (chunk === 'VP8 ' && length >= 10 && bytes[dataOffset + 3] === 0x9d && bytes[dataOffset + 4] === 0x01 && bytes[dataOffset + 5] === 0x2a) {
      width = (bytes[dataOffset + 6]! | (bytes[dataOffset + 7]! << 8)) & 0x3fff;
      height = (bytes[dataOffset + 8]! | (bytes[dataOffset + 9]! << 8)) & 0x3fff;
    }
    offset = dataOffset + length + (length % 2);
  }
  if (width === 0 || height === 0) throw new Error('Cloudinary variant dimensions could not be read.');
  return { width, height, metadataChunks, animated };
}

export function jpegContainsExifGps(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  for (let offset = 2; offset + 4 < bytes.length;) {
    if (bytes[offset] !== 0xff) return false;
    const marker = bytes[offset + 1];
    if (marker === 0xda || marker === 0xd9) return false;
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    if (length < 2 || offset + 2 + length > bytes.length) return false;
    if (marker === 0xe1 && new TextDecoder('ascii').decode(bytes.subarray(offset + 4, offset + 10)) === 'Exif\0\0') {
      const tiff = offset + 10;
      const littleEndian = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
      const bigEndian = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
      if (!littleEndian && !bigEndian) return false;
      const view = new DataView(bytes.buffer, bytes.byteOffset);
      const ifdOffset = view.getUint32(tiff + 4, littleEndian);
      const directory = tiff + ifdOffset;
      if (directory + 2 > bytes.length) return false;
      const count = view.getUint16(directory, littleEndian);
      for (let index = 0; index < count; index += 1) {
        const entry = directory + 2 + index * 12;
        if (entry + 12 > bytes.length) return false;
        if (view.getUint16(entry, littleEndian) === 0x8825) return true;
      }
    }
    offset += 2 + length;
  }
  return false;
}
