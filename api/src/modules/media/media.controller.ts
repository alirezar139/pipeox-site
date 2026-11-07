import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { IMAGE_TYPES, type UploadedFileData } from '../../common/utils/files.js';
import { AdminGuard } from '../auth/guards.js';
import { StorageService } from './storage.service.js';

const fileName = z.string().regex(/^[a-f0-9]{24}\.(jpg|png|webp)$/);

@Controller()
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  /** Public: images uploaded in the panel. Content-Type is fixed by extension; never sniffed or executed. */
  @Get('media/:file')
  serve(@Param('file') file: string, @Res() res: Response) {
    if (!fileName.safeParse(file).success) throw new NotFoundException();
    const full = path.join(this.storage.dir('media'), file);
    if (!existsSync(full)) throw new NotFoundException();
    const ext = file.split('.').pop() as keyof typeof IMAGE_TYPES;
    res.setHeader('Content-Type', IMAGE_TYPES[ext].mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    res.sendFile(full);
  }

  /** Admin: upload an image (product, article, project, editor). Returns its URL. */
  @UseGuards(AdminGuard)
  @Post('admin/uploads')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@UploadedFile() file?: UploadedFileData) {
    if (!file) throw new BadRequestException('تصویری انتخاب نشده است.');
    return { url: await this.storage.saveImage(file) };
  }
}
