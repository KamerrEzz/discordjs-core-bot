import { AppError, ErrorCode } from './AppError.js';

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.DATABASE_ERROR, message, details);
    this.name = 'DatabaseError';
  }
}

export class DatabaseConnectionError extends AppError {
  constructor(message: string = 'Failed to connect to database', details?: any) {
    super(ErrorCode.DATABASE_CONNECTION_ERROR, message, details);
    this.name = 'DatabaseConnectionError';
  }
}
