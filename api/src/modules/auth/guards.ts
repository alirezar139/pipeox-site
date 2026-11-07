import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import { User, type UserDocument } from '../users/user.schema.js';
import { SessionService } from './session.service.js';

type WithUser = Request & { user?: UserDocument };

/** Resolves the logged-in customer (active account, current token version) or null. */
@Injectable()
export class CustomerResolver {
  constructor(
    private readonly sessions: SessionService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async resolve(req: Request): Promise<UserDocument | null> {
    const claims = await this.sessions.readCustomer(req);
    if (!claims || !/^[a-f0-9]{24}$/.test(claims.sub)) return null;
    const user = await this.users.findById(claims.sub);
    return user && user.active && user.tokenVersion === claims.v ? user : null;
  }
}

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly resolver: CustomerResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<WithUser>();
    const user = await this.resolver.resolve(req);
    if (!user) throw new UnauthorizedException('ابتدا وارد حساب خود شوید.');
    req.user = user;
    return true;
  }
}

/** Never blocks; attaches the customer when there is one (e.g. inquiries from logged-in users). */
@Injectable()
export class OptionalCustomerGuard implements CanActivate {
  constructor(private readonly resolver: CustomerResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<WithUser>();
    req.user = (await this.resolver.resolve(req)) ?? undefined;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!(await this.sessions.isAdmin(ctx.switchToHttp().getRequest<Request>()))) {
      throw new UnauthorizedException('Admin login required');
    }
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<WithUser>().user);
