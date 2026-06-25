/**
 * Drizzle query-layer schema. This mirrors migrations/0000_init.sql (which is the
 * authoritative DDL because it also defines append-only triggers and the balanced-
 * entry constraint that a schema differ cannot express). Money columns are bigint
 * in `bigint` mode so values never round-trip through a lossy JS number.
 */
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const money = (name: string) => bigint(name, { mode: 'bigint' });
const tsz = (name: string) => timestamp(name, { withTimezone: true });

export const landlords = pgTable('landlords', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  panEncrypted: text('pan_encrypted'),
  panValid: boolean('pan_valid').notNull().default(false),
  jurisdiction: text('jurisdiction').notNull().default('IN'),
  ownerUserId: uuid('owner_user_id'),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  payerClass: text('payer_class').notNull().default('INDIVIDUAL_HUF'),
  userId: uuid('user_id'),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  landlordId: uuid('landlord_id').notNull(),
  portfolioId: uuid('portfolio_id'),
  name: text('name').notNull(),
  address: text('address'),
  type: text('type').notNull().default('RESIDENTIAL'),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull(),
  label: text('label').notNull(),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const tenancies = pgTable(
  'tenancies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    propertyId: uuid('property_id').notNull(),
    unitId: uuid('unit_id'),
    primaryTenantId: uuid('primary_tenant_id').notNull(),
    currency: text('currency').notNull().default('INR'),
    jurisdiction: text('jurisdiction').notNull().default('IN'),
    rentMinor: money('rent_minor').notNull(),
    depositMinor: money('deposit_minor').notNull().default(0n),
    billingDay: integer('billing_day').notNull().default(1),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    escalation: jsonb('escalation'),
    status: text('status').notNull().default('ACTIVE'),
    noticeDate: date('notice_date'),
    endedAt: date('ended_at'),
    endReason: text('end_reason'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_tenancies_landlord').on(t.landlordId)],
);

export const jurisdictionPolicies = pgTable('jurisdiction_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  jurisdiction: text('jurisdiction').notNull(),
  version: integer('version').notNull(),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  reviewedByCounsel: boolean('reviewed_by_counsel').notNull().default(false),
  body: jsonb('body').notNull(),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const ledgerAccounts = pgTable('ledger_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  landlordId: uuid('landlord_id').notNull(),
  tenancyId: uuid('tenancy_id'),
  propertyId: uuid('property_id'),
  code: text('code').notNull(),
  type: text('type').notNull(),
  currency: text('currency').notNull().default('INR'),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id'),
    entryType: text('entry_type').notNull(),
    occurredAt: tsz('occurred_at').notNull(),
    recordedAt: tsz('recorded_at').notNull().defaultNow(),
    currency: text('currency').notNull().default('INR'),
    description: text('description'),
    sourceType: text('source_type'),
    sourceId: uuid('source_id'),
    idempotencyKey: text('idempotency_key'),
    reversalOf: uuid('reversal_of'),
    createdBy: uuid('created_by'),
    totalMinor: money('total_minor').notNull(),
  },
  (t) => [
    index('ix_journal_landlord').on(t.landlordId),
    index('ix_journal_tenancy').on(t.tenancyId),
  ],
);

export const ledgerPostings = pgTable(
  'ledger_postings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journalEntryId: uuid('journal_entry_id').notNull(),
    accountId: uuid('account_id').notNull(),
    side: text('side').notNull(),
    amountMinor: money('amount_minor').notNull(),
    currency: text('currency').notNull().default('INR'),
    memo: text('memo'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_postings_entry').on(t.journalEntryId),
    index('ix_postings_account').on(t.accountId),
  ],
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id').notNull(),
    number: text('number').notNull(),
    kind: text('kind').notNull().default('RENT'),
    periodStart: date('period_start'),
    periodEnd: date('period_end'),
    dueDate: date('due_date').notNull(),
    currency: text('currency').notNull().default('INR'),
    amountMinor: money('amount_minor').notNull(),
    status: text('status').notNull().default('OPEN'),
    journalEntryId: uuid('journal_entry_id'),
    createdAt: tsz('created_at').notNull().defaultNow(),
    updatedAt: tsz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('ix_invoices_tenancy').on(t.tenancyId)],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id').notNull(),
    method: text('method').notNull(),
    amountMinor: money('amount_minor').notNull(),
    tdsMinor: money('tds_minor').notNull().default(0n),
    currency: text('currency').notNull().default('INR'),
    status: text('status').notNull().default('SUCCEEDED'),
    reference: text('reference'),
    gateway: text('gateway'),
    gatewayPaymentId: text('gateway_payment_id'),
    idempotencyKey: text('idempotency_key'),
    receivedAt: tsz('received_at').notNull().defaultNow(),
    journalEntryId: uuid('journal_entry_id'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_payments_tenancy').on(t.tenancyId)],
);

export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentId: uuid('payment_id').notNull(),
    invoiceId: uuid('invoice_id').notNull(),
    amountMinor: money('amount_minor').notNull(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_alloc_payment').on(t.paymentId),
    index('ix_alloc_invoice').on(t.invoiceId),
  ],
);

export const depositAccounts = pgTable('deposit_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  landlordId: uuid('landlord_id').notNull(),
  tenancyId: uuid('tenancy_id').notNull(),
  currency: text('currency').notNull().default('INR'),
  targetMinor: money('target_minor').notNull().default(0n),
  status: text('status').notNull().default('PENDING'),
  createdAt: tsz('created_at').notNull().defaultNow(),
  updatedAt: tsz('updated_at').notNull().defaultNow(),
});

