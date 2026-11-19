import { Controller, Get } from '@nestjs/common';
import { CurrentUser, Public, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';

@Controller('v1')
export class HealthController {
  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      service: 'healthos-api',
      security: {
        envelopeEncryption: 'AES-256-GCM',
        rowLevelSecurity: 'PostgreSQL RLS',
        auditChain: 'SHA-256 append-only',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @RequirePermissions('audit:read')
  @Get('security/whoami')
  getSecurityContext(@CurrentUser() user: AccessTokenClaims) {
    return {
      userId: user.sub,
      organizationId: user.orgId,
      branchId: user.branchId,
      role: user.role,
      mfaVerified: user.mfaVerified,
    };
  }
}
