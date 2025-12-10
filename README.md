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

To register commands with Discord, you have two options:

**Guild Commands (Development - Instant)**
Modify `src/index.ts` and uncomment the line:

```typescript
await bot.registerCommands("YOUR_DEV_GUILD_ID_HERE");
```

**Global Commands (Production - Takes ~1 hour)**

```typescript
await bot.registerCommands(); // No guildId parameter
```

## 📁 Project Structure

```
src/
├── index.ts                    # Entry point
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
│   └── cache/
│       ├── RedisClient.ts      # Redis connection
│       └── CacheService.ts     # Cache abstraction
├── modules/
│   ├── commands/
│   │   ├── BaseCommand.ts      # Command base class
│   │   ├── CommandHandler.ts   # Command orchestrator
│   │   ├── CommandRegistry.ts  # Command storage
│   │   └── impl/               # Command implementations
│   └── events/
│       ├── BaseEvent.ts        # Event base class
│       ├── EventHandler.ts     # Event orchestrator
│       └── impl/               # Event implementations
└── shared/
    ├── errors/                 # Custom error classes
    ├── types/                  # Shared types
    └── utils/                  # Utilities
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
    cooldown: 5,
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

### Job Queue (Decoupling)

For heavy tasks (transcriptions, giveaways) that shouldn't block the bot:

```typescript
// Producer
await jobQueue.add("transcribe-meeting", { voiceChannelId: "..." });

// Consumer
await jobQueue.process(async (job) => {
  // Handle heavy task
});
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

## 📝 License

ISC

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request
