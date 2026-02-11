-- CreateEnum
CREATE TYPE "InstalmentType" AS ENUM ('INSTALMENT', 'SETTLEMENT');

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "folder_no" TEXT NOT NULL,
    "ref_no" TEXT NOT NULL,
    "pax_name" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "team_name" "Teams",
    "num_pax" INTEGER NOT NULL,
    "pnr" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "from_to" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "pc_date" TIMESTAMP(3) NOT NULL,
    "travel_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "description" TEXT,
    "approved_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initial_payments" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_method" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalments" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "expected_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" "InstalmentType" NOT NULL DEFAULT 'INSTALMENT',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instalments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passengers" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "title" "Title" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "category" "PassengerCategory" NOT NULL,
    "middle_name" TEXT,
    "email" TEXT,
    "contact_no" TEXT,
    "nationality" TEXT,
    "birthday" TIMESTAMP(3),

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_costs" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "supplier" "Supplier" NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT,

    CONSTRAINT "supplier_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_folder_no_key" ON "bookings"("folder_no");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initial_payments" ADD CONSTRAINT "initial_payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_costs" ADD CONSTRAINT "supplier_costs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
