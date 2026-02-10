-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONSULTANT', 'MANAGEMENT', 'SUPER_MANAGER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Teams" AS ENUM ('PH', 'TOURS', 'MARKETING', 'QC', 'IT');

-- CreateEnum
CREATE TYPE "Title" AS ENUM ('MR', 'MRS', 'MS', 'DR', 'PROF');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FRESH', 'DATE_CHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FULL', 'INTERNAL');

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "PassengerCategory" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" "Title",
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "contact_no" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CONSULTANT',
    "team" "Teams",
    "password" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_bookings" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "pax_name" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "team_name" "Teams",
    "pnr" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "from_to" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "booking_status" "BookingStatus",
    "pc_date" TIMESTAMP(3) NOT NULL,
    "issued_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "last_payment_date" TIMESTAMP(3),
    "travel_date" TIMESTAMP(3),
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "invoice" TEXT,
    "description" TEXT,
    "status" "PendingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "num_pax" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,

    CONSTRAINT "pending_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_initial_payments" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_method" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "pending_booking_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_initial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_instalments" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_instalments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_passengers" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "title" "Title" NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "email" TEXT,
    "contact_no" TEXT,
    "nationality" TEXT,
    "birthday" TIMESTAMP(3),
    "category" "PassengerCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "pending_bookings" ADD CONSTRAINT "pending_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_initial_payments" ADD CONSTRAINT "pending_initial_payments_pending_booking_id_fkey" FOREIGN KEY ("pending_booking_id") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_instalments" ADD CONSTRAINT "pending_instalments_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_passengers" ADD CONSTRAINT "pending_passengers_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
