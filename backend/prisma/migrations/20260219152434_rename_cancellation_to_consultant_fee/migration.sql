/*
  Warnings:

  - You are about to drop the column `cancellation_fee` on the `bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "cancellation_fee",
ADD COLUMN     "consultant_fee" DOUBLE PRECISION DEFAULT 0;
