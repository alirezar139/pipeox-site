import { Module } from '@nestjs/common';
import { ArticlesModule } from '../modules/articles/articles.module.js';
import { ProductsModule } from '../modules/products/products.module.js';
import { ProjectsModule } from '../modules/projects/projects.module.js';
import { SettingsModule } from '../modules/settings/settings.module.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [SettingsModule, ProductsModule, ArticlesModule, ProjectsModule],
  providers: [SeedService],
})
export class DatabaseModule {}
