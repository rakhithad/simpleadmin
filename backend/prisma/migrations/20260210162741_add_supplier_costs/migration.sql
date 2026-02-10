-- CreateEnum
CREATE TYPE "Supplier" AS ENUM ('BTRES', 'LYCA', 'TRIVAGO', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('FLIGHT', 'HOTEL', 'CRUISE', 'OTHER');

-- CreateTable
CREATE TABLE "pending_supplier_costs" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "supplier" "Supplier" NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT,
    "pending_booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_supplier_costs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_supplier_costs" ADD CONSTRAINT "pending_supplier_costs_pending_booking_id_fkey" FOREIGN KEY ("pending_booking_id") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
