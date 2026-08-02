# Discord Bot - Enterprise Architecture

A production-ready Discord bot built with **@discordjs/core**, TypeScript, and enterprise-grade architecture patterns.

## 🚀 Features

- ✅ **Enterprise Architecture**: SOLID principles, DI Container, Repository Pattern
- ✅ **@discordjs/core**: Modern Discord API v10 implementation
- ✅ **TypeScript 5+**: Full type safety
- ✅ **Database**: PostgreSQL with Prisma ORM 7
- ✅ **Caching**: Redis with namespacing and TTL support
- ✅ **Validation**: Zod for environment and data validation
- ✅ **Logging**: Structured logging with Pino
- ✅ **Command System**: Auto-discovery of subcommands and groups
- ✅ **Event System**: Type-safe Discord event handling
- ✅ **Graceful Shutdown**: Proper cleanup of connections
- ✅ **Sharding Support**: Built-in sharding manager for scaling
- ✅ **Cooldown System**: Per-command cooldowns to prevent abuse

## 📋 Prerequisites

- Node.js 20+
- pnpm (package manager)
- PostgreSQL database
- Redis server

## 🛠️ Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd discordcore
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Setup environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration:

   - `DISCORD_TOKEN`: Your Discord bot token
   - `DISCORD_CLIENT_ID`: Your Discord application ID
   - `DATABASE_URL`: PostgreSQL connection string
   - `REDIS_URL`: Redis connection string
   - `DEVELOPMENT_GUILD_ID`: (optional) Guild ID for instant command registration during dev

4. **Generate Prisma client**

   ```bash
   pnpm db:generate
   ```

5. **Push database schema**
   ```bash
   pnpm db:push
   # OR for migrations:
   pnpm db:migrate
   ```

## 🎯 Usage

### Development

```bash
pnpm dev
```

### Production

```bash
# Build the project
pnpm build

# Start the bot (Single Process - Recommended for < 2500 guilds)
pnpm start

# Start with Sharding (Multi-Process - For massive scale)
pnpm start:shards
```

### Register Slash Commands

Commands are registered on startup via the `DEVELOPMENT_GUILD_ID` env var (guild commands, instant) or globally (production, ~1 hour propagation).

To override the development guild:

```bash
DEVELOPMENT_GUILD_ID=123456789012345678 pnpm dev
```

## 📁 Project Structure

```
src/
├── index.ts                    # Entry point
├── sharding.ts                 # Sharding manager
├── client/
│   ├── Bot.ts                  # Main bot client
│   └── types.ts                # Client types
├── core/
│   ├── Container.ts            # DI Container
│   ├── Logger.ts               # Pino logger
│   └── Config.ts               # Zod-validated config
├── infrastructure/
│   ├── database/
│   │   ├── prisma.ts           # Prisma singleton
│   │   └── repositories/       # Data access layer
│   ├── cache/
│   │   ├── RedisClient.ts      # Redis connection
│   │   └── CacheService.ts     # Cache abstraction
│   └── queue/
│       └── JobQueue.ts         # Redis-based job queue
├── modules/
│   ├── commands/
│   │   ├── BaseCommand.ts      # Command base class (with cooldowns)
│   │   ├── CommandHandler.ts   # Command orchestrator
│   │   ├── CommandRegistry.ts  # Command storage
│   │   └── impl/               # Command implementations
│   ├── components/
│   │   ├── ComponentHandler.ts # Button/modal handler
│   │   ├── ComponentRegistry.ts# Persistent component storage
│   │   └── impl/               # Component implementations
│   ├── events/
│   │   ├── BaseEvent.ts        # Event base class
│   │   ├── EventHandler.ts     # Event orchestrator
│   │   └── impl/               # Event implementations
│   └── systems/
│       ├── BaseSystem.ts       # System base class
│       ├── SystemManager.ts    # System lifecycle manager
│       └── impl/               # System implementations
└── shared/
    ├── errors/                 # Custom error classes
    ├── types/                  # Shared types
    └── utils/                  # Utilities
```

## 📋 Registered Commands

The following commands are **actively registered** as Discord slash commands:

| Command | Description |
|---------|-------------|
| `/ping` | Bot latency check |
| `/reload` | Hot-reload commands (admin only) |
| `/test-components` | Test button/modal interactions |
| `/guild level top` | Show top leveling users (server-level) |
| `/guild level show` | Show your leveling stats |
| `/config message welcomecard` | Configure welcome card settings |
| `/config moderation spamming` | Toggle anti-spam protection |
| `/config moderation links` | Toggle anti-links protection |
| `/config moderation nsfw` | Toggle anti-NSFW protection |
| `/config moderation logchannel` | Set moderation log channel |
| `/config leveling toggle` | Enable/disable leveling system |
| `/config leveling xp-rate` | Set XP rate multiplier |
| `/config leveling reset-user` | Reset a user's XP |
| `/config leveling set-level` | Set a user's level |
| `/config leveling role-reward` | Set level-locked role rewards |

## 📋 Available but Not Registered

The following commands have implementation code but are **not yet registered** as Discord slash commands:

