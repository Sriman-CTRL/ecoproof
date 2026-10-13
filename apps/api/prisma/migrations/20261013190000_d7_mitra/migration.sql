-- D7 Mitra (13 Oct 2026). ADDITIVE ONLY: the old women_sc_st_owned column stays (deprecated) so the live API keeps working until redeploy.
-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "sc_st_owned" BOOLEAN,
ADD COLUMN     "women_owned" BOOLEAN;

-- CreateTable
CREATE TABLE "mitra_items" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "run_by" TEXT NOT NULL,
    "free_help" TEXT NOT NULL,
    "business_gain" TEXT NOT NULL,
    "carbon_line" TEXT,
    "how_to_start" TEXT NOT NULL,
    "url" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "address" TEXT,
    "kind" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "quoted_line" TEXT NOT NULL,
    "last_checked" DATE NOT NULL,
    "dates_unconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mitra_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mitra_steps" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "item_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "proof_file_key" TEXT,
    "proof_sha256" TEXT,
    "proof_type" TEXT,
    "proof_note" TEXT,
    "event_date" DATE,
    "pack_report_id" UUID,
    "certificate_report_id" UUID,
    "started_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mitra_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "peer_cases" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "action_code" TEXT,
    "measure" TEXT NOT NULL,
    "investment_text" TEXT NOT NULL,
    "saving_text" TEXT,
    "payback_text" TEXT NOT NULL,
    "before_after_text" TEXT,
    "source" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "page" TEXT,
    "quoted_line" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "peer_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mitra_items_code_key" ON "mitra_items"("code");

-- CreateIndex
CREATE INDEX "mitra_steps_org_id_idx" ON "mitra_steps"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "mitra_steps_org_id_site_id_item_code_key" ON "mitra_steps"("org_id", "site_id", "item_code");

-- CreateIndex
CREATE UNIQUE INDEX "peer_cases_code_key" ON "peer_cases"("code");

-- AddForeignKey
ALTER TABLE "mitra_steps" ADD CONSTRAINT "mitra_steps_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mitra_steps" ADD CONSTRAINT "mitra_steps_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Copy the old combined flag into both new flags.
UPDATE "organisations" SET "women_owned" = "women_sc_st_owned", "sc_st_owned" = "women_sc_st_owned" WHERE "women_sc_st_owned" IS NOT NULL;
