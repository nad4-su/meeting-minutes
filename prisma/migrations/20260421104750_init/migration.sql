-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('CREATED', 'UPLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "audioFileName" TEXT,
    "audioMimeType" TEXT,
    "audioDuration" INTEGER,
    "rawTranscript" TEXT,
    "markdownMinutes" TEXT,
    "geminiSummary" TEXT,
    "summaryMode" TEXT,
    "template" TEXT,
    "depth" TEXT,
    "customPrompt" TEXT,
    "attendees" TEXT[],
    "tags" TEXT[],
    "status" "MeetingStatus" NOT NULL DEFAULT 'COMPLETED',

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meetings_createdAt_idx" ON "meetings"("createdAt");
