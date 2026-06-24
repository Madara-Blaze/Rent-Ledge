import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RateLimitGuard } from './common/security/rate-limit.guard';
import { validateEnv } from './config/env';
import { HealthController } from './health.controller';
import { DbModule } from './infra/db/db.module';
import { PoliciesAdminModule } from './modules/admin/policies.module';
import { AgreementsModule } from './modules/agreements/agreements.module';
import { AuditInterceptor } from './modules/audit/audit.interceptor';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DpdpModule } from './modules/dpdp/dpdp.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { HouseRulesModule } from './modules/house-rules/house-rules.module';
import { InvoicingModule } from './modules/invoicing/invoicing.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { NoticesModule } from './modules/notices/notices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PolicyModule } from './modules/policy/policy.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { TaxModule } from './modules/tax/tax.module';
import { TenanciesModule } from './modules/tenancies/tenancies.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DbModule,
    // Phase 1: identity / access / audit / lifecycle / admin
    AuthModule,
    RbacModule,
    AuditModule,
    PropertiesModule,
    TenanciesModule,
    AgreementsModule,
    PoliciesAdminModule,
    // Phase 3: financial core
    PolicyModule,
    TenancyModule,
    LedgerModule,
    InvoicingModule,
    PaymentsModule,
    DepositsModule,
    TaxModule,
    ReportsModule,
    // Phase 5: operations
    MaintenanceModule,
    EvidenceModule,
    NoticesModule,
    HouseRulesModule,
    DocumentsModule,
    RemindersModule,
    // Phase 6: compliance
    DpdpModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
