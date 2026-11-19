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
import { LabController } from './lab/lab.controller.js';
import { LabService } from './lab/lab.service.js';
import { PharmacyController } from './pharmacy/pharmacy.controller.js';
import { PharmacyService } from './pharmacy/pharmacy.service.js';
import { ProcurementController } from './procurement/procurement.controller.js';
import { ProcurementService } from './procurement/procurement.service.js';
import { BillingController } from './billing/billing.controller.js';
import { BillingService } from './billing/billing.service.js';
import { HrController } from './hr/hr.controller.js';
import { HrService } from './hr/hr.service.js';
import { ComplianceController } from './compliance/compliance.controller.js';
import { ComplianceService } from './compliance/compliance.service.js';
import { EquipmentController } from './equipment/equipment.controller.js';
import { EquipmentService } from './equipment/equipment.service.js';

@Module({
  imports: [SecurityModule],
  controllers: [
    HealthController,
    AuthController,
    PatientsController,
    ClinicalController,
    LabController,
    PharmacyController,
    ProcurementController,
    BillingController,
    HrController,
    ComplianceController,
    EquipmentController,
  ],
  providers: [
    AuditService,
    AuthService,
    PatientsService,
    ClinicalService,
    LabService,
    PharmacyService,
    ProcurementService,
    BillingService,
    HrService,
    ComplianceService,
    EquipmentService,
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
