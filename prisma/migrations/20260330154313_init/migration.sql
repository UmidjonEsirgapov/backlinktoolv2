-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "pagesQueued" INTEGER NOT NULL DEFAULT 0,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "pagesError" INTEGER NOT NULL DEFAULT 0,
    "externalLinksFound" INTEGER NOT NULL DEFAULT 0,
    "uzDomainsFound" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "statusCode" INTEGER,
    "redirectTo" TEXT,
    "crawledAt" DATETIME,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Page_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "domain" TEXT NOT NULL,
    "isUz" BOOLEAN NOT NULL DEFAULT false,
    "saleStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "evidence" TEXT,
    "rdapRaw" TEXT,
    "httpStatus" INTEGER,
    "dnsResolved" BOOLEAN,
    "daScore" INTEGER,
    "lastChecked" DATETIME,
    "checkError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SiteExternalDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "externalDomainId" TEXT NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteExternalDomain_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SiteExternalDomain_externalDomainId_fkey" FOREIGN KEY ("externalDomainId") REFERENCES "ExternalDomain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DomainLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalDomainId" TEXT NOT NULL,
    "sourcePageUrl" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "anchor" TEXT,
    "rel" TEXT,
    "linkType" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainLink_externalDomainId_fkey" FOREIGN KEY ("externalDomainId") REFERENCES "ExternalDomain" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CrawlLog_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JobQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorMsg" TEXT,
    "workerKey" TEXT,
    "scheduledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");

-- CreateIndex
CREATE INDEX "Page_siteId_status_idx" ON "Page"("siteId", "status");

-- CreateIndex
CREATE INDEX "Page_siteId_depth_idx" ON "Page"("siteId", "depth");

-- CreateIndex
CREATE UNIQUE INDEX "Page_siteId_normalizedUrl_key" ON "Page"("siteId", "normalizedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalDomain_domain_key" ON "ExternalDomain"("domain");

-- CreateIndex
CREATE INDEX "SiteExternalDomain_siteId_idx" ON "SiteExternalDomain"("siteId");

-- CreateIndex
CREATE INDEX "SiteExternalDomain_externalDomainId_idx" ON "SiteExternalDomain"("externalDomainId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteExternalDomain_siteId_externalDomainId_key" ON "SiteExternalDomain"("siteId", "externalDomainId");

-- CreateIndex
CREATE INDEX "DomainLink_externalDomainId_idx" ON "DomainLink"("externalDomainId");

-- CreateIndex
CREATE INDEX "CrawlLog_siteId_idx" ON "CrawlLog"("siteId");

-- CreateIndex
CREATE INDEX "CrawlLog_level_idx" ON "CrawlLog"("level");

-- CreateIndex
CREATE INDEX "CrawlLog_createdAt_idx" ON "CrawlLog"("createdAt");

-- CreateIndex
CREATE INDEX "JobQueue_status_scheduledAt_idx" ON "JobQueue"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "JobQueue_type_status_idx" ON "JobQueue"("type", "status");
