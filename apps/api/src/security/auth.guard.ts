import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { hasAllPermissions, type Permission } from '@healthos/contracts';
import { TokenService, type AccessTokenClaims } from './security.module.js';

export const IS_PUBLIC_KEY = 'healthos:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'healthos:requiredPermissions';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenClaims => {
    const req = ctx.switchToHttp().getRequest<{ user?: AccessTokenClaims }>();
    if (!req.user) {
      throw new UnauthorizedException('Authenticated user context missing.');
    }
    return req.user;
  },
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AccessTokenClaims;
    }>();

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer authorization header.');
    }

    const token = authHeader.slice(7).trim();
    try {
      req.user = await this.tokens.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AccessTokenClaims }>();
    if (!req.user) {
      throw new UnauthorizedException('Authentication required.');
    }

    if (!hasAllPermissions(req.user.role, required)) {
      throw new ForbiddenException(
        `Role ${req.user.role} lacks required permissions: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
