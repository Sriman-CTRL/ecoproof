-- AlterTable
ALTER TABLE "energy_months" ADD COLUMN     "export_kwh" DECIMAL(14,2),
ADD COLUMN     "solar_installed_kwp" DECIMAL(8,2);

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "roof_area_m2" DECIMAL(10,2);
