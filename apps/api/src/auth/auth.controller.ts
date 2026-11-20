import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  BootstrapOrgSchema,
  CreateStaffUserSchema,
  LoginSchema,
  MfaEnableSchema,
  MfaVerifySchema,
  RefreshTokenSchema,
  type BootstrapOrgDto,
  type CreateStaffUserDto,
  type LoginDto,
  type MfaEnableDto,
  type MfaVerifyDto,
  type RefreshTokenDto,
} from '@healthos/contracts';
import { CurrentUser, Public, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { AuthService } from './auth.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('bootstrap')
  bootstrap(
    @Body(new ZodValidationPipe(BootstrapOrgSchema)) dto: BootstrapOrgDto,
    @Req() req: Request,
  ) {
    const headerVal = req.headers['x-bootstrap-secret'];
    return this.auth.bootstrapOrganization(dto, {
      ...extractMeta(req),
      bootstrapSecretHeader: typeof headerVal === 'string' ? headerVal : null,
    });
  }

  @RequirePermissions('hr:manage')
  @Post('staff')
  createStaff(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateStaffUserSchema)) dto: CreateStaffUserDto,
    @Req() req: Request,
  ) {
    return this.auth.createStaffUser(actor, dto, extractMeta(req));
  }

  @Public()
  @Post('login')
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, extractMeta(req));
  }

  @Post('mfa/setup')
  setupMfa(@CurrentUser() actor: AccessTokenClaims) {
    return this.auth.setupMfa(actor);
  }

  @Post('mfa/enable')
  enableMfa(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(MfaEnableSchema)) dto: MfaEnableDto,
    @Req() req: Request,
  ) {
    return this.auth.enableMfa(actor, dto.code, extractMeta(req));
  }

  @Public()
  @Post('mfa/verify')
  verifyMfa(
    @Body(new ZodValidationPipe(MfaVerifySchema)) dto: MfaVerifyDto,
    @Req() req: Request,
  ) {
    return this.auth.verifyMfaChallenge(dto, extractMeta(req));
  }

  @Public()
  @Post('refresh')
  refresh(
    @Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    return this.auth.refreshSession(dto.refreshToken, extractMeta(req));
  }

  @Post('logout')
  async logout(
    @CurrentUser() actor: AccessTokenClaims,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(actor, body?.refreshToken, extractMeta(req));
    res.setHeader('Clear-Site-Data', '"cookies", "storage", "cache"');
    return { loggedOut: true };
  }
}
