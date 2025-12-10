# Discord Bot Development Guide

This guide explains how to create commands and events for this Discord bot. The architecture follows `@discordjs/core` patterns with proper dependency injection and API context propagation.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Creating Commands](#creating-commands)
  - [Simple Command](#simple-command)
  - [Command with Options](#command-with-options)
  - [Command with Subcommands](#command-with-subcommands)
  - [Subcommand Groups](#subcommand-groups)
- [Creating Events](#creating-events)
- [Registering Commands and Events](#registering-commands-and-events)
- [Available Utilities](#available-utilities)
- [Best Practices](#best-practices)

---

## Architecture Overview

```
src/
├── client/
│   └── Bot.ts                    # Main bot client with @discordjs/core Client
├── core/
│   ├── Config.ts                 # Environment configuration
│   ├── Container.ts              # Dependency injection container
│   └── Logger.ts                 # Pino logger
├── modules/
│   ├── commands/
│   │   ├── BaseCommand.ts        # Abstract base class for commands
│   │   ├── CommandHandler.ts     # Handles command execution
│   │   ├── CommandRegistry.ts    # Stores registered commands
│   │   └── impl/                 # Command implementations
│   │       ├── util/             # Utility commands
│   │       └── config/           # Configuration commands
│   └── events/
│       ├── BaseEvent.ts          # Abstract base class for events
│       ├── EventHandler.ts       # Handles event dispatching
│       └── impl/                 # Event implementations
├── infrastructure/
│   ├── database/                 # Prisma repositories
│   └── cache/                    # Redis client
└── shared/
    ├── types/discord.ts          # Discord type definitions
    ├── errors/                   # Custom error classes
    └── utils/                    # Utility functions (embeds, cooldowns)
```

### Key Concepts

1. **API Propagation**: The `API` instance is created once in `Bot.ts` and passed through events to commands via `context.api`
2. **No direct REST/API creation**: Commands NEVER create their own `REST` or `API` instances
3. **Event Context**: Events receive `{ data, api, shardId }` from `@discordjs/core` Client

---

## Creating Commands

### Simple Command

Create a new file in `src/modules/commands/impl/<category>/<command>.ts`:

```typescript
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";

export class HelloCommand extends BaseCommand {
  // Command metadata
  public readonly meta = {
    name: "hello", // Slash command name (lowercase)
    description: "Say hello!", // Description shown in Discord
    category: "util", // Category for organization
    cooldown: 5, // Optional: cooldown in seconds
    dmPermission: true, // Optional: allow in DMs (default: false)
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;

    // Use api from context - NEVER create your own REST/API
    await api.interactions.reply(interaction.id, interaction.token, {
      content: `Hello, <@${context.userId}>! 👋`,
    });
  }
}
```

### Command with Options

```typescript
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import type { APIApplicationCommandBasicOption } from "@discordjs/core";
import { ApplicationCommandOptionType } from "@discordjs/core";

export class EchoCommand extends BaseCommand {
  public readonly meta = {
    name: "echo",
    description: "Echo a message",
    category: "util",
  };

  // Define command options
  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.String,
        name: "message",
        description: "The message to echo",
        required: true,
        max_length: 2000,
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "ephemeral",
        description: "Make the response visible only to you",
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options } = context;

    // Get options from context.options Map
    const message = options.get("message") as string;
    const ephemeral = (options.get("ephemeral") as boolean) ?? false;

    await api.interactions.reply(interaction.id, interaction.token, {
      content: message,
      flags: ephemeral ? 64 : undefined, // 64 = MessageFlags.Ephemeral
    });
  }
}
```

### Available Option Types

```typescript
import { ApplicationCommandOptionType } from "@discordjs/core";

// ApplicationCommandOptionType values:
// .Subcommand = 1
// .SubcommandGroup = 2
// .String = 3
// .Integer = 4
// .Boolean = 5
// .User = 6
// .Channel = 7
// .Role = 8
// .Mentionable = 9
// .Number = 10
// .Attachment = 11
```

### Command with Subcommands

**Parent command** (`src/modules/commands/impl/moderation/index.ts`):

```typescript
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import { PermissionFlagsBits } from "@discordjs/core";

export class ModerationCommand extends BaseCommand {
  public readonly meta = {
    name: "mod",
    description: "Moderation commands",
    category: "moderation",
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers.toString(),
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    // Parent commands with subcommands should not be called directly
    throw new Error("This command requires a subcommand");
  }
}
```

**Subcommand** (`src/modules/commands/impl/moderation/kick.ts`):

```typescript
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import type { APIApplicationCommandBasicOption } from "@discordjs/core";
import { ApplicationCommandOptionType } from "@discordjs/core";

export class KickSubcommand extends BaseCommand {
  public readonly meta = {
    name: "kick",
    description: "Kick a member from the server",
    category: "moderation",
  };

  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "The user to kick",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "reason",
        description: "Reason for the kick",
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options, guildId } = context;

    const userId = options.get("user") as string;
    const reason = (options.get("reason") as string) ?? "No reason provided";

    try {
      await api.guilds.removeMember(guildId, userId, { reason });

      await api.interactions.reply(interaction.id, interaction.token, {
        content: `✅ Successfully kicked <@${userId}>. Reason: ${reason}`,
      });
    } catch (error) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ Failed to kick the user. Check my permissions.",
        flags: 64,
      });
    }
  }
}
```

**Registration** (in `src/index.ts`):

```typescript
import { ModerationCommand } from "./modules/commands/impl/moderation/index.js";
import { KickSubcommand } from "./modules/commands/impl/moderation/kick.js";

// Register parent with subcommand
const modCommand = new ModerationCommand();
modCommand.registerSubcommand(new KickSubcommand());
commandRegistry.register(modCommand);
```

### Subcommand Groups

For nested subcommands like `/config message welcomecard`:

```typescript
// In src/index.ts
import { ConfigCommand } from "./modules/commands/impl/config/index.js";
import { WelcomeCardSubcommand } from "./modules/commands/impl/config/message/welcomecard.js";

const configCommand = new ConfigCommand();
// 'message' is the group name
configCommand.registerSubcommandGroup("message", new WelcomeCardSubcommand());
commandRegistry.register(configCommand);
```

This creates: `/config message welcomecard`

---

## Creating Events

Create a new file in `src/modules/events/impl/<event>.ts`:

```typescript
import { BaseEvent, type EventContext } from "../BaseEvent.js";
import { logger } from "../../../core/Logger.js";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";

export class MessageCreateEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = "MESSAGE_CREATE"; // Gateway event name
  public readonly once = false; // false = listen continuously

  async execute(
    context: EventContext<GatewayMessageCreateDispatchData>
  ): Promise<void> {
    const { data, api } = context;

    // Ignore bot messages
    if (data.author.bot) return;

    // Example: React to messages containing "hello"
    if (data.content.toLowerCase().includes("hello")) {
      try {
        await api.channels.addMessageReaction(data.channel_id, data.id, "👋");
      } catch (error) {
        logger.error({ error }, "Failed to add reaction");
      }
    }
  }
}
```

### Common Event Types

```typescript
// Gateway event names (use these for the `name` property):
"READY"; // Bot is ready
"GUILD_CREATE"; // Bot joined a guild or guild became available
"GUILD_DELETE"; // Bot left a guild or guild became unavailable
"GUILD_MEMBER_ADD"; // Member joined a guild
"GUILD_MEMBER_REMOVE"; // Member left a guild
"MESSAGE_CREATE"; // Message was sent
"MESSAGE_DELETE"; // Message was deleted
"MESSAGE_UPDATE"; // Message was edited
"INTERACTION_CREATE"; // Slash command, button, etc.
"VOICE_STATE_UPDATE"; // Voice channel changes
```

### Event Registration

In `src/index.ts`:

```typescript
import { eventHandler } from "./modules/events/EventHandler.js";
import { MessageCreateEvent } from "./modules/events/impl/messageCreate.js";

// Register events
eventHandler.register(new MessageCreateEvent());
```

**Important**: Also add the event listener in `Bot.ts` if not already present:

```typescript
// In Bot.ts setupEventListeners()
this.client.on(GatewayDispatchEvents.MessageCreate, async (event) => {
  await eventHandler.dispatch("MESSAGE_CREATE", event);
});
```

---

## Registering Commands and Events

All registration happens in `src/index.ts`:

```typescript
// Import handlers
import { eventHandler } from "./modules/events/EventHandler.js";
import { commandRegistry } from "./modules/commands/CommandRegistry.js";

// Import events
import { ReadyEvent } from "./modules/events/impl/ready.js";
import { InteractionCreateEvent } from "./modules/events/impl/interactionCreate.js";

// Import commands
import { PingCommand } from "./modules/commands/impl/util/ping.js";
import { HelloCommand } from "./modules/commands/impl/util/hello.js";

async function bootstrap() {
  // Register events
  eventHandler.register(new ReadyEvent());
  eventHandler.register(new InteractionCreateEvent());

  // Register commands
  commandRegistry.register(new PingCommand());
  commandRegistry.register(new HelloCommand());

  // ... rest of bootstrap
}
```

### Registering with Discord

After registering locally, commands must be synced with Discord:

```typescript
// For development (instant, guild-specific):
await bot.registerCommands("YOUR_GUILD_ID");

// For production (up to 1 hour propagation, global):
await bot.registerCommands();
```

---

## Available Utilities

### EmbedBuilder

```typescript
import { EmbedBuilder, Colors } from "../../../../shared/utils/embed.js";

const embed = new EmbedBuilder()
  .setTitle("Title")
  .setDescription("Description")
  .setColor(Colors.Blue)
  .addField("Field Name", "Field Value", true) // inline = true
  .setFooter("Footer text")
  .setTimestamp()
  .setThumbnail("https://example.com/image.png")
  .setImage("https://example.com/image.png")
  .toJSON();

await api.interactions.reply(interaction.id, interaction.token, {
  embeds: [embed],
});
```

### Cooldown Manager

```typescript
import { cooldownManager } from '../../../../shared/utils/cooldown.js';

// In your command
async execute(context: CommandContext): Promise<void> {
  // Check cooldown
  const onCooldown = await cooldownManager.checkCooldown(
    this.meta.name,
    context.userId,
    this.meta.cooldown ?? 0
  );

  if (onCooldown) {
    // User is on cooldown
    return;
  }

  // Set cooldown after execution
  await cooldownManager.setCooldown(
    this.meta.name,
    context.userId,
    this.meta.cooldown ?? 0
  );
}
```

### Logger

```typescript
import { logger } from "../../../../core/Logger.js";

logger.info({ userId, guildId }, "Command executed");
logger.error({ error }, "Something went wrong");
logger.debug({ data }, "Debug information");
logger.warn({ warning }, "Warning message");
```

### Container (Dependency Injection)

```typescript
import { container } from "../../../../core/Container.js";
import { GuildRepository } from "../../../../infrastructure/database/repositories/GuildRepository.js";

// Resolve a dependency
const guildRepo = await container.resolve<GuildRepository>("GuildRepository");

// Use the repository
const guild = await guildRepo.findById(guildId);
```

---

## Best Practices

### ✅ DO

1. **Always use `context.api`** for Discord API calls
2. **Use proper typing** for options and event data
3. **Handle errors gracefully** - send user-friendly error messages
4. **Use embeds** for rich responses
5. **Set appropriate cooldowns** to prevent spam
6. **Log important actions** for debugging
7. **Use dependency injection** for services/repositories

### ❌ DON'T

1. **Never create `new REST()` or `new API()`** in commands/events
2. **Never hardcode tokens** - use `config.get()`
3. **Never ignore errors** - at minimum log them
4. **Never use `any` type** when proper types exist
5. **Never make commands that don't respond** - Discord requires a response within 3 seconds

### Response Timing

Discord requires a response within 3 seconds. For long-running operations:

```typescript
async execute(context: CommandContext): Promise<void> {
  const { api, interaction } = context;

  // Defer the reply (shows "Bot is thinking...")
  await api.interactions.defer(interaction.id, interaction.token);

  // Do slow operation
  const result = await slowOperation();

  // Edit the deferred reply
  await api.interactions.editReply(
    interaction.application_id,
    interaction.token,
    { content: `Done! Result: ${result}` }
  );
}
```

---

## CommandContext Reference

The `context` object passed to commands contains:

```typescript
interface CommandContext {
  interaction: ChatInputInteraction; // Raw interaction data
  api: API; // Discord API instance
  guildId: string; // Server ID
  userId: string; // User who ran the command
  channelId: string; // Channel where command was run
  options: Map<string, any>; // Command options (flattened)
}
```

### Accessing Options

Options are automatically flattened from subcommands:

```typescript
// For /config message welcomecard enabled:true channel:#general
const enabled = context.options.get("enabled") as boolean;
const channelId = context.options.get("channel") as string;
```

---

## File Naming Convention

```
src/modules/commands/impl/
├── <category>/
│   ├── index.ts           # Parent command (if has subcommands)
│   ├── <command>.ts       # Standalone command or subcommand
│   └── <group>/
│       └── <subcommand>.ts  # Nested subcommand
```

Examples:

- `/ping` → `impl/util/ping.ts`
- `/config` → `impl/config/index.ts`
- `/config message welcomecard` → `impl/config/message/welcomecard.ts`