export const depositTransactions = pgTable(
  'deposit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    depositAccountId: uuid('deposit_account_id').notNull(),
    type: text('type').notNull(),
    amountMinor: money('amount_minor').notNull(),
    reason: text('reason'),
    evidenceRef: text('evidence_ref'),
    journalEntryId: uuid('journal_entry_id'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_deposit_tx_account').on(t.depositAccountId)],
);

export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  scope: text('scope').notNull(),
  requestHash: text('request_hash').notNull(),
  response: jsonb('response'),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

// ---- Phase 1: identity / auth / RBAC / lifecycle / audit ----

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email'),
  phone: text('phone'),
  name: text('name').notNull(),
  passwordHash: text('password_hash'),
  panEncrypted: text('pan_encrypted'),
  panLast4: text('pan_last4'),
  panValid: boolean('pan_valid').notNull().default(false),
  status: text('status').notNull().default('ACTIVE'),
  isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
  createdAt: tsz('created_at').notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: tsz('expires_at').notNull(),
    revokedAt: tsz('revoked_at'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_sessions_user').on(t.userId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose').notNull().default('LOGIN'),
    expiresAt: tsz('expires_at').notNull(),
    consumedAt: tsz('consumed_at'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_otp_identifier').on(t.identifier)],
);

export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    scopeType: text('scope_type').notNull(),
    scopeId: uuid('scope_id'),
    grantedBy: uuid('granted_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_roles_user').on(t.userId),
    index('ix_roles_scope').on(t.scopeType, t.scopeId),
  ],
);

export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    name: text('name').notNull(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_portfolios_landlord').on(t.landlordId)],
);

export const tenantInvitations = pgTable(
  'tenant_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id'),
    email: text('email'),
    phone: text('phone'),
    tokenHash: text('token_hash').notNull(),
    status: text('status').notNull().default('PENDING'),
    invitedBy: uuid('invited_by'),
    expiresAt: tsz('expires_at').notNull(),
    acceptedUserId: uuid('accepted_user_id'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_invites_landlord').on(t.landlordId)],
);

export const moveInspections = pgTable(
  'move_inspections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenancyId: uuid('tenancy_id').notNull(),
    type: text('type').notNull(),
    conditionNotes: text('condition_notes'),
    checklist: jsonb('checklist'),
    evidenceRefs: jsonb('evidence_refs'),
    conductedAt: tsz('conducted_at'),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_inspections_tenancy').on(t.tenancyId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id'),
    landlordId: uuid('landlord_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    ip: text('ip'),
    metadata: jsonb('metadata'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_audit_landlord').on(t.landlordId),
    index('ix_audit_actor').on(t.actorUserId),
  ],
);

// ---- Phase 2: agreements ----

