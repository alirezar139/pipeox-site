import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { langOf, localize } from '../../common/i18n.js';
import { AdminGuard } from '../auth/guards.js';
import { settingsSchema, SETTINGS_ICONS } from './settings.schema.js';
import { SettingsService } from './settings.service.js';

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public: everything the site renders (no secrets live in settings). */
  @Get('site')
  async site(@Req() req: Request) {
    return localize(await this.settings.get(), langOf(req));
  }

  @UseGuards(AdminGuard)
  @Get('admin/settings')
  async adminGet() {
    return { settings: await this.settings.get(), icons: SETTINGS_ICONS };
  }

  @UseGuards(AdminGuard)
  @Put('admin/settings')
  save(@Body({ schema: settingsSchema }) body: unknown) {
    return this.settings.save(body);
  }
}
