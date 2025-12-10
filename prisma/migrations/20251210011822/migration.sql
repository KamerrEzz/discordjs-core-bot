-- CreateTable
CREATE TABLE "ModerationConfig" (
    "guildId" TEXT NOT NULL,
    "antiSpam" BOOLEAN NOT NULL DEFAULT false,
    "antiLinks" BOOLEAN NOT NULL DEFAULT false,
    "antiNsfw" BOOLEAN NOT NULL DEFAULT false,
    "spamThreshold" INTEGER NOT NULL DEFAULT 5,
    "spamInterval" INTEGER NOT NULL DEFAULT 10,
    "whitelistedUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logChannelId" TEXT,

    CONSTRAINT "ModerationConfig_pkey" PRIMARY KEY ("guildId")
);

-- AddForeignKey
ALTER TABLE "ModerationConfig" ADD CONSTRAINT "ModerationConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
