import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { Env } from '../../config/env.js';
import { PasswordReset, PasswordResetSchema, User, UserSchema } from '../users/user.schema.js';
import { AccountController } from './account.controller.js';
import { AdminAuthController } from './admin-auth.controller.js';
import { AdminCustomersController } from './admin-customers.controller.js';
import { AuthController } from './auth.controller.js';
import { AdminGuard, CustomerGuard, CustomerResolver, OptionalCustomerGuard } from './guards.js';
import { SessionService } from './session.service.js';

/** Global: every feature module can use AdminGuard / CustomerGuard. */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
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
  controllers: [AuthController, AccountController, AdminAuthController, AdminCustomersController],
  providers: [SessionService, CustomerResolver, CustomerGuard, OptionalCustomerGuard, AdminGuard],
  exports: [SessionService, CustomerResolver, CustomerGuard, OptionalCustomerGuard, AdminGuard, MongooseModule],
})
export class AuthModule {}
