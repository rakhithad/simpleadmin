-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "parent_id" INTEGER;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
