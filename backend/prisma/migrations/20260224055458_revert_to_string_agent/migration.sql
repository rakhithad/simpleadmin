/*
  Warnings:

  - You are about to drop the column `agent_id` on the `commission_ledger` table. All the data in the column will be lost.
  - Added the required column `agent_name` to the `commission_ledger` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "commission_ledger" DROP CONSTRAINT "commission_ledger_agent_id_fkey";

-- AlterTable
ALTER TABLE "commission_ledger" DROP COLUMN "agent_id",
ADD COLUMN     "agent_name" TEXT NOT NULL;
