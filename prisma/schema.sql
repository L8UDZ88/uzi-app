-- Uzi database schema. Paste this whole file into the Neon SQL Editor and Run.
-- Identifiers are quoted to match what Prisma expects (case-sensitive).

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT,
  "passwordHash" TEXT NOT NULL,
  "googleRefreshToken" TEXT,
  "googleEmail" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- If the User table already exists, run instead:
-- ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleRefreshToken" TEXT;
-- ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleEmail" TEXT;
-- (The Vercel build runs `prisma db push`, so this applies automatically on deploy.)

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
  "autoDeliver" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "ScheduleItem" (
  "id" TEXT PRIMARY KEY,
  "brandId" TEXT NOT NULL REFERENCES "Brand"("id") ON DELETE CASCADE,
  "date" TIMESTAMPTZ NOT NULL,
  "pillar" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT '',
  "city" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "caption" TEXT,
  "mediaUrl" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "externalUrl" TEXT,
  "publishError" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "SocialConnection" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT,
  "externalId" TEXT,
  "displayName" TEXT,
  "expiresAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("userId", "platform")
);
-- On an existing DB the Vercel build's `prisma db push` adds the new columns/table automatically.
-- Manual equivalent:
-- ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "autoDeliver" BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE "ScheduleItem" ADD COLUMN IF NOT EXISTS "caption" TEXT, ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT,
--   ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS "externalUrl" TEXT, ADD COLUMN IF NOT EXISTS "publishError" TEXT;

CREATE TABLE "RenderAsset" (
  "id" TEXT PRIMARY KEY,
  "mime" TEXT NOT NULL DEFAULT 'audio/mpeg',
  "data" TEXT NOT NULL,
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
