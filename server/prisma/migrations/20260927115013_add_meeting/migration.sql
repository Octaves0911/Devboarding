-- CreateTable
CREATE TABLE "Meeting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizerId" INTEGER NOT NULL,
    "inviteeId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "meetingLink" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "Meeting_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Meeting_organizerId_startAt_idx" ON "Meeting"("organizerId", "startAt");

-- CreateIndex
CREATE INDEX "Meeting_inviteeId_startAt_idx" ON "Meeting"("inviteeId", "startAt");

-- CreateIndex
CREATE INDEX "Meeting_inviteeId_status_idx" ON "Meeting"("inviteeId", "status");