export const clauses = pgTable(
  'clauses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clauseKey: text('clause_key').notNull(),
    jurisdiction: text('jurisdiction').notNull().default('IN'),
    propertyType: text('property_type'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_clauses_key').on(t.clauseKey, t.jurisdiction)],
);

export const agreementTemplates = pgTable(
  'agreement_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jurisdiction: text('jurisdiction').notNull().default('IN'),
    propertyType: text('property_type').notNull().default('RESIDENTIAL'),
    name: text('name').notNull(),
    version: integer('version').notNull().default(1),
    clauseKeys: jsonb('clause_keys').notNull(),
    defaultTermMonths: integer('default_term_months').notNull().default(11),
    reviewedByCounsel: boolean('reviewed_by_counsel').notNull().default(false),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_templates_lookup').on(t.jurisdiction, t.propertyType)],
);

export const agreements = pgTable(
  'agreements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id').notNull(),
    templateId: uuid('template_id'),
    title: text('title').notNull(),
    jurisdiction: text('jurisdiction').notNull().default('IN'),
    propertyType: text('property_type').notNull().default('RESIDENTIAL'),
    termMonths: integer('term_months').notNull().default(11),
    status: text('status').notNull().default('DRAFT'),
    registrationRequired: boolean('registration_required').notNull().default(false),
    registrationStatus: text('registration_status').notNull().default('NOT_REQUIRED'),
    stampDutyMinor: money('stamp_duty_minor').notNull().default(0n),
    stampDutyStatus: text('stamp_duty_status').notNull().default('NOT_PAID'),
    rentAuthorityRequired: boolean('rent_authority_required').notNull().default(false),
    rentAuthorityStatus: text('rent_authority_status').notNull().default('NOT_REQUIRED'),
    rentAuthorityDue: date('rent_authority_due'),
    rentAuthorityRef: text('rent_authority_ref'),
    currentVersionId: uuid('current_version_id'),
    supersedesId: uuid('supersedes_id'),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
    updatedAt: tsz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_agreements_tenancy').on(t.tenancyId),
    index('ix_agreements_landlord').on(t.landlordId),
  ],
);

export const agreementVersions = pgTable(
  'agreement_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementId: uuid('agreement_id').notNull(),
    version: integer('version').notNull(),
    variables: jsonb('variables').notNull(),
    clauses: jsonb('clauses').notNull(),
    renderedText: text('rendered_text').notNull(),
    contentHash: text('content_hash').notNull(),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_agreement_versions').on(t.agreementId)],
);

export const signerEvents = pgTable(
  'signer_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agreementVersionId: uuid('agreement_version_id').notNull(),
    partyRole: text('party_role').notNull(),
    name: text('name').notNull(),
    identifier: text('identifier'),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    documentHash: text('document_hash'),
    ip: text('ip'),
    status: text('status').notNull().default('SIGNED'),
    signedAt: tsz('signed_at'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_signer_events_version').on(t.agreementVersionId)],
);

// ---- Phase 5: operations ----

export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    name: text('name').notNull(),
    contact: text('contact'),
    category: text('category'),
    rating: integer('rating'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_vendors_landlord').on(t.landlordId)],
);

export const maintenanceTickets = pgTable(
  'maintenance_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id'),
    propertyId: uuid('property_id'),
    title: text('title').notNull(),
    description: text('description'),
    category: text('category'),
    priority: text('priority').notNull().default('NORMAL'),
    status: text('status').notNull().default('OPEN'),
    assignedVendorId: uuid('assigned_vendor_id'),
    costMinor: money('cost_minor').notNull().default(0n),
    costBearer: text('cost_bearer').notNull().default('LANDLORD'),
    chargebackJournalEntryId: uuid('chargeback_journal_entry_id'),
    slaDue: tsz('sla_due'),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
    updatedAt: tsz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_tickets_landlord').on(t.landlordId),
    index('ix_tickets_tenancy').on(t.tenancyId),
  ],
);

export const ticketEvents = pgTable(
  'ticket_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull(),
    type: text('type').notNull(),
    note: text('note'),
    evidenceRef: text('evidence_ref'),
    actorUserId: uuid('actor_user_id'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_ticket_events_ticket').on(t.ticketId)],
);

export const disputeCases = pgTable(
  'dispute_cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id'),
    title: text('title').notNull(),
    status: text('status').notNull().default('OPEN'),
    resolutionNotes: text('resolution_notes'),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
    updatedAt: tsz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('ix_disputes_landlord').on(t.landlordId)],
);

