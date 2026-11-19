import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  AssignUserBranchSchema,
  CreateBranchSchema,
  type AssignUserBranchDto,
  type CreateBranchDto,
} from '@healthos/contracts';
import { CurrentUser, RequirePermissions } from '../security/auth.guard.js';
import type { AccessTokenClaims } from '../security/security.module.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';
import { OrganizationService } from './organization.service.js';

function extractMeta(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

@Controller('v1/organization')
export class OrganizationController {
  constructor(private readonly org: OrganizationService) {}

  @RequirePermissions('branch:manage')
  @Post('branches')
  createBranch(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(CreateBranchSchema)) dto: CreateBranchDto,
    @Req() req: Request,
  ) {
    return this.org.createBranch(actor, dto, extractMeta(req));
  }

  @RequirePermissions('branch:manage')
  @Get('branches')
  listBranches(@CurrentUser() actor: AccessTokenClaims) {
    return this.org.listBranches(actor);
  }

  @RequirePermissions('branch:manage')
  @Post('branches/assign-user')
  assignUser(
    @CurrentUser() actor: AccessTokenClaims,
    @Body(new ZodValidationPipe(AssignUserBranchSchema)) dto: AssignUserBranchDto,
    @Req() req: Request,
  ) {
    return this.org.assignUserToBranch(actor, dto, extractMeta(req));
  }

  @RequirePermissions('analytics:read')
  @Get('branches/comparison')
  branchComparison(@CurrentUser() actor: AccessTokenClaims) {
    return this.org.getBranchComparison(actor);
  }
}
