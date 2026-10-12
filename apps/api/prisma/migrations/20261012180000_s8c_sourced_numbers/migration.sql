-- DropIndex
DROP INDEX "tariff_rules_discom_category_rule_type_key";

-- AlterTable
ALTER TABLE "action_library" ADD COLUMN     "cost_note" TEXT,
ADD COLUMN     "cost_year" TEXT,
ADD COLUMN     "enduse_share_high" DECIMAL(5,4),
ADD COLUMN     "enduse_share_low" DECIMAL(5,4),
ADD COLUMN     "enduse_share_note" TEXT,
ADD COLUMN     "page" TEXT,
ADD COLUMN     "quoted_line" TEXT,
ADD COLUMN     "saving_note" TEXT;

-- AlterTable
ALTER TABLE "factors" ADD COLUMN     "page" TEXT,
ADD COLUMN     "quoted_line" TEXT,
ADD COLUMN     "valid_to" DATE;

-- AlterTable
ALTER TABLE "tariff_rules" ADD COLUMN     "page" TEXT,
ADD COLUMN     "quoted_line" TEXT,
ADD COLUMN     "source_url" TEXT,
ADD COLUMN     "version" TEXT NOT NULL DEFAULT 'legacy';

-- CreateIndex
CREATE UNIQUE INDEX "tariff_rules_discom_category_rule_type_version_key" ON "tariff_rules"("discom", "category", "rule_type", "version");

