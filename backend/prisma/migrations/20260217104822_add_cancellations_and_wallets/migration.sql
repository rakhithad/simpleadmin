-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "cancellation_fee" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "supplier_refund" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "supplier_payments" ADD COLUMN     "supplier_credit_note_id" INTEGER;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "pax_credit_note_id" INTEGER;

-- CreateTable
CREATE TABLE "pax_credit_notes" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "pax_name" TEXT NOT NULL,
    "original_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pax_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_notes" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "supplier" TEXT NOT NULL,
    "original_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_credit_note_id_fkey" FOREIGN KEY ("supplier_credit_note_id") REFERENCES "supplier_credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pax_credit_note_id_fkey" FOREIGN KEY ("pax_credit_note_id") REFERENCES "pax_credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pax_credit_notes" ADD CONSTRAINT "pax_credit_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
