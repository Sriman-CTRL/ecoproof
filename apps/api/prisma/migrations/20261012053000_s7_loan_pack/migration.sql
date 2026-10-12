-- AlterTable
ALTER TABLE "reports" DROP COLUMN "snapshot_json",
ADD COLUMN     "version" INTEGER NOT NULL,
ALTER COLUMN "file_key" SET NOT NULL,
ALTER COLUMN "sha256" SET NOT NULL;

-- AlterTable
ALTER TABLE "shares" ADD COLUMN     "revoked_at" TIMESTAMP(3),
ADD COLUMN     "token_hash" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "report_snapshots" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "action_code" TEXT,
    "inputs_json" JSONB NOT NULL,
    "results_json" JSONB NOT NULL,
    "factor_ids" UUID[],
    "formula_version" TEXT NOT NULL,
    "data_quality_score" DECIMAL(6,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_views" (
    "id" UUID NOT NULL,
    "org_id" UUID NOT NULL,
    "share_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,

    CONSTRAINT "share_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_snapshots_org_id_idx" ON "report_snapshots"("org_id");

-- CreateIndex
CREATE INDEX "report_snapshots_site_id_type_action_code_idx" ON "report_snapshots"("site_id", "type", "action_code");

-- CreateIndex
CREATE INDEX "share_views_org_id_idx" ON "share_views"("org_id");

-- CreateIndex
CREATE INDEX "share_views_share_id_idx" ON "share_views"("share_id");

-- CreateIndex
CREATE UNIQUE INDEX "reports_snapshot_id_key" ON "reports"("snapshot_id");

-- CreateIndex
CREATE UNIQUE INDEX "shares_token_hash_key" ON "shares"("token_hash");

-- CreateIndex
CREATE INDEX "shares_report_id_idx" ON "shares"("report_id");

-- AddForeignKey
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_snapshots" ADD CONSTRAINT "report_snapshots_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "report_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_views" ADD CONSTRAINT "share_views_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_views" ADD CONSTRAINT "share_views_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "shares"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

