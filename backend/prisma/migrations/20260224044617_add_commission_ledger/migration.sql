-- CreateTable
CREATE TABLE "commission_ledger" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "folder_no" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "reference" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "snapshot_profit" DOUBLE PRECISION NOT NULL,
    "month" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_ledger_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
