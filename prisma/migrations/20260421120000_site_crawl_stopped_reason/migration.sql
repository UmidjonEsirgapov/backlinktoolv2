-- AlterTable
ALTER TABLE "Site" ADD COLUMN "crawlStoppedReason" TEXT;

-- Avvalgi crawl: limit tufayli to'xtagan saytlarni belgilash (pagesQueued > pagesCrawled)
UPDATE "Site" SET "crawlStoppedReason" = 'PAGE_LIMIT'
WHERE "status" = 'DONE' AND "pagesQueued" > "pagesCrawled";
