import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @RequirePermissions('analytics:read')
  @Get('dashboard')
  getDashboard(
    @CurrentUser() actor: AccessTokenClaims,
    @Query('branchId') branchId?: string,
  ) {
    return this.analytics.getExecutiveDashboard(actor, branchId);
  }
}
