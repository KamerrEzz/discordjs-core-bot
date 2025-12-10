-- CreateTable
CREATE TABLE "LevelingConfig" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "xpPerMessage" INTEGER NOT NULL DEFAULT 10,
    "xpCooldown" INTEGER NOT NULL DEFAULT 60,
    "levelUpMessage" TEXT,
    "roleRewards" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "LevelingConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "LevelingUser" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelingUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LevelingConfig_guildId_idx" ON "LevelingConfig"("guildId");

-- CreateIndex
CREATE INDEX "LevelingUser_guildId_idx" ON "LevelingUser"("guildId");

-- CreateIndex
CREATE INDEX "LevelingUser_userId_idx" ON "LevelingUser"("userId");

-- CreateIndex
CREATE INDEX "LevelingUser_guildId_xp_idx" ON "LevelingUser"("guildId", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "LevelingUser_guildId_userId_key" ON "LevelingUser"("guildId", "userId");

-- AddForeignKey
ALTER TABLE "LevelingConfig" ADD CONSTRAINT "LevelingConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
