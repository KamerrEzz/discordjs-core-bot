import { GatewayIntentBits } from '@discordjs/core';
import { Bot } from '#client/Bot.js';
import { config } from '#core/Config.js';
import { logger } from '#core/Logger.js';

// Import and register events
import { eventHandler } from '#modules/events/EventHandler.js';
import { ReadyEvent } from '#modules/events/impl/ready.js';
import { GuildCreateEvent } from '#modules/events/impl/guildCreate.js';
import { InteractionCreateEvent } from '#modules/events/impl/interactionCreate.js';
import { MessageCreateEvent } from '#modules/events/impl/messageCreate.js';

// Import and register commands
import { commandRegistry } from '#modules/commands/CommandRegistry.js';
import { PingCommand } from '#modules/commands/impl/util/ping.js';
import { ConfigCommand } from '#modules/commands/impl/config/index.js';
import { WelcomeCardSubcommand } from '#modules/commands/impl/config/message/welcomecard.js';

// Moderation subcommands
import { SpammingSubcommand } from '#modules/commands/impl/config/moderation/spamming.js';
import { LinksSubcommand } from '#modules/commands/impl/config/moderation/links.js';
import { NsfwSubcommand } from '#modules/commands/impl/config/moderation/nsfw.js';
import { LogChannelSubcommand } from '#modules/commands/impl/config/moderation/logchannel.js';

/**
 * Bootstrap the bot
 */
async function bootstrap() {
  try {
    logger.info('🚀 Bootstrapping bot...');

    // Register events
    eventHandler.register(new ReadyEvent());
    eventHandler.register(new GuildCreateEvent());
    eventHandler.register(new InteractionCreateEvent());
    eventHandler.register(new MessageCreateEvent());
    logger.info('✅ Events registered');

    // Register commands
    commandRegistry.register(new PingCommand());
    
    // Register config command with subcommand groups
    const configCommand = new ConfigCommand();
    
    // Message group: /config message welcomecard
    configCommand.registerSubcommandGroup('message', new WelcomeCardSubcommand());
    
    // Moderation group: /config moderation spamming|links|nsfw|logchannel
    configCommand.registerSubcommandGroup('moderation', new SpammingSubcommand());
    configCommand.registerSubcommandGroup('moderation', new LinksSubcommand());
    configCommand.registerSubcommandGroup('moderation', new NsfwSubcommand());
    configCommand.registerSubcommandGroup('moderation', new LogChannelSubcommand());
    
    commandRegistry.register(configCommand);
    
    logger.info('✅ Commands registered');

    // Create bot instance
    const bot = new Bot({
      token: config.get('DISCORD_TOKEN'),
      intents:
        GatewayIntentBits.Guilds |
        GatewayIntentBits.GuildMembers |
        GatewayIntentBits.GuildMessages |
        GatewayIntentBits.MessageContent, // Required for reading message content
    });

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');
      await bot.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('unhandledRejection', (error) => {
      logger.error({ error }, 'Unhandled promise rejection');
    });

    process.on('uncaughtException', (error) => {
      logger.error({ error }, 'Uncaught exception');
      process.exit(1);
    });

    // Start the bot
    await bot.start();

    // Register commands with Discord (optional: pass guildId for instant updates during dev)
    // For production, remove the guildId parameter to register globally
    // await bot.registerCommands('739306480586588241');
    
    logger.info('💡 Tip: Run bot.registerCommands(guildId) to register slash commands');
  } catch (error) {
    logger.fatal({ error }, 'Failed to bootstrap bot');
    process.exit(1);
  }
}

// Start the application
bootstrap();
