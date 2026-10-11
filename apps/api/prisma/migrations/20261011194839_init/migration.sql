-- CreateEnum
CREATE TYPE "QualityTag" AS ENUM ('measured', 'owner_entered', 'estimated', 'default');

-- CreateEnum
CREATE TYPE "FactorStatus" AS ENUM ('confirmed', 'confirmed_replace', 'verify', 'estimate_only', 'rule');

-- CreateEnum
CREATE TYPE "GasBasis" AS ENUM ('CO2', 'CO2e');

-- CreateEnum
CREATE TYPE "Enduse" AS ENUM ('electricity', 'fuel');

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('msme', 'household');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'accountant', 'supervisor');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('power_bill', 'fuel', 'invoice', 'quote');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('web', 'whatsapp');

-- CreateEnum
CREATE TYPE "SavingsStatus" AS ENUM ('early', 'verified');

-- CreateTable
CREATE TABLE "organisations" (
    "id" UUID NOT NULL,
    "type" "OrgType" NOT NULL,
    "name" TEXT NOT NULL,
    "udyam_no" TEXT,
    "gstin" TEXT,
    "sector" TEXT,
    "state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "address" TEXT,
    "lat" DECIMAL(9,6),
    "lng" DECIMAL(9,6),
    "discom" TEXT,
    "consumer_no" TEXT,
    "tariff_category" TEXT,
    "contracted_demand_kva" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "invited_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "notice_version" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "file_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "source" "DocumentSource" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extractions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "fields_json" JSONB NOT NULL,
    "confidence_json" JSONB,
    "confirmed_by" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extractions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_months" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "kwh" DECIMAL(14,2),
    "kvah" DECIMAL(14,2),
    "pf" DECIMAL(5,4),
    "md_kva" DECIMAL(10,2),
    "peak_kwh" DECIMAL(14,2),
    "solar_hours_kwh" DECIMAL(14,2),
    "energy_charges" DECIMAL(14,2),
    "demand_charges" DECIMAL(14,2),
    "other_charges_json" JSONB,
    "quality_tag" "QualityTag" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "energy_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_entries" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "fuel_type" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "quality_tag" "QualityTag" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_months" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "quality_tag" "QualityTag" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_months_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "scope1" DECIMAL(14,3),
    "scope2" DECIMAL(14,3),
    "scope3_metals" DECIMAL(14,3),
    "intensity" DECIMAL(14,4),
    "factor_ids" UUID[],
    "formula_version" TEXT NOT NULL,
    "input_ids" UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baselines" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "start" DATE NOT NULL,
    "end" DATE NOT NULL,
    "a" DECIMAL(18,6) NOT NULL,
    "b" DECIMAL(18,6) NOT NULL,
    "cv_rmse" DECIMAL(8,4),
    "nmbe" DECIMAL(8,4),
    "method" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_actions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "planned_at" TIMESTAMP(3),
    "done_at" TIMESTAMP(3),
    "actual_cost" DECIMAL(14,2),
    "quote_document_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_ledger" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "action_id" UUID NOT NULL,
    "kwh_saved" DECIMAL(14,2) NOT NULL,
    "inr_saved" DECIMAL(14,2) NOT NULL,
    "co2_saved" DECIMAL(14,3) NOT NULL,
    "status" "SavingsStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "snapshot_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "file_key" TEXT,
    "sha256" TEXT,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shares" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "recipient" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_routine_adjustments" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "kwh_effect" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "logged_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "non_routine_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_equipment" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "equipment" TEXT NOT NULL,
    "enduse_share" DECIMAL(5,4) NOT NULL,
    "quality_tag" "QualityTag" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "factors" (
    "id" UUID NOT NULL,
    "source_type" TEXT NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "version" TEXT,
    "valid_from" DATE,
    "superseded_by" UUID,
    "status" "FactorStatus" NOT NULL,
    "gas_basis" "GasBasis",
    "basis_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_rules" (
    "id" UUID NOT NULL,
    "discom" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "params_json" JSONB NOT NULL,
    "valid_from" DATE,
    "source" TEXT NOT NULL,
    "basis_note" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tariff_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_library" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "equipment" TEXT NOT NULL,
    "saving_low" DECIMAL(14,2),
    "saving_high" DECIMAL(14,2),
    "cost_low" DECIMAL(14,2),
    "cost_high" DECIMAL(14,2),
    "source_url" TEXT,
    "is_zero_cost" BOOLEAN NOT NULL,
    "enduse" "Enduse" NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schemes" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rules_json" JSONB NOT NULL,
    "rate_range" TEXT,
    "last_checked_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL,
    "status_note" TEXT,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmarks" (
    "id" UUID NOT NULL,
    "sector" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "low" DECIMAL(14,3) NOT NULL,
    "high" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sites_org_id_idx" ON "sites"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "memberships_org_id_idx" ON "memberships"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_org_id_key" ON "memberships"("user_id", "org_id");

-- CreateIndex
CREATE INDEX "consents_org_id_idx" ON "consents"("org_id");

-- CreateIndex
CREATE INDEX "documents_org_id_idx" ON "documents"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_site_id_sha256_key" ON "documents"("site_id", "sha256");

-- CreateIndex
CREATE INDEX "extractions_org_id_idx" ON "extractions"("org_id");

-- CreateIndex
CREATE INDEX "energy_months_org_id_idx" ON "energy_months"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "energy_months_site_id_period_start_key" ON "energy_months"("site_id", "period_start");

-- CreateIndex
CREATE INDEX "fuel_entries_org_id_idx" ON "fuel_entries"("org_id");

-- CreateIndex
CREATE INDEX "production_months_org_id_idx" ON "production_months"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_months_site_id_month_key" ON "production_months"("site_id", "month");

-- CreateIndex
CREATE INDEX "results_org_id_idx" ON "results"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "results_site_id_month_key" ON "results"("site_id", "month");

-- CreateIndex
CREATE INDEX "baselines_org_id_idx" ON "baselines"("org_id");

-- CreateIndex
CREATE INDEX "site_actions_org_id_idx" ON "site_actions"("org_id");

-- CreateIndex
CREATE INDEX "savings_ledger_org_id_idx" ON "savings_ledger"("org_id");

-- CreateIndex
CREATE INDEX "reports_org_id_idx" ON "reports"("org_id");

-- CreateIndex
CREATE INDEX "shares_org_id_idx" ON "shares"("org_id");

-- CreateIndex
CREATE INDEX "audit_log_org_id_idx" ON "audit_log"("org_id");

-- CreateIndex
CREATE INDEX "non_routine_adjustments_org_id_idx" ON "non_routine_adjustments"("org_id");

-- CreateIndex
CREATE INDEX "site_equipment_org_id_idx" ON "site_equipment"("org_id");

-- CreateIndex
CREATE INDEX "factors_source_type_version_idx" ON "factors"("source_type", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_rules_discom_category_rule_type_key" ON "tariff_rules"("discom", "category", "rule_type");

-- CreateIndex
CREATE UNIQUE INDEX "action_library_code_key" ON "action_library"("code");

-- CreateIndex
CREATE UNIQUE INDEX "schemes_name_key" ON "schemes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "benchmarks_sector_metric_key" ON "benchmarks"("sector", "metric");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_months" ADD CONSTRAINT "energy_months_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_months" ADD CONSTRAINT "energy_months_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fuel_entries" ADD CONSTRAINT "fuel_entries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_months" ADD CONSTRAINT "production_months_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_months" ADD CONSTRAINT "production_months_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_actions" ADD CONSTRAINT "site_actions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_actions" ADD CONSTRAINT "site_actions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_actions" ADD CONSTRAINT "site_actions_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "action_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_actions" ADD CONSTRAINT "site_actions_quote_document_id_fkey" FOREIGN KEY ("quote_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_ledger" ADD CONSTRAINT "savings_ledger_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "action_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shares" ADD CONSTRAINT "shares_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_routine_adjustments" ADD CONSTRAINT "non_routine_adjustments_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_routine_adjustments" ADD CONSTRAINT "non_routine_adjustments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "non_routine_adjustments" ADD CONSTRAINT "non_routine_adjustments_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_equipment" ADD CONSTRAINT "site_equipment_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_equipment" ADD CONSTRAINT "site_equipment_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
