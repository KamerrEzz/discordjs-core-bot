import pino from 'pino';
import { config } from './Config.js';

const logger = pino({
  level: config.get('LOG_LEVEL'),
  transport: config.get('NODE_ENV') === 'development' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export { logger };
