import { RedisClientService } from '../cache/RedisClient.js';
import { logger } from '../../core/Logger.js';

export interface QueueJob<T = any> {
  id: string;
  name: string;
  data: T;
  timestamp: number;
}

/**
 * Simple Redis-based Job Queue for decoupling tasks
 * (e.g., Giveaways, Ticket transcriptions)
 */
export class JobQueue {
  constructor(private readonly queueName: string) {}

  /**
   * Add a job to the queue
   */
  public async add<T>(name: string, data: T): Promise<string> {
    const redis = RedisClientService.getInstance();
    const id = crypto.randomUUID();
    const job: QueueJob<T> = {
      id,
      name,
      data,
      timestamp: Date.now(),
    };

    await redis.lpush(`queue:${this.queueName}`, JSON.stringify(job));
    logger.debug({ queue: this.queueName, jobId: id, jobName: name }, 'Job added to queue');
    return id;
  }

  /**
   * Process jobs from the queue
   */
  public async process<T>(
    handler: (job: QueueJob<T>) => Promise<void>,
    options: { batchSize?: number; pollInterval?: number } = {}
  ): Promise<void> {
    const redis = RedisClientService.getInstance();
    const batchSize = options.batchSize || 1;
    const pollInterval = options.pollInterval || 1000;

    const runLoop = async () => {
      try {
        // RPOP is atomic
        const rawJob = await redis.rpop(`queue:${this.queueName}`);

        if (rawJob) {
          const job: QueueJob<T> = JSON.parse(rawJob);
          logger.debug({ queue: this.queueName, jobId: job.id }, 'Processing job');
          
          try {
            await handler(job);
            logger.debug({ queue: this.queueName, jobId: job.id }, 'Job completed');
          } catch (error) {
            logger.error({ queue: this.queueName, jobId: job.id, error }, 'Job failed');
            // Basic retry logic: push back to head (LIFO for retry) or tail
            // await redis.lpush(`queue:${this.queueName}`, rawJob);
          }
          
          // Process next immediately
          setImmediate(runLoop);
        } else {
          // Wait if empty
          setTimeout(runLoop, pollInterval);
        }
      } catch (error) {
        logger.error({ queue: this.queueName, error }, 'Queue processing error');
        setTimeout(runLoop, pollInterval);
      }
    };

    runLoop();
    logger.info({ queue: this.queueName }, 'Queue processor started');
  }
}
