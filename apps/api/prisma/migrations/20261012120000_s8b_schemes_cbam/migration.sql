-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "cash_profits_last_2y" BOOLEAN,
ADD COLUMN     "commenced_on" DATE,
ADD COLUMN     "gst_registered" BOOLEAN,
ADD COLUMN     "udyam_category" TEXT,
ADD COLUMN     "women_sc_st_owned" BOOLEAN,
ADD COLUMN     "years_in_operation" INTEGER;

-- AlterTable
ALTER TABLE "schemes" ADD COLUMN     "benefit_text" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "quoted_line" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "source_url" TEXT;

-- CreateTable
CREATE TABLE "cbam_cn_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "in_scope_now" BOOLEAN NOT NULL,
    "proposed_from" DATE,
    "india_default_total" DECIMAL(10,3),
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbam_cn_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cbam_markups" (
    "id" UUID NOT NULL,
    "year_from" INTEGER NOT NULL,
    "pct" DECIMAL(5,2) NOT NULL,
    "source" TEXT NOT NULL,
    "source_url" TEXT,
    "quoted_line" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cbam_markups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cbam_cn_codes_code_key" ON "cbam_cn_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cbam_markups_year_from_key" ON "cbam_markups"("year_from");

-- CreateIndex
CREATE UNIQUE INDEX "schemes_code_key" ON "schemes"("code");