export const evidenceEntries = pgTable(
  'evidence_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    disputeCaseId: uuid('dispute_case_id'),
    tenancyId: uuid('tenancy_id'),
    seq: bigint('seq', { mode: 'bigint' }).notNull(),
    authorUserId: uuid('author_user_id'),
    entryType: text('entry_type').notNull(),
    summary: text('summary').notNull(),
    content: jsonb('content'),
    contentHash: text('content_hash').notNull(),
    prevHash: text('prev_hash').notNull(),
    entryHash: text('entry_hash').notNull(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_evidence_landlord').on(t.landlordId),
    index('ix_evidence_dispute').on(t.disputeCaseId),
  ],
);

export const notices = pgTable(
  'notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id').notNull(),
    type: text('type').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    effectiveDate: date('effective_date'),
    minNoticeDays: integer('min_notice_days').notNull().default(0),
    status: text('status').notNull().default('DRAFT'),
    evidenceEntryId: uuid('evidence_entry_id'),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_notices_tenancy').on(t.tenancyId)],
);

export const deliveryReceipts = pgTable(
  'delivery_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noticeId: uuid('notice_id').notNull(),
    channel: text('channel').notNull(),
    status: text('status').notNull().default('SENT'),
    providerRef: text('provider_ref'),
    occurredAt: tsz('occurred_at').notNull().defaultNow(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_delivery_notice').on(t.noticeId)],
);

export const houseRulesVersions = pgTable(
  'house_rules_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    propertyId: uuid('property_id'),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    createdBy: uuid('created_by'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_house_rules_property').on(t.propertyId)],
);

export const houseRulesAcknowledgements = pgTable(
  'house_rules_acknowledgements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    houseRulesVersionId: uuid('house_rules_version_id').notNull(),
    tenancyId: uuid('tenancy_id'),
    userId: uuid('user_id'),
    acknowledgedAt: tsz('acknowledged_at').notNull().defaultNow(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_hr_ack_version').on(t.houseRulesVersionId)],
);

export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id'),
    channel: text('channel').notNull(),
    recipient: text('recipient').notNull(),
    template: text('template'),
    payload: jsonb('payload'),
    status: text('status').notNull().default('SENT'),
    providerRef: text('provider_ref'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_notification_landlord').on(t.landlordId)],
);

export const leaseDocuments = pgTable(
  'lease_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    landlordId: uuid('landlord_id').notNull(),
    tenancyId: uuid('tenancy_id').notNull(),
    agreementId: uuid('agreement_id'),
    kind: text('kind').notNull().default('LEASE'),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
    storageKey: text('storage_key').notNull(),
    sha256: text('sha256').notNull(),
    signedAt: tsz('signed_at'),
    signedBy: text('signed_by'),
    notes: text('notes'),
    uploadedBy: uuid('uploaded_by').notNull(),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('ix_lease_documents_tenancy').on(t.tenancyId),
    index('ix_lease_documents_landlord').on(t.landlordId),
  ],
);

// ---- Phase 6: compliance ----

export const consents = pgTable(
  'consents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    purpose: text('purpose').notNull(),
    granted: boolean('granted').notNull().default(true),
    grantedAt: tsz('granted_at'),
    withdrawnAt: tsz('withdrawn_at'),
    createdAt: tsz('created_at').notNull().defaultNow(),
  },
  (t) => [index('ix_consents_user').on(t.userId)],
);

export const dataSubjectRequests = pgTable(
  'data_subject_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull().default('PENDING'),
    details: jsonb('details'),
    createdAt: tsz('created_at').notNull().defaultNow(),
    completedAt: tsz('completed_at'),
  },
  (t) => [index('ix_dsr_user').on(t.userId)],
);

export const schema = {
  landlords,
  tenants,
  properties,
  units,
  tenancies,
  jurisdictionPolicies,
  ledgerAccounts,
  journalEntries,
  ledgerPostings,
  invoices,
  payments,
  paymentAllocations,
  depositAccounts,
  depositTransactions,
  idempotencyKeys,
  users,
  sessions,
  otpCodes,
  roleAssignments,
  portfolios,
  tenantInvitations,
  moveInspections,
  auditLog,
  clauses,
  agreementTemplates,
  agreements,
  agreementVersions,
  signerEvents,
};
