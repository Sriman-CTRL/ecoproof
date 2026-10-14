-- D89 sign-in and data wizard (14 Oct 2026). ADDITIVE ONLY: new nullable columns and new tables; nothing dropped or renamed.
-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "onboarding_done_at" TIMESTAMP(3),
ADD COLUMN     "onboarding_json" JSONB;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "file_check_json" JSONB,
ADD COLUMN     "source_kind" TEXT;

-- AlterTable
ALTER TABLE "energy_months" ADD COLUMN     "document_id" UUID,
ADD COLUMN     "lock_reason" TEXT,
ADD COLUMN     "locked_at" TIMESTAMP(3),
ADD COLUMN     "source_kind" TEXT;

-- CreateTable
CREATE TABLE "energy_month_versions" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "energy_month_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "values_json" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "energy_month_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_checks" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "udyam_no" TEXT,
    "gstin" TEXT,
    "consumer_no" TEXT,
    "level" TEXT NOT NULL,
    "checks_json" JSONB NOT NULL,
    "doc_json" JSONB,
    "is_sample" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "energy_month_versions_org_id_idx" ON "energy_month_versions"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "energy_month_versions_energy_month_id_version_key" ON "energy_month_versions"("energy_month_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "business_checks_org_id_key" ON "business_checks"("org_id");

-- AddForeignKey
ALTER TABLE "energy_month_versions" ADD CONSTRAINT "energy_month_versions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_month_versions" ADD CONSTRAINT "energy_month_versions_energy_month_id_fkey" FOREIGN KEY ("energy_month_id") REFERENCES "energy_months"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_checks" ADD CONSTRAINT "business_checks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

