import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { fork } from 'child_process';
import { config } from './core/Config.js';
import { logger } from './core/Logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Lightweight Sharding Manager
 * Spawns multiple processes of the bot, assigning specific shards to each.
 */
async function bootstrap() {
  const token = config.get('DISCORD_TOKEN');
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    logger.info('Manager fetching gateway information...');
    const gateway = (await rest.get(Routes.gatewayBot())) as {
      url: string;
      shards: number;
      session_start_limit: any;
    };

    const recommendedShards = gateway.shards;
    logger.info({ recommendedShards }, 'Starting sharding manager');

    const shardList = Array.from({ length: recommendedShards }, (_, i) => i);
    const scriptPath = path.join(__dirname, 'index.js');

    for (const shardId of shardList) {
      const env = { 
        ...process.env, 
        SHARDS: recommendedShards.toString(), 
        SHARD_ID: shardId.toString() 
      };
      
      const child = fork(scriptPath, [], { env });
      
      logger.info({ shardId, pid: child.pid }, 'Spawned shard process');

      child.on('exit', (code) => {
        logger.warn({ shardId, code }, 'Shard process exited');
        // Simple restart logic could go here
      });
    }

  } catch (error) {
    logger.error({ error }, 'Failed to start sharding manager');
    process.exit(1);
  }
}

bootstrap();
