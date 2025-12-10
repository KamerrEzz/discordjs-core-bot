import { AppError, ErrorCode } from './AppError.js';

export class CommandError extends AppError {
  constructor(message: string, details?: any) {
    super(ErrorCode.COMMAND_NOT_FOUND, message, details);
    this.name = 'CommandError';
  }
}

export class CommandCooldownError extends AppError {
  constructor(
    public readonly timeLeft: number,
    message: string = 'Command is on cooldown'
  ) {
    super(ErrorCode.COMMAND_COOLDOWN, message, { timeLeft });
    this.name = 'CommandCooldownError';
  }
}

export class MissingPermissionsError extends AppError {
  constructor(
    public readonly required: string[],
    message: string = 'Missing required permissions'
  ) {
    super(ErrorCode.MISSING_PERMISSIONS, message, { required });
    this.name = 'MissingPermissionsError';
  }
}
