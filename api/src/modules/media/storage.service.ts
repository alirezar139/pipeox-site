import { Injectable, OnModuleInit, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fromRoot, type Env } from '../../config/env.js';
import { ATTACHMENT_TYPES, detectType, IMAGE_TYPES, type UploadedFileData } from '../../common/utils/files.js';

/**
 * Files on disk, under DATA_DIR (outside the app folder):
 *   media/        images uploaded in the admin panel (public, served by MediaController)
 *   attachments/  inquiry attachments (private, admin download only)
 * Names are random; the original name is never used as a path.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = fromRoot(config.get('DATA_DIR', { infer: true }));
  }

  async onModuleInit() {
    await mkdir(this.dir('media'), { recursive: true });
    await mkdir(this.dir('attachments'), { recursive: true });
  }

  dir(kind: 'media' | 'attachments') {
    return path.join(this.root, kind);
  }

  /** Validates an image by content and stores it; returns the public URL. */
  async saveImage(file: UploadedFileData): Promise<string> {
    const ext = detectType(file.originalname, file.buffer, IMAGE_TYPES);
    if (!ext) throw new UnsupportedMediaTypeException('فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.');
    const name = `${randomBytes(12).toString('hex')}.${ext}`;
    await writeFile(path.join(this.dir('media'), name), file.buffer, { flag: 'wx' });
    return `/api/media/${name}`;
  }

  /** Validates an inquiry attachment by content and stores it; returns the stored relative name. */
  async saveAttachment(file: UploadedFileData): Promise<{ stored: string; ext: string }> {
    const ext = detectType(file.originalname, file.buffer, ATTACHMENT_TYPES);
    if (!ext) throw new UnsupportedMediaTypeException({ message: 'فقط فایل‌های PDF، Excel، Word، CSV یا تصویر پذیرفته می‌شوند.', field: 'attachment' });
    const month = new Date().toISOString().slice(0, 7);
    await mkdir(path.join(this.dir('attachments'), month), { recursive: true });
    const stored = `${month}/${randomBytes(16).toString('hex')}.${ext}`;
    await writeFile(path.join(this.dir('attachments'), stored), file.buffer, { flag: 'wx' });
    return { stored, ext };
  }

  /** Absolute path of a stored attachment, refusing anything that escapes the folder. */
  attachmentPath(stored: string): string | null {
    if (!/^\d{4}-\d{2}\/[a-f0-9]{32}\.[a-z]{2,5}$/.test(stored)) return null;
    return path.join(this.dir('attachments'), stored);
  }
}
