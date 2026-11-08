import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Request, Response } from 'express';
import type { Model } from 'mongoose';
import { Admin, type AdminDocument } from '../users/admin.schema.js';
import { User, type UserDocument } from '../users/user.schema.js';
import { SessionService } from './session.service.js';

type WithUser = Request & { user?: UserDocument; admin?: AdminDocument };

/**
 * Resolves the logged-in customer (active account, current token version) or null.
 * Passing the response slides the session's idle timeout.
 */
@Injectable()
export class CustomerResolver {
  constructor(
    private readonly sessions: SessionService,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async resolve(req: Request, res?: Response): Promise<UserDocument | null> {
    const claims = await this.sessions.readCustomer(req);
    if (!claims) return null;
    const user = await this.users.findById(claims.sub);
    if (!user || !user.active || user.tokenVersion !== claims.v) return null;
    await this.sessions.touchCustomer(res, claims);
    return user;
  }
}

/** Resolves the logged-in admin user (active, current token version) or null. */
@Injectable()
export class AdminResolver {
  constructor(
    private readonly sessions: SessionService,
    @InjectModel(Admin.name) private readonly admins: Model<Admin>,
  ) {}

  async resolve(req: Request, res?: Response): Promise<AdminDocument | null> {
    const claims = await this.sessions.readAdmin(req);
    if (!claims) return null;
    const admin = await this.admins.findById(claims.sub);
    if (!admin || !admin.active || admin.tokenVersion !== claims.v) return null;
    await this.sessions.touchAdmin(res, claims);
    return admin;
  }
}

const http = (ctx: ExecutionContext) => [ctx.switchToHttp().getRequest<WithUser>(), ctx.switchToHttp().getResponse<Response>()] as const;

@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(private readonly resolver: CustomerResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const [req, res] = http(ctx);
    const user = await this.resolver.resolve(req, res);
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
    const [req, res] = http(ctx);
    req.user = (await this.resolver.resolve(req, res)) ?? undefined;
    return true;
  }
}

/** Any active admin user (role admin or developer). */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly resolver: AdminResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const [req, res] = http(ctx);
    const admin = await this.resolver.resolve(req, res);
    if (!admin) throw new UnauthorizedException('Admin login required');
    req.admin = admin;
    return true;
  }
}

/** Developer-only areas (System page). */
@Injectable()
export class DeveloperGuard implements CanActivate {
  constructor(private readonly resolver: AdminResolver) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const [req, res] = http(ctx);
    const admin = await this.resolver.resolve(req, res);
    if (!admin) throw new UnauthorizedException('Admin login required');
    if (admin.role !== 'developer') throw new ForbiddenException('این بخش فقط برای حساب برنامه‌نویس است.');
    req.admin = admin;
    return true;
  }
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<WithUser>().user);
export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<WithUser>().admin);
