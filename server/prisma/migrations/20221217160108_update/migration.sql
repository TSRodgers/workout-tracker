/*
  Warnings:

  - You are about to drop the column `published` on the `Workout` table. All the data in the column will be lost.
  - You are about to drop the column `viewCount` on the `Workout` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Workout" DROP COLUMN "published",
DROP COLUMN "viewCount";
