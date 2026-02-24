/*
  Warnings:

  - You are about to drop the column `agent_name` on the `commission_ledger` table. All the data in the column will be lost.
  - Added the required column `agent_id` to the `commission_ledger` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "commission_ledger" DROP COLUMN "agent_name",
ADD COLUMN     "agent_id" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
