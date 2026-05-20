-- Add intensityPoints to WorkoutLog
ALTER TABLE "WorkoutLog" ADD COLUMN "intensityPoints" INTEGER NOT NULL DEFAULT 0;

-- LeaderboardGroup
CREATE TABLE "LeaderboardGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "privacy" TEXT NOT NULL DEFAULT 'private',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaderboardGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaderboardGroup_createdBy_idx" ON "LeaderboardGroup"("createdBy");
ALTER TABLE "LeaderboardGroup" ADD CONSTRAINT "LeaderboardGroup_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LeaderboardGroupMember
CREATE TABLE "LeaderboardGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'client',
  "trainerId" TEXT,
  "includeInRank" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaderboardGroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaderboardGroupMember_groupId_userId_key" ON "LeaderboardGroupMember"("groupId", "userId");
CREATE INDEX "LeaderboardGroupMember_groupId_idx" ON "LeaderboardGroupMember"("groupId");
CREATE INDEX "LeaderboardGroupMember_userId_idx" ON "LeaderboardGroupMember"("userId");
ALTER TABLE "LeaderboardGroupMember" ADD CONSTRAINT "LeaderboardGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeaderboardGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaderboardGroupMember" ADD CONSTRAINT "LeaderboardGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LeaderboardGroupInvite
CREATE TABLE "LeaderboardGroupInvite" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "inviteeId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaderboardGroupInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaderboardGroupInvite_groupId_inviteeId_key" ON "LeaderboardGroupInvite"("groupId", "inviteeId");
CREATE INDEX "LeaderboardGroupInvite_groupId_idx" ON "LeaderboardGroupInvite"("groupId");
CREATE INDEX "LeaderboardGroupInvite_inviteeId_idx" ON "LeaderboardGroupInvite"("inviteeId");
ALTER TABLE "LeaderboardGroupInvite" ADD CONSTRAINT "LeaderboardGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LeaderboardGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaderboardGroupInvite" ADD CONSTRAINT "LeaderboardGroupInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeaderboardGroupInvite" ADD CONSTRAINT "LeaderboardGroupInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
