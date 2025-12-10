-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT '!',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WelcomeConfig" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" TEXT,
    "cardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cardSettings" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT,

    CONSTRAINT "WelcomeConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "TicketConfig" (
    "guildId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "logChannelId" TEXT,

    CONSTRAINT "TicketConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "staffRoles" TEXT[],

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Guild_id_idx" ON "Guild"("id");

-- CreateIndex
CREATE INDEX "TicketCategory_guildId_idx" ON "TicketCategory"("guildId");

-- AddForeignKey
ALTER TABLE "WelcomeConfig" ADD CONSTRAINT "WelcomeConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "TicketConfig"("guildId") ON DELETE CASCADE ON UPDATE CASCADE;
