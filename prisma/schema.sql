-- Uzi database schema. Paste this whole file into the Neon SQL Editor and Run.
-- Identifiers are quoted to match what Prisma expects (case-sensitive).

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Brand" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "campaignType" TEXT NOT NULL DEFAULT 'physical',
  "name" TEXT NOT NULL DEFAULT '',
  "handle" TEXT NOT NULL DEFAULT '',
  "tagline" TEXT NOT NULL DEFAULT '',
  "region" TEXT NOT NULL DEFAULT '',
  "voice" TEXT NOT NULL DEFAULT '',
  "pillars" JSONB NOT NULL DEFAULT '{}',
  "channels" JSONB NOT NULL DEFAULT '{}',
  "inputs" JSONB NOT NULL DEFAULT '{}',
  "cadence" TEXT NOT NULL DEFAULT 'steady',
  "onboarded" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "ScheduleItem" (
  "id" TEXT PRIMARY KEY,
  "brandId" TEXT NOT NULL REFERENCES "Brand"("id") ON DELETE CASCADE,
  "date" TIMESTAMPTZ NOT NULL,
  "pillar" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Asset" (
  "id" TEXT PRIMARY KEY,
  "brandId" TEXT NOT NULL REFERENCES "Brand"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'upload',
  "url" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
