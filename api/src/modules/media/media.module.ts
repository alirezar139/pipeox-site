import { Global, Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { StorageService } from './storage.service.js';

@Global()
@Module({ controllers: [MediaController], providers: [StorageService], exports: [StorageService] })
export class MediaModule {}
