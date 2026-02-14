-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "is_settled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "booking_id" INTEGER NOT NULL,
    "instalment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_instalment_id_fkey" FOREIGN KEY ("instalment_id") REFERENCES "instalments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
