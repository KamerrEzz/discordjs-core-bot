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

// Leveling subcommands
import { LevelingCommand } from '#modules/commands/impl/config/leveling/index.js';
import { LevelingToggleSubcommand } from '#modules/commands/impl/config/leveling/toggle.js';
import { LevelingXpRateSubcommand } from '#modules/commands/impl/config/leveling/xp-rate.js';
import { LevelingResetUserSubcommand } from '#modules/commands/impl/config/leveling/reset-user.js';
import { LevelingSetLevelSubcommand } from '#modules/commands/impl/config/leveling/set-level.js';
import { LevelingRoleRewardSubcommand } from '#modules/commands/impl/config/leveling/role-reward.js';

// Guild commands
import { GuildLevelCommand } from '#modules/commands/impl/guild/index.js';
import { GuildLevelTopCommand } from '#modules/commands/impl/guild/level/top.js';
import { GuildLevelShowCommand } from '#modules/commands/impl/guild/level/show.js';

// Test commands
import { TestComponentsCommand } from '#modules/commands/impl/test/components.js';

// Import and register persistent components
import { componentRegistry } from '#modules/components/ComponentRegistry.js';
import { ConfirmButtonFactory } from '#modules/components/impl/util/ConfirmButton.js';

// Import systems
import { WelcomeSystem } from './modules/systems/impl/WelcomeSystem.js';
import { ModerationSystem } from './modules/systems/impl/ModerationSystem.js';
import { LevelingSystem } from './modules/systems/impl/LevelingSystem.js';
import { ReloadCommand } from './modules/commands/impl/util/reload.js';

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
    // Note: MessageCreateEvent (Global) is not strictly needed if only systems use it, 
    // but useful for generic logging or other global features.
    // eventHandler.register(new MessageCreateEvent()); 
    logger.info('✅ Events registered');

    // Register commands
    commandRegistry.register(new PingCommand());
    commandRegistry.register(new ReloadCommand());
    commandRegistry.register(new TestComponentsCommand());
    
    // Guild level commands: /guild level top|show
    const guildLevelCommand = new GuildLevelCommand();
    guildLevelCommand.registerSubcommandGroup('level', new GuildLevelTopCommand());
    guildLevelCommand.registerSubcommandGroup('level', new GuildLevelShowCommand());
    commandRegistry.register(guildLevelCommand);
    
    // Register config command with subcommand groups
    const configCommand = new ConfigCommand();
    
    // Message group: /config message welcomecard
    configCommand.registerSubcommandGroup('message', new WelcomeCardSubcommand());
    
    // Moderation group: /config moderation spamming|links|nsfw|logchannel
    configCommand.registerSubcommandGroup('moderation', new NsfwSubcommand());
    configCommand.registerSubcommandGroup('moderation', new LogChannelSubcommand());
    
    // Leveling group: /config leveling toggle|xp-rate|reset-user|set-level|role-reward
    configCommand.registerSubcommandGroup('level',  new LevelingToggleSubcommand());
    configCommand.registerSubcommandGroup('level',  new LevelingXpRateSubcommand());
    configCommand.registerSubcommandGroup('level',  new LevelingResetUserSubcommand());
    configCommand.registerSubcommandGroup('level',  new LevelingSetLevelSubcommand());
    configCommand.registerSubcommandGroup('level',  new LevelingRoleRewardSubcommand());
    
    commandRegistry.register(configCommand);
    
    logger.info('✅ Commands registered');

    // Register persistent components
    componentRegistry.registerFactory(new ConfirmButtonFactory());
    
    logger.info('✅ Persistent components registered');

    // Create bot instance
    const bot = new Bot({
      token: config.get('DISCORD_TOKEN'),
      intents:
        GatewayIntentBits.Guilds |
        GatewayIntentBits.GuildMembers |
        GatewayIntentBits.GuildMessages |
        GatewayIntentBits.MessageContent, // Needed for moderation
    });

    // Start the bot (registra dependencias e inicializa infraestructura)
    await bot.start();

    // Register systems
    await bot.getSystemManager().register(WelcomeSystem);
    await bot.getSystemManager().register(ModerationSystem);
    await bot.getSystemManager().register(LevelingSystem);

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

    // Register commands with Discord (optional: pass guildId for instant updates during dev)
    // For production, remove the guildId parameter to register globally
    await bot.registerCommands('739306480586588241');
    
    logger.info('💡 Tip: Run bot.registerCommands(guildId) to register slash commands');
  } catch (error) {
    logger.fatal({ error }, 'Failed to bootstrap bot');
    process.exit(1);
  }
}

// Start the application
bootstrap();
