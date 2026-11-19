import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SecurityModule } from './security/security.module.js';
import { JwtAuthGuard, PermissionsGuard } from './security/auth.guard.js';
import { AuditService } from './audit/audit.service.js';
import { HealthController } from './health/health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { PatientsController } from './patients/patients.controller.js';
import { PatientsService } from './patients/patients.service.js';
import { ClinicalController } from './clinical/clinical.controller.js';
import { ClinicalService } from './clinical/clinical.service.js';

@Module({
  imports: [SecurityModule],
  controllers: [HealthController, AuthController, PatientsController, ClinicalController],
  providers: [
    AuditService,
    AuthService,
    PatientsService,
    ClinicalService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
