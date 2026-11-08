import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../../config/env.js';
import { Admin, AdminSchema } from '../users/admin.schema.js';
import { PasswordReset, PasswordResetSchema, User, UserSchema } from '../users/user.schema.js';
import { AccountController } from './account.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { AdminSystemController, AdminUsersController } from './admin-users.controller.js';
import { AuthController } from './auth.controller.js';
import { AdminGuard, AdminResolver, StaffGuard, CustomerGuard, CustomerResolver, DeveloperGuard, OptionalCustomerGuard } from './guards.js';
import { SessionService } from './session.service.js';

/** Global: every feature module can use AdminGuard / CustomerGuard. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', issuer: 'pipeox' },
        verifyOptions: { algorithms: ['HS256'], issuer: 'pipeox' },
      }),
    }),
  ],
  controllers: [AuthController, AccountController, AdminAuthController, AdminCustomersController, AdminUsersController, AdminSystemController],
  providers: [SessionService, CustomerResolver, AdminResolver, CustomerGuard, OptionalCustomerGuard, AdminGuard, StaffGuard, DeveloperGuard],
  exports: [SessionService, CustomerResolver, AdminResolver, CustomerGuard, OptionalCustomerGuard, AdminGuard, DeveloperGuard, MongooseModule],
})
export class AuthModule {}
