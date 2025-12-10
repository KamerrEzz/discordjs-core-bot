# Discord Bot Development Guide

This guide explains how to create commands and events for this Discord bot. The architecture follows `@discordjs/core` patterns with proper dependency injection and API context propagation.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Path Aliases](#path-aliases)
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
│   ├── commands/                 # Interaction handlers (Slash Commands)
│   ├── events/                   # Raw Discord Event Listeners (Triggers)
│   └── systems/                  # Business Logic & Feature Modules (Brain)
│       ├── BaseSystem.ts         # Abstract base class
│       ├── SystemManager.ts      # Lifecycle manager
│       └── impl/                 # Feature implementations (Welcome, Ticket, etc)
├── infrastructure/
│   ├── database/                 # Prisma repositories
│   └── cache/                    # Redis client
└── shared/
    ├── types/discord.ts          # Discord type definitions
    ├── errors/                   # Custom error classes
    └── utils/                    # Utility functions (embeds, cooldowns)
```

### Path Aliases

This project uses Node.js subpath imports for cleaner import paths. Instead of relative paths like `../../core/Logger.js`, use:

| Alias               | Maps to                |
| ------------------- | ---------------------- |
| `#client/*`         | `src/client/*`         |
| `#core/*`           | `src/core/*`           |
| `#modules/*`        | `src/modules/*`        |
| `#infrastructure/*` | `src/infrastructure/*` |
| `#shared/*`         | `src/shared/*`         |

**Example:**

```typescript
// ❌ Before (relative paths)
import { logger } from "../../../core/Logger.js";
import { container } from "../../../core/Container.js";

// ✅ After (path aliases)
import { logger } from "#core/Logger.js";
import { container } from "#core/Container.js";
```

> **Note:** Always include the `.js` extension in imports (ESM requirement).

### Key Concepts

1.  **API Propagation**: The `API` instance is created once in `Bot.ts` and passed through events to commands via `context.api`
2.  **No direct REST/API creation**: Commands NEVER create their own `REST` or `API` instances
3.  **Event Context**: Events receive `{ data, api, shardId }` from `@discordjs/core` Client

---

## Systems Architecture (Advanced)

### "Events" vs "Systems" - Who does what?

- **Events (`src/modules/events`)**: These are **dumb triggers**. Their ONLY job is to listen for a Discord Packet (like "User Joined") and tell the relevant System "Hey, this happened". They should contain NO business logic.
- **Systems (`src/modules/systems`)**: These are the **brains**. They contain all the business logic for a specific feature (Welcome, Tickets, Giveaways). They can subscribe to multiple events, manage intervals, or connect to external APIs.

**Why separate them?**

1.  **Toggleable Features**: You can disable the entire "WelcomeSystem" without editing the core `guildMemberAdd` event.
2.  **Decoupling**: The Event handler doesn't need to know _how_ to generate a welcome image, just who to call.
3.  **Scalability**: Systems can easily be moved to separate workers or queues if they get too heavy.

### Creating a New System

1.  **Create the Implementation** in `src/modules/systems/impl/<Feature>System.ts`.

    ```typescript
    import { BaseSystem } from "../BaseSystem.js";
    import { logger } from "#core/Logger.js";
    import { eventHandler } from "#modules/events/EventHandler.js";
    import { BaseEvent, type EventContext } from "#modules/events/BaseEvent.js";
    import type { GatewayMessageCreateDispatchData } from "@discordjs/core";

    // 1. Define any internal events IF they are specific to this system
    // Or prefer using the global events/impl if shared.
    class MySystemMessageEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
      public readonly name = "MESSAGE_CREATE";
      public readonly once = false;

      constructor(private system: MySystem) {
        super();
      }

      async execute(
        context: EventContext<GatewayMessageCreateDispatchData>
      ): Promise<void> {
        await this.system.handleMessage(context.data, context.api);
      }
    }

    // 2. Define the System Logic
    export class MySystem extends BaseSystem {
      public readonly name = "MySystem"; // Unique ID

      // Called when bot starts
      async onInit(): Promise<void> {
        // Subscribe to events
        eventHandler.register(new MySystemMessageEvent(this));
        logger.info("MySystem initialized!");
      }

      // Called when Shard 0 is READY
      async onReady(): Promise<void> {
        // Start intervals, queues, or initial checks
        logger.info("MySystem is ready to work");
      }

      // 3. Implement Business Logic
      public async handleMessage(
        data: GatewayMessageCreateDispatchData,
        api: any
      ): Promise<void> {
        if (data.content === "ping system") {
          logger.info("System received ping");
        }
      }
    }
    ```

2.  **Register the System** in `src/index.ts`.

    ```typescript
    import { MySystem } from "#modules/systems/impl/MySystem.js";

    // ... inside bootstrap()
    await bot.getSystemManager().register(MySystem);
    ```

### Types of Systems

Use this pattern for complex features that require state or background logic:

- **TicketSystem**: Manages DB config, interacts with `INTERACTION_CREATE` (buttons), `MESSAGE_CREATE` (transcripts), and maybe a `setInterval` to close inactive tickets.
- **WelcomeSystem**: Listens to `GUILD_MEMBER_ADD`, generates dynamic images (Canvas), and checks DB config.
- **GiveawaySystem**: Uses `JobQueue` (Redis) to end giveaways at specific times, independent of the bot's uptime.
- **MusicSystem**: Connects to Lavalink/Lavalink nodes.
- **LevelingSystem**: Listens to messages, creates a local debounce (Map) to prevent spam XP, and syncs to DB periodically.

---

## Creating Commands

### Simple Command

Create a new file in `src/modules/commands/impl/<category>/<command>.ts`:

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";

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
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
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

**Parent command** (`src/modules/commands/impl/config/index.ts`):

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { PermissionFlagsBits } from "@discordjs/core";

export class ConfigCommand extends BaseCommand {
  public readonly meta = {
    name: "config",
    description: "Configure server settings",
    category: "config",
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild.toString(),
    dmPermission: false,
  };

  async execute(context: CommandContext): Promise<void> {
    // Parent commands with subcommands should not be called directly
    throw new Error("This command requires a subcommand");
  }
}
```

**Subcommand** (`src/modules/commands/impl/config/message/welcomecard.ts`):

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { ApplicationCommandOptionType } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";

export class WelcomeCardSubcommand extends BaseCommand {
  public readonly meta = {
    name: "welcomecard",
    description: "Configure the welcome card settings",
    category: "config",
  };

  protected getOptions() {
    return [
      {
        type: ApplicationCommandOptionType.Boolean,
        name: "enabled",
        description: "Enable or disable welcome cards",
        required: true,
      },
    ];
  }

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction, options } = context;
    const enabled = options.get("enabled") as boolean;

    const embed = new EmbedBuilder()
      .setTitle("⚙️ Welcome Card Configuration")
      .setDescription(
        `Welcome cards have been ${enabled ? "enabled" : "disabled"}`
      )
      .setColor(Colors.Green)
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });
  }
}
```

**Registration** (in `src/index.ts`):

```typescript
import { ConfigCommand } from "#modules/commands/impl/config/index.js";
import { WelcomeCardSubcommand } from "#modules/commands/impl/config/message/welcomecard.js";

const configCommand = new ConfigCommand();
// Register subcommand under a group 'message'
configCommand.registerSubcommandGroup("message", new WelcomeCardSubcommand());
commandRegistry.register(configCommand);
```

---

## Creating Events

Create a new file in `src/modules/events/impl/<event>.ts`:

```typescript
import { BaseEvent, type EventContext } from "#modules/events/BaseEvent.js";
import { logger } from "#core/Logger.js";
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
import { eventHandler } from "#modules/events/EventHandler.js";
import { MessageCreateEvent } from "#modules/events/impl/messageCreate.js";

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
import { eventHandler } from "#modules/events/EventHandler.js";
import { commandRegistry } from "#modules/commands/CommandRegistry.js";

// Import events
import { ReadyEvent } from "#modules/events/impl/ready.js";
import { InteractionCreateEvent } from "#modules/events/impl/interactionCreate.js";

// Import commands
import { PingCommand } from "#modules/commands/impl/util/ping.js";
import { ConfigCommand } from "#modules/commands/impl/config/index.js";

async function bootstrap() {
  // Register events
  eventHandler.register(new ReadyEvent());
  eventHandler.register(new InteractionCreateEvent());

  // Register commands
  commandRegistry.register(new PingCommand());
  commandRegistry.register(new ConfigCommand());

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
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";

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
import { cooldownManager } from '#shared/utils/cooldown.js';

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
import { logger } from "#core/Logger.js";

logger.info({ userId, guildId }, "Command executed");
logger.error({ error }, "Something went wrong");
logger.debug({ data }, "Debug information");
logger.warn({ warning }, "Warning message");
```

### Container (Dependency Injection)

```typescript
import { container } from "#core/Container.js";
import { GuildRepository } from "#infrastructure/database/repositories/GuildRepository.js";

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
```

---

## Component System (Buttons, Select Menus, Modals)

### Architecture Overview

The component system follows SOLID principles with clear separation of concerns:

```
src/modules/components/
├── ComponentHandler.ts      # Factory pattern for component management
├── ComponentManager.ts      # Advanced lifecycle management with caching
├── BaseComponent.ts          # Abstract base class for all components
├── BaseButton.ts             # Base class for button components
├── BaseSelectMenu.ts         # Base class for select menu components
└── impl/
    └── <category>/
        └── <component>.ts      # Concrete component implementations
```

### Creating a Button Component

```typescript
import { BaseButton } from "#modules/components/BaseButton.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";

export class MyButton extends BaseButton {
  public readonly customId = "my-namespace:my-button";
  public readonly style = ButtonStyle.Primary;
  public readonly label = "Click Me!";
  public readonly once = true; // Optional: one-time use

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId } = context;

    await api.interactions.reply(interaction.id, interaction.token, {
      content: `Hello <@${userId}>! Button clicked!`,
      flags: 64, // Ephemeral
    });
  }
}
```

### Creating a Select Menu Component

```typescript
import { StringSelectMenu } from "#modules/components/BaseSelectMenu.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";

export class MySelectMenu extends StringSelectMenu {
  public readonly customId = "my-namespace:my-select";
  public readonly placeholder = "Choose an option...";
  public readonly minValues = 1;
  public readonly maxValues = 3;

  public readonly options = [
    { label: "Option 1", value: "opt1", description: "First option" },
    { label: "Option 2", value: "opt2", description: "Second option" },
  ];

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId, values } = context;

    await api.interactions.reply(interaction.id, interaction.token, {
      content: `<@${userId}> selected: ${values?.join(", ")}`,
    });
  }
}
```

### Component Context

```typescript
interface ComponentContext {
  interaction: any;        // Raw interaction data
  api: any;                // Discord API instance
  guildId?: string;        // Server ID (if in guild)
  userId: string;          // User who clicked/interacted
  channelId?: string;      // Channel ID
  message?: any;           // Original message (if applicable)
  customId: string;        // Component's custom ID
  values?: string[];         // Selected values (for select menus)
  componentType: number;   // Component type constant
}
```

### Registering Components

```typescript
import { componentManager } from "#modules/components/ComponentManager.js";
import { MyButton } from "#modules/components/impl/util/MyButton.js";

// Simple registration
const button = new MyButton();
componentManager.registerComponent(button);

// Advanced registration with options
componentManager.registerComponent(button, {
  timeout: 30 * 60 * 1000, // 30 minutes
  metadata: { 
    originalUserId: "123456789", 
    someData: "value" 
  }
});
```

### Using Components in Commands

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import { componentManager } from "#modules/components/ComponentManager.js";
import { MyButton } from "#modules/components/impl/util/MyButton.js";

export class MyCommand extends BaseCommand {
  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;

    // Create and register component
    const button = new MyButton();
    componentManager.registerComponent(button);

    // Send message with component
    await api.interactions.reply(interaction.id, interaction.token, {
      content: "Click the button below:",
      components: [
        {
          type: 1, // ActionRow
          components: [button.build()]
        }
      ]
    });
  }
}
```

### Component Custom ID Format

Components use a namespace-based custom ID system:

- Format: `"namespace:component-id[:metadata-hash]"`
- Examples: `"leveling:claim-reward"`, `"ticket:close-btn"`, `"util:confirm:abc123"`
- Metadata hash is automatically generated for components with metadata

### Component Manager Features

```typescript
// Get component statistics
const stats = componentManager.getComponentStats("my-namespace:my-button");

