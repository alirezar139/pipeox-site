import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { settingsSchema, type SiteSettings } from './settings.schema.js';

const DOC_ID = 'site';

@Injectable()
export class SettingsService {
  private cache: SiteSettings | null = null;

  constructor(@InjectConnection() private readonly conn: Connection) {}

  private get col() {
    return this.conn.collection<{ _id: string; value: SiteSettings; updatedAt: Date }>('settings');
  }

  async get(): Promise<SiteSettings> {
    if (!this.cache) {
      const doc = await this.col.findOne({ _id: DOC_ID });
      if (!doc) throw new Error('Site settings missing — the seed did not run.');
      this.cache = doc.value;
    }
    return this.cache;
  }

  async exists(): Promise<boolean> {
    return (await this.col.countDocuments({ _id: DOC_ID })) > 0;
  }

  async save(input: unknown): Promise<SiteSettings> {
    const value = settingsSchema.parse(input);
    await this.col.updateOne({ _id: DOC_ID }, { $set: { value, updatedAt: new Date() } }, { upsert: true });
    this.cache = value;
    return value;
  }
}
