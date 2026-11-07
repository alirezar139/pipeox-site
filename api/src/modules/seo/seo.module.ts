import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { SeoController } from './seo.controller.js';

@Module({ imports: [SettingsModule], controllers: [SeoController] })
export class SeoModule {}
