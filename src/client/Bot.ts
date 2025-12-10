import { WebSocketManager, WebSocketShardEvents } from '@discordjs/ws';
import { REST } from '@discordjs/rest';
import { 
  API, 
  Client, 
  GatewayDispatchEvents,
  type RESTGetAPIGatewayBotResult,
} from '@discordjs/core';
import type { BotOptions } from './types.js';
import { logger } from '#core/Logger.js';
import { config } from '#core/Config.js';
import { container } from '#core/Container.js';
import { eventHandler } from '#modules/events/EventHandler.js';
import { commandRegistry } from '#modules/commands/CommandRegistry.js';
import { CommandHandler } from '#modules/commands/CommandHandler.js';
import { GuildRepository } from '#infrastructure/database/repositories/GuildRepository.js';
import { PrismaService } from '#infrastructure/database/prisma.js';
import { RedisClientService } from '#infrastructure/cache/RedisClient.js';

/**
 * Main Bot Client
 * Uses @discordjs/core Client for proper event handling with API context
 */
export class Bot {
  private ws: WebSocketManager;
  private rest: REST;
  private api: API;
  private client: Client;
  private isReady = false;

  constructor(private options: BotOptions) {
    this.rest = new REST({ version: '10' }).setToken(options.token);
    this.api = new API(this.rest);
    this.ws = new WebSocketManager({
      token: options.token,
      intents: options.intents,
      rest: this.rest,
    });
    
    // Create Client from @discordjs/core - this wraps REST and Gateway
    // and emits events with { data, api, shardId }
    this.client = new Client({ rest: this.rest, gateway: this.ws });
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting bot...');

      // Connect to infrastructure
      await this.connectInfrastructure();

      // Register dependencies
      await this.registerDependencies();

      // Setup event listeners using Client (not WebSocketManager directly)
      this.setupEventListeners();

      // Connect to Discord Gateway
      await this.ws.connect();

      logger.info('✅ Bot started successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to start bot');
      throw error;
    }
  }

  /**
   * Stop the bot gracefully
   */
  public async stop(): Promise<void> {
    logger.info('Stopping bot...');

    try {
      // Disconnect from Discord
      await this.ws.destroy();

      // Disconnect from infrastructure
      await this.disconnectInfrastructure();

      this.isReady = false;
      logger.info('✅ Bot stopped successfully');
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      throw error;
    }
  }

  /**
   * Connect to database and cache
   */
  private async connectInfrastructure(): Promise<void> {
    logger.info('Connecting to infrastructure...');
    
    try {
      await PrismaService.connect();
      logger.info('✅ Database connected');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
  }

  /**
   * Disconnect from infrastructure
   */
  private async disconnectInfrastructure(): Promise<void> {
    logger.info('Disconnecting from infrastructure...');

    await Promise.all([
      PrismaService.disconnect(),
      RedisClientService.disconnect(),
    ]);

    logger.info('✅ Infrastructure disconnected');
  }

  /**
   * Register dependencies in DI container
   */
  private async registerDependencies(): Promise<void> {
    logger.info('Registering dependencies...');

    // Register repositories
    container.registerSingleton('GuildRepository', () => new GuildRepository());

    // Register handlers
    container.registerSingleton('CommandHandler', () => new CommandHandler());

    logger.info('✅ Dependencies registered');
  }

  /**
   * Setup event listeners using @discordjs/core Client
   * The Client emits events with { data, api, shardId } context
   */
  private setupEventListeners(): void {
    logger.info('Setting up event listeners...');

    // Use client.on() instead of ws.on() - this gives us the API in each event
    // All gateway dispatch events are forwarded to our EventHandler
    this.client.on(GatewayDispatchEvents.Ready, async (event) => {
      this.isReady = true;
      logger.info({ shardId: event.shardId }, 'Shard ready');
      await eventHandler.dispatch('READY', event);
    });

    this.client.on(GatewayDispatchEvents.GuildCreate, async (event) => {
      await eventHandler.dispatch('GUILD_CREATE', event);
    });

    this.client.on(GatewayDispatchEvents.GuildDelete, async (event) => {
      await eventHandler.dispatch('GUILD_DELETE', event);
    });

    this.client.on(GatewayDispatchEvents.InteractionCreate, async (event) => {
      // event contains { data, api, shardId }
      await eventHandler.dispatch('INTERACTION_CREATE', event);
    });

    this.client.on(GatewayDispatchEvents.MessageCreate, async (event) => {
      await eventHandler.dispatch('MESSAGE_CREATE', event);
    });

    // WebSocket error handling (still use ws for these low-level events)
    this.ws.on(WebSocketShardEvents.Error, (error) => {
      logger.error({ error }, 'WebSocket error');
    });

    logger.info('✅ Event listeners configured');
  }

  /**
   * Register commands with Discord
   */
  public async registerCommands(guildId?: string): Promise<void> {
    const commandHandler = await container.resolve<CommandHandler>('CommandHandler');
    await commandHandler.registerCommands(this.api, guildId);
  }

  /**
   * Get API instance
   */
  public getAPI(): API {
    return this.api;
  }

  /**
   * Check if bot is ready
   */
  public get ready(): boolean {
    return this.isReady;
  }
}
