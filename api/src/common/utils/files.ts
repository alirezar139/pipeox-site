/** A file received by multer (memory storage). */
export interface UploadedFileData {
  originalname: string;
  buffer: Buffer;
  size: number;
}

/**
 * Upload type checks by file *content* (magic bytes), never trusting the client's
 * filename or Content-Type alone. Both extension and content must agree.
 */

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

const isJpeg = (b: Buffer) => startsWith(b, [0xff, 0xd8, 0xff]);
const isPng = (b: Buffer) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isWebp = (b: Buffer) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8);
const isPdf = (b: Buffer) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const isZip = (b: Buffer) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]); // docx / xlsx
const isOle = (b: Buffer) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // doc / xls
/** CSV: valid UTF-8 text without NUL bytes. */
const isText = (b: Buffer) => !b.subarray(0, 8192).includes(0) && Buffer.from(b.subarray(0, 8192).toString('utf8'), 'utf8').length > 0;

export const IMAGE_TYPES = {
  jpg: { check: isJpeg, mime: 'image/jpeg' },
  jpeg: { check: isJpeg, mime: 'image/jpeg' },
  png: { check: isPng, mime: 'image/png' },
  webp: { check: isWebp, mime: 'image/webp' },
} as const;

export const ATTACHMENT_TYPES = {
  ...IMAGE_TYPES,
  pdf: { check: isPdf, mime: 'application/pdf' },
  docx: { check: isZip, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  xlsx: { check: isZip, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  doc: { check: isOle, mime: 'application/msword' },
  xls: { check: isOle, mime: 'application/vnd.ms-excel' },
  csv: { check: isText, mime: 'text/csv' },
} as const;

type TypeTable = Record<string, { check: (b: Buffer) => boolean; mime: string }>;

/** Returns the normalized extension when name and content agree, else null. */
export function detectType(originalName: string, buf: Buffer, table: TypeTable): string | null {
  const ext = originalName.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (!ext || !(ext in table)) return null;
  return table[ext].check(buf) ? (ext === 'jpeg' ? 'jpg' : ext) : null;
}

/** Filename safe for display / Content-Disposition (no paths, no control chars). */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[\u0000-\u001f\u007f"]/g, '').slice(0, 150) || 'file';
}