// Get all components by namespace
const components = componentManager.getComponentsByNamespace("my-namespace");

// Check if component is expired
const expired = componentManager.isComponentExpired("my-namespace:my-button");

// Unregister a component
componentManager.unregisterComponent("my-namespace:my-button");
```

### Best Practices for Components

### ✅ DO

1. **Use meaningful namespaces** for organization (`leveling:`, `ticket:`, `util:`)
2. **Implement proper validation** in the `validate()` method
3. **Handle errors gracefully** with user-friendly messages
4. **Use ephemeral responses** for sensitive operations
5. **Set appropriate timeouts** for temporary components
6. **Log component usage** for debugging and analytics
7. **Use the factory pattern** with static methods for complex components

### ❌ DON'T

1. **Never hardcode user IDs** - use metadata or validation
2. **Never ignore component validation** - always check permissions/context
3. **Never create long-lived components** without proper cleanup
4. **Never use generic custom IDs** - be specific to avoid conflicts
5. **Never forget to handle component errors** - users will see failures

### Advanced Component Patterns

#### Confirmation Dialog Pattern

```typescript
// Create confirm/cancel button pair
const [confirmBtn, cancelBtn] = ConfirmButton.createConfirmPair(
  "delete-message",
  userId,
  { messageId: "123456" }
);

// Register both buttons
componentManager.registerComponent(confirmBtn);
componentManager.registerComponent(cancelBtn);

// Send with both buttons
const row = BaseButton.createRow(confirmBtn, cancelBtn);
```

#### Dynamic Select Menu Pattern

```typescript
// Create select menu with dynamic options
const selectMenu = new StringSelectMenu();
selectMenu.options = await generateDynamicOptions();

// Register and use
componentManager.registerComponent(selectMenu);
```

#### Component with External API

```typescript
export class WeatherButton extends BaseButton {
  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId } = context;
    
    // Defer for long operations
    await api.interactions.defer(interaction.id, interaction.token);
    
    // Fetch external data
    const weather = await fetchWeather(this.metadata.city);
    
    // Edit with results
    await api.interactions.editReply(
      interaction.application_id,
      interaction.token,
      { content: `Weather in ${weather.city}: ${weather.temp}°C` }
    );
  }
}
```
│       └── <subcommand>.ts  # Nested subcommand
```

Examples:

- `/ping` → `impl/util/ping.ts`
- `/config` → `impl/config/index.ts`
- `/config message welcomecard` → `impl/config/message/welcomecard.ts`
