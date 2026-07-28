-- Introduce the model-judged Feynman flow without rewriting existing sessions.
-- Existing rows stay on flowVersion=1; newly-created sessions explicitly use version 2.

ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'needs_work';

ALTER TABLE "FeynmanSession"
  ADD COLUMN IF NOT EXISTS "flowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "judgments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "finalJudgment" JSONB,
  ADD COLUMN IF NOT EXISTS "processingRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3);
