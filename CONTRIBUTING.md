# Contributing: Commands & Events

This guide explains how to create new commands and events for the Discord bot. The architecture follows enterprise patterns with a clear separation of concerns.

## Table of Contents

- [Commands](#commands)
  - [File Structure](#command-file-structure)
  - [Creating a Simple Command](#creating-a-simple-command)
  - [Creating a Command with Options](#creating-a-command-with-options)
  - [Creating Subcommands](#creating-subcommands)
  - [Subcommand Groups](#subcommand-groups)
  - [Command Registration](#command-registration)
- [Events](#events)
  - [Event File Structure](#event-file-structure)
  - [Creating an Event](#creating-an-event)
  - [Event Registration](#event-registration)
- [Best Practices](#best-practices)

---

## Commands

All commands extend the `BaseCommand` class located at `src/modules/commands/BaseCommand.ts`.

### Command File Structure

Commands are organized by category under `src/modules/commands/impl/`:

```
src/modules/commands/
├── BaseCommand.ts          # Base class for all commands
├── CommandHandler.ts       # Handles command execution
├── CommandRegistry.ts      # Registry for all commands
└── impl/
    ├── util/
    │   └── ping.ts         # Simple command
    └── config/
        ├── index.ts        # Parent command with subcommands
        └── message/
            └── welcomecard.ts  # Subcommand
```

### Creating a Simple Command

Create a new file in the appropriate category folder:

```typescript
// src/modules/commands/impl/util/hello.ts
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import { API } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { config } from "../../../../core/Config.js";
import { EmbedBuilder, Colors } from "../../../../shared/utils/embed.js";

export class HelloCommand extends BaseCommand {
  // Required: Command metadata
  public readonly meta = {
    name: "hello", // Command name (lowercase, no spaces)
    description: "Say hello!", // Description shown in Discord
    category: "util", // Category for organization
    cooldown: 5, // Optional: Cooldown in seconds
  };

  // Create API instance for responding
  private rest = new REST({ version: "10" }).setToken(
    config.get("DISCORD_TOKEN")
  );
  private api = new API(this.rest);

  // Required: Execute method
  async execute(context: CommandContext): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle("👋 Hello!")
      .setDescription(`Hello, <@${context.userId}>!`)
      .setColor(Colors.Blue)
      .setTimestamp()
      .toJSON();

    await this.api.interactions.reply(
      context.interaction.id,
      context.interaction.token,
      { embeds: [embed] }
    );
  }
}
```

### Creating a Command with Options

Commands can accept options (arguments) from users:

```typescript
// src/modules/commands/impl/util/userinfo.ts
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import type { APIApplicationCommandBasicOption } from "@discordjs/core";
import { API, ApplicationCommandOptionType } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { config } from "../../../../core/Config.js";

export class UserInfoCommand extends BaseCommand {
  public readonly meta = {
    name: "userinfo",
    description: "Get information about a user",
    category: "util",
  };

  private rest = new REST({ version: "10" }).setToken(
    config.get("DISCORD_TOKEN")
  );
  private api = new API(this.rest);

  // Define command options
  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "The user to get info about",
        required: false,
      },
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "ephemeral",
        description: "Show response only to you",
        required: false,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    // Access options from context
    const targetUser = context.options.get("user") as string | undefined;
    const ephemeral = context.options.get("ephemeral") as boolean | false;

    const userId = targetUser || context.userId;

    await this.api.interactions.reply(
      context.interaction.id,
      context.interaction.token,
      {
        content: `User ID: ${userId}`,
        flags: ephemeral ? 64 : 0, // 64 = ephemeral flag
      }
    );
  }
}
```

#### Option Types

| Type                                      | Discord Name | TypeScript Value Type    |
| ----------------------------------------- | ------------ | ------------------------ |
| `ApplicationCommandOptionType.String`     | String       | `string`                 |
| `ApplicationCommandOptionType.Integer`    | Integer      | `number`                 |
| `ApplicationCommandOptionType.Boolean`    | Boolean      | `boolean`                |
| `ApplicationCommandOptionType.User`       | User         | `string` (Snowflake ID)  |
| `ApplicationCommandOptionType.Channel`    | Channel      | `string` (Snowflake ID)  |
| `ApplicationCommandOptionType.Role`       | Role         | `string` (Snowflake ID)  |
| `ApplicationCommandOptionType.Number`     | Number       | `number`                 |
| `ApplicationCommandOptionType.Attachment` | Attachment   | `string` (Attachment ID) |

### Creating Subcommands

For commands with multiple related actions, use subcommands.

**1. Create the parent command:**

```typescript
// src/modules/commands/impl/moderation/index.ts
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
    // This is called if no subcommand is specified
    // Usually throw an error or show help
    throw new Error("Please use a subcommand");
  }
}
```

**2. Create subcommands:**

```typescript
// src/modules/commands/impl/moderation/warn.ts
import { BaseCommand } from "../../BaseCommand.js";
import type { CommandContext } from "../../../../shared/types/discord.js";
import type { APIApplicationCommandBasicOption } from "@discordjs/core";
import { API, ApplicationCommandOptionType } from "@discordjs/core";
import { REST } from "@discordjs/rest";
import { config } from "../../../../core/Config.js";

export class WarnSubcommand extends BaseCommand {
  public readonly meta = {
    name: "warn",
    description: "Warn a user",
    category: "moderation",
  };

  private rest = new REST({ version: "10" }).setToken(
    config.get("DISCORD_TOKEN")
  );
  private api = new API(this.rest);

  // Subcommands define their own options
  public getOptions(): APIApplicationCommandBasicOption[] {
    return [
      {
        type: ApplicationCommandOptionType.User,
        name: "user",
        description: "User to warn",
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: "reason",
        description: "Reason for the warning",
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const userId = context.options.get("user") as string;
    const reason = context.options.get("reason") as string;

    // Implement warning logic...

    await this.api.interactions.reply(
      context.interaction.id,
      context.interaction.token,
      { content: `⚠️ Warned <@${userId}> for: ${reason}` }
    );
  }
}
```

### Subcommand Groups

For complex commands, organize subcommands into groups:

```
/config message welcomecard   → config (parent) > message (group) > welcomecard (subcommand)
/config roles autorole        → config (parent) > roles (group) > autorole (subcommand)
```

Register groups in `src/index.ts`:

```typescript
const configCommand = new ConfigCommand();
configCommand.registerSubcommandGroup("message", new WelcomeCardSubcommand());
configCommand.registerSubcommandGroup("message", new GoodbyeSubcommand());
configCommand.registerSubcommandGroup("roles", new AutoroleSubcommand());
commandRegistry.register(configCommand);
```

### Command Registration

Register commands in `src/index.ts`:

```typescript
import { commandRegistry } from "./modules/commands/CommandRegistry.js";
import { HelloCommand } from "./modules/commands/impl/util/hello.js";

// In bootstrap():
commandRegistry.register(new HelloCommand());
```

> [!IMPORTANT]
> After adding new commands, they must be registered with Discord. Uncomment and run:
>
> ```typescript
> await bot.registerCommands("YOUR_DEV_GUILD_ID"); // For development (instant)
> // OR
> await bot.registerCommands(); // For production (takes up to 1 hour)
> ```

---

## Events

All events extend the `BaseEvent` class located at `src/modules/events/BaseEvent.ts`.

### Event File Structure

```
src/modules/events/
├── BaseEvent.ts        # Base class for all events
├── EventHandler.ts     # Handles event dispatching
└── impl/
    ├── ready.ts        # Bot ready event
    ├── guildCreate.ts  # Guild join event
    └── interactionCreate.ts  # Interaction handling
```

### Creating an Event

```typescript
// src/modules/events/impl/messageCreate.ts
import { BaseEvent } from "../BaseEvent.js";
import { logger } from "../../../core/Logger.js";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";

export class MessageCreateEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  // Event name - matches Discord Gateway event names
  public readonly name = "MESSAGE_CREATE";

  // If true, handler only executes once then is removed
  public readonly once = false;

  async execute(data: GatewayMessageCreateDispatchData): Promise<void> {
    // Ignore bot messages
    if (data.author.bot) return;

    logger.debug(
      {
        author: data.author.username,
        content: data.content.substring(0, 50),
        guild: data.guild_id,
      },
      "Message received"
    );

    // Your logic here...
  }
}
```

### Common Event Types

| Event Name            | Data Type                              | Description                     |
| --------------------- | -------------------------------------- | ------------------------------- |
| `READY`               | `GatewayReadyDispatchData`             | Bot connected and ready         |
| `GUILD_CREATE`        | `GatewayGuildCreateDispatchData`       | Bot joined a guild              |
| `GUILD_DELETE`        | `GatewayGuildDeleteDispatchData`       | Bot left/was removed from guild |
| `GUILD_MEMBER_ADD`    | `GatewayGuildMemberAddDispatchData`    | Member joined a guild           |
| `GUILD_MEMBER_REMOVE` | `GatewayGuildMemberRemoveDispatchData` | Member left a guild             |
| `MESSAGE_CREATE`      | `GatewayMessageCreateDispatchData`     | Message sent                    |
| `INTERACTION_CREATE`  | `GatewayInteractionCreateDispatchData` | Interaction received            |

> [!TIP]
> All event data types are available from `@discordjs/core`. Check the [Discord Gateway Events](https://discord.com/developers/docs/topics/gateway-events) documentation.

### Event Registration

Register events in `src/index.ts`:

```typescript
import { eventHandler } from "./modules/events/EventHandler.js";
import { MessageCreateEvent } from "./modules/events/impl/messageCreate.js";

// In bootstrap():
eventHandler.register(new MessageCreateEvent());
```

> [!IMPORTANT]
> Some events require specific Gateway Intents. Update intents in the Bot initialization:
>
> ```typescript
> const bot = new Bot({
>   token: config.get("DISCORD_TOKEN"),
>   intents:
>     GatewayIntentBits.Guilds |
>     GatewayIntentBits.GuildMembers |
>     GatewayIntentBits.GuildMessages |
>     GatewayIntentBits.MessageContent, // Required for message content
> });
> ```

---

## Best Practices

### Commands

1. **Use descriptive names**: Command names should be clear and concise
2. **Add cooldowns**: Prevent spam with the `cooldown` metadata property
3. **Handle errors gracefully**: Always wrap database/API calls in try-catch
4. **Use ephemeral responses**: For sensitive info, use flag `64`
5. **Validate inputs**: Check required options exist before using them

### Events

1. **Keep handlers lightweight**: Offload heavy processing to workers
2. **Use `once: true`** for one-time setup events (like READY)
3. **Log appropriately**: Use `logger.debug` for frequent events
4. **Check for bots**: Filter out bot messages/actions when appropriate

### General

1. **Use the Container**: Access services via DI container for testability

   ```typescript
   const guildRepo = await container.resolve<GuildRepository>(
     "GuildRepository"
   );
   ```

2. **Use the Logger**: Never use `console.log`

   ```typescript
   import { logger } from "../../../core/Logger.js";
   logger.info({ data }, "Message");
   ```

3. **Use EmbedBuilder**: For rich responses

   ```typescript
   import { EmbedBuilder, Colors } from "../../../shared/utils/embed.js";
   ```

4. **Follow the folder structure**: Keep commands organized by category

---

## Quick Reference

### CommandContext Properties

```typescript
interface CommandContext {
  interaction: ChatInputInteraction; // Raw interaction data
  guildId: string; // Guild ID (snowflake)
  userId: string; // User ID (snowflake)
  channelId: string; // Channel ID (snowflake)
  options: Map<string, any>; // Command options
}
```

### CommandMetadata Properties

```typescript
interface CommandMetadata {
  name: string; // Command name
  description: string; // Description
  category?: string; // Category for organization
  cooldown?: number; // Cooldown in seconds
  permissions?: {
    user?: bigint[]; // Required user permissions
    bot?: bigint[]; // Required bot permissions
  };
  dmPermission?: boolean; // Allow in DMs
  defaultMemberPermissions?: string; // Default permissions
}
```