| Command | File | Reason |
|---------|------|--------|
| (unregistered commands) | `src/modules/commands/impl/` | Need registration in `src/index.ts` |

To register a command, add it to the bootstrap function in `src/index.ts`:

```typescript
import { MyCommand } from "#modules/commands/impl/mycommand.js";
commandRegistry.register(new MyCommand());
```

## 🔧 Adding New Commands

### Simple Command

```typescript
// src/modules/commands/impl/mycommand.ts
import { BaseCommand } from "../BaseCommand.js";
import type { CommandContext } from "../../shared/types/discord.js";

export class MyCommand extends BaseCommand {
  public readonly meta = {
    name: "mycommand",
    description: "My custom command",
    category: "general",
    cooldown: 5, // seconds
  };

  async execute(context: CommandContext): Promise<void> {
    // Your command logic
  }
}
```

Then register in `src/index.ts`:

```typescript
import { MyCommand } from "./modules/commands/impl/mycommand.js";
commandRegistry.register(new MyCommand());
```

### Command with Subcommands

```typescript
// Parent command
const parentCommand = new ParentCommand();

// Register subcommands
parentCommand.registerSubcommand(new SubcommandA());
parentCommand.registerSubcommandGroup("groupname", new SubcommandB());

commandRegistry.register(parentCommand);
```

### Cooldowns

Commands can define a `cooldown` (in seconds) in their metadata. The `CommandHandler` automatically checks cooldowns before execution and sets them after successful execution.

```typescript
public readonly meta = {
  name: "mycommand",
  description: "My custom command",
  cooldown: 10, // 10 second cooldown per user
};
```

## 🎪 Adding New Events

```typescript
// src/modules/events/impl/myevent.ts
import { BaseEvent } from "../BaseEvent.js";

export class MyEvent extends BaseEvent<TEventData> {
  public readonly name = "EVENT_NAME"; // Discord Gateway event
  public readonly once = false;

  async execute(data: TEventData): Promise<void> {
    // Your event logic
  }
}
```

Register in `src/index.ts`:

```typescript
import { MyEvent } from "./modules/events/impl/myevent.js";
eventHandler.register(new MyEvent());
```

## 📊 Database Management

```bash
# Generate Prisma Client
pnpm db:generate

# Push schema to database (for development)
pnpm db:push

# Create and run migrations (for production)
pnpm db:migrate

# Open Prisma Studio (database GUI)
pnpm db:studio
```

## 🔍 Development Tools

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build for production
pnpm build

# Run smoke tests
pnpm test
```

## 🏗️ Architecture Patterns

### Dependency Injection

Services are registered in the DI container and resolved as needed:

```typescript
container.registerSingleton("ServiceName", () => new Service());
const service = await container.resolve<Service>("ServiceName");
```

### Repository Pattern

Database access is abstracted through repositories:

```typescript
const guildRepo = await container.resolve<GuildRepository>("GuildRepository");
const guild = await guildRepo.findById(guildId);
```

### Cache-Aside Pattern

```typescript
const data = await cacheService.getOrSet(
  "cache-key",
  async () => await fetchFromDatabase(),
  { ttl: 3600 }
);
```

### Systems Module

Decoupled logic for background tasks or complex features:

```typescript
// src/modules/systems/impl/MySystem.ts
export class MySystem extends BaseSystem {
  async onInit() {
    // Initialize system
  }
}
```

### Moderation Queue

The ModerationSystem includes a FIFO queue for bulk moderation operations (bans, kicks, mutes). Enqueue actions and process them sequentially:

```typescript
const system = bot.getSystemManager().get<ModerationSystem>('ModerationSystem');
system.enqueueModeration({ type: 'ban', userId: '123', reason: 'Spam' });
const results = await system.processQueue(api);
```

## 🚦 Environment Variables

| Variable            | Description    | Required | Default       |
| ------------------- | -------------- | -------- | ------------- |
| `NODE_ENV`          | Environment    | No       | `development` |
| `DISCORD_TOKEN`     | Bot token      | Yes      | -             |
| `DISCORD_CLIENT_ID` | Application ID | Yes      | -             |
| `DATABASE_URL`      | PostgreSQL URL | Yes      | -             |
| `REDIS_URL`         | Redis URL      | Yes      | -             |
| `LOG_LEVEL`         | Logging level  | No       | `info`        |
| `DEVELOPMENT_GUILD_ID` | Dev guild for instant command registration | No | Hardcoded fallback |
| `SHARDS`            | Total shards (set by sharding manager) | No | 1 |
| `SHARD_ID`          | Shard ID (set by sharding manager) | No | 0 |

## 🐳 Docker

```bash
# Build the Docker image
pnpm docker:build

# Run the container
pnpm docker:run
```

## 🚦 CI/CD

This project uses GitHub Actions with the following pipeline:

- **lint** — runs ESLint on the `src/` directory
- **typecheck** — runs `tsc --noEmit`
- **build** — compiles TypeScript (depends on lint and typecheck passing)
- **test** — runs Node.js smoke tests (depends on build)

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request