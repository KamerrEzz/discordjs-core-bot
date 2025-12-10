import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import { logger } from '../../core/Logger.js';

const connectionString = `${process.env.DATABASE_URL}`;

/**
 * Prisma Service - Manages database connection lifecycle
 */
class PrismaServiceClass {
  private static instance: PrismaClient | null = null;

  /**
   * Get the Prisma client instance (lazily initialized)
   */
  public static getInstance(): PrismaClient {
    if (!PrismaServiceClass.instance) {
      const adapter = new PrismaPg({ connectionString });
      PrismaServiceClass.instance = new PrismaClient({ adapter });
      logger.debug('Prisma client initialized');
    }
    return PrismaServiceClass.instance;
  }

  /**
   * Connect to the database
   */
  public static async connect(): Promise<void> {
    const client = PrismaServiceClass.getInstance();
    await client.$connect();
    logger.info('Database connected');
  }

  /**
   * Disconnect from the database
   */
  public static async disconnect(): Promise<void> {
    if (PrismaServiceClass.instance) {
      await PrismaServiceClass.instance.$disconnect();
      PrismaServiceClass.instance = null;
      logger.info('Database disconnected');
    }
  }
}

// Export singleton instance for easy access
export const prisma = PrismaServiceClass.getInstance();
export const PrismaService = PrismaServiceClass;