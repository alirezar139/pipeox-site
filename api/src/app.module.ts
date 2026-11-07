import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CsrfGuard } from './common/security/csrf.guard.js';
import { loadEnvFile, validateEnv, type Env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { ArticlesModule } from './modules/articles/articles.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { InquiriesModule } from './modules/inquiries/inquiries.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SeoModule } from './modules/seo/seo.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SubscribersModule } from './modules/subscribers/subscribers.module.js';

// The project's .env wins over machine-wide variables (see loadEnvFile)
loadEnvFile();

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validateEnv }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        uri: config.get('MONGODB_URI', { infer: true }),
        // Treat query values as data, never as operators ({ $gt: '' } injection)
        sanitizeFilter: true,
        serverSelectionTimeoutMS: 8000,
      }),
    }),
    // Generous global default; sensitive routes set tighter @Throttle limits
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    NotificationsModule,
    AuthModule,
    MediaModule,
    SettingsModule,
    ProductsModule,
    ArticlesModule,
    ProjectsModule,
    InquiriesModule,
    SubscribersModule,
    DashboardModule,
    SeoModule,
    DatabaseModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
})
export class AppModule {}
