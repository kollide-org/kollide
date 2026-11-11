import { crc32, deflateSync } from 'node:zlib'

export const GPS_MARKER = 'GPS-MARKER-12.9716N-77.5946E'

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/**
 * A real PNG picture (smooth gradient) that also carries a fake location tag in a text chunk and in an EXIF chunk.
 * The upload must come out as WebP without it.
 */
export function pictureWithLocation(width = 1400, height = 1000, hue = 0): Buffer {
  const rows: Buffer[] = []
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3)
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = Math.floor((x / width) * 255)
      row[2 + x * 3] = Math.floor((y / height) * 255)
      row[3 + x * 3] = (hue + Math.floor(((x + y) / (width + height)) * 255)) % 256
    }
    rows.push(row)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // RGB
  const exif = Buffer.concat([Buffer.from('MM\0*\0\0\0\b\0\0\0\0\0\0', 'binary'), Buffer.from(GPS_MARKER)])
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('tEXt', Buffer.from(`Comment\0${GPS_MARKER}`, 'latin1')),
    chunk('eXIf', exif),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

export function pictureFile(name: string, hue = 0) {
  return { name, mimeType: 'image/png', buffer: pictureWithLocation(1400, 1000, hue) }
}
