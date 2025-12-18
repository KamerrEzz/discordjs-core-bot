# Discord Bot Development Guide

Complete guide for developing features in this Discord bot. This documentation explains how to use the codebase without needing to read the source code.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Path Aliases](#path-aliases)
- [Core Concepts](#core-concepts)
- [Creating Commands](#creating-commands)
- [Creating Events](#creating-events)
- [Creating Systems](#creating-systems)
- [Component System](#component-system)
  - [Dynamic Components](#dynamic-components)
  - [Persistent Components](#persistent-components)
  - [Component Factories](#component-factories)
- [Database & Repositories](#database--repositories)
- [Cache System](#cache-system)
- [Dependency Injection](#dependency-injection)
- [Configuration](#configuration)
- [Available Utilities](#available-utilities)
- [Best Practices](#best-practices)

---

## Architecture Overview

```
src/
├── client/
│   └── Bot.ts                    # Main bot client with @discordjs/core Client
├── core/
│   ├── Config.ts                 # Environment configuration (validated)
│   ├── Container.ts              # Dependency injection container
│   └── Logger.ts                 # Pino logger (structured logging)
├── modules/
│   ├── commands/                 # Slash Commands (user interactions)
│   │   ├── BaseCommand.ts
│   │   ├── CommandRegistry.ts    # Persistent command storage
│   │   └── impl/                 # Command implementations
│   ├── events/                   # Discord Gateway Events (triggers)
│   │   ├── BaseEvent.ts
│   │   ├── EventHandler.ts
│   │   └── impl/                 # Event implementations
│   ├── components/               # Buttons, Select Menus, Modals
│   │   ├── ComponentRegistry.ts  # Persistent component storage
│   │   ├── ComponentHandler.ts   # Component dispatcher
│   │   ├── ComponentManager.ts   # Component lifecycle management
│   │   └── impl/                 # Component implementations
│   └── systems/                  # Business Logic & Feature Modules
│       ├── BaseSystem.ts
│       ├── SystemManager.ts
│       └── impl/                 # System implementations
├── infrastructure/
│   ├── database/                 # Prisma ORM & Repositories
│   │   ├── repositories/         # Data access layer
│   │   └── prisma.ts            # Prisma client singleton
│   └── cache/                    # Redis cache
│       ├── CacheService.ts       # Cache abstraction
│       └── RedisClient.js        # Redis connection
└── shared/
    ├── types/discord.ts          # Discord type definitions
    ├── errors/                   # Custom error classes
    └── utils/                    # Utility functions
```

### Path Aliases

This project uses Node.js subpath imports for cleaner import paths:

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

---

## Core Concepts

### 1. API Propagation

The `API` instance is created once in `Bot.ts` and passed through events to commands via `context.api`. **NEVER create your own `REST` or `API` instances** in commands, events, or components.

### 2. Event Context

Events receive `{ data, api, shardId }` from `@discordjs/core` Client. This context is then passed to handlers.

### 3. Registration Pattern

- **Commands**: Registered in `CommandRegistry` at startup, then synced with Discord
- **Events**: Registered in `EventHandler` at startup
- **Components**: Can be dynamic (temporary) or persistent (registered at startup)
- **Systems**: Registered in `SystemManager` at startup

### 4. Separation of Concerns

- **Events**: Dumb triggers - only forward Discord packets to systems
- **Systems**: Business logic - contain all feature logic
- **Commands**: User interactions - handle slash commands
- **Components**: Interactive UI - buttons, select menus, modals

---

## Creating Commands

### Simple Command

Create a new file in `src/modules/commands/impl/<category>/<command>.ts`:

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";

export class HelloCommand extends BaseCommand {
  public readonly meta = {
    name: "hello",
    description: "Say hello!",
    category: "util",
    cooldown: 5, // Optional: cooldown in seconds
    dmPermission: true, // Optional: allow in DMs (default: false)
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;

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

  protected getOptions(): APIApplicationCommandBasicOption[] {
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

    const message = options.get("message") as string;
    const ephemeral = (options.get("ephemeral") as boolean) ?? false;

    await api.interactions.reply(interaction.id, interaction.token, {
      content: message,
      flags: ephemeral ? 64 : undefined, // 64 = MessageFlags.Ephemeral
    });
  }
}
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
      .setDescription(`Welcome cards have been ${enabled ? "enabled" : "disabled"}`)
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
import { commandRegistry } from "#modules/commands/CommandRegistry.js";
import { ConfigCommand } from "#modules/commands/impl/config/index.js";
import { WelcomeCardSubcommand } from "#modules/commands/impl/config/message/welcomecard.js";

// Register commands
const configCommand = new ConfigCommand();
configCommand.registerSubcommandGroup("message", new WelcomeCardSubcommand());
commandRegistry.register(configCommand);

// Register with Discord
await bot.registerCommands("GUILD_ID"); // Development
// await bot.registerCommands(); // Production (global)
```

### Available Option Types

```typescript
import { ApplicationCommandOptionType } from "@discordjs/core";

// ApplicationCommandOptionType values:
ApplicationCommandOptionType.Subcommand        // 1
ApplicationCommandOptionType.SubcommandGroup   // 2
ApplicationCommandOptionType.String            // 3
ApplicationCommandOptionType.Integer           // 4
ApplicationCommandOptionType.Boolean           // 5
ApplicationCommandOptionType.User               // 6
ApplicationCommandOptionType.Channel            // 7
ApplicationCommandOptionType.Role               // 8
ApplicationCommandOptionType.Mentionable        // 9
ApplicationCommandOptionType.Number             // 10
ApplicationCommandOptionType.Attachment         // 11
```

---

## Creating Events

Create a new file in `src/modules/events/impl/<event>.ts`:

```typescript
import { BaseEvent, type EventContext } from "#modules/events/BaseEvent.js";
import { logger } from "#core/Logger.js";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";

export class MessageCreateEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = "MESSAGE_CREATE";
  public readonly once = false; // false = listen continuously

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    const { data, api } = context;

    // Ignore bot messages
    if (data.author.bot) return;

    // Your logic here
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
"READY"              // Bot is ready
"GUILD_CREATE"       // Bot joined a guild
"GUILD_DELETE"       // Bot left a guild
"GUILD_MEMBER_ADD"   // Member joined
"GUILD_MEMBER_REMOVE" // Member left
"MESSAGE_CREATE"     // Message was sent
"MESSAGE_DELETE"     // Message was deleted
"MESSAGE_UPDATE"     // Message was edited
"INTERACTION_CREATE" // Slash command, button, etc.
"VOICE_STATE_UPDATE" // Voice channel changes
```

### Event Registration

In `src/index.ts`:

```typescript
import { eventHandler } from "#modules/events/EventHandler.js";
import { MessageCreateEvent } from "#modules/events/impl/messageCreate.js";

// Register events
eventHandler.register(new MessageCreateEvent());
```

**Important**: The event listener must exist in `Bot.ts`:

```typescript
// In Bot.ts setupEventListeners()
this.client.on(GatewayDispatchEvents.MessageCreate, async (event) => {
  await eventHandler.dispatch("MESSAGE_CREATE", event);
});
```

---

## Creating Systems

Systems contain business logic for features. They subscribe to events and handle complex operations.

### System Architecture

- **Events**: Dumb triggers - only forward Discord packets to systems
- **Systems**: Business logic - contain all feature logic

**Why separate them?**

1. **Toggleable Features**: Disable entire systems without editing core events
2. **Decoupling**: Events don't need to know business logic
3. **Scalability**: Systems can be moved to separate workers

### Creating a System

1. **Create the Implementation** in `src/modules/systems/impl/<Feature>System.ts`:

```typescript
import { BaseSystem } from "../BaseSystem.js";
import { logger } from "#core/Logger.js";
import { eventHandler } from "#modules/events/EventHandler.js";
import { BaseEvent, type EventContext } from "#modules/events/BaseEvent.js";
import type { GatewayMessageCreateDispatchData } from "@discordjs/core";

// Internal event handler for this system
class MySystemMessageEvent extends BaseEvent<GatewayMessageCreateDispatchData> {
  public readonly name = "MESSAGE_CREATE";
  public readonly once = false;

  constructor(private system: MySystem) {
    super();
  }

  async execute(context: EventContext<GatewayMessageCreateDispatchData>): Promise<void> {
    await this.system.handleMessage(context.data, context.api);
  }
}

// System implementation
export class MySystem extends BaseSystem {
  public readonly name = "MySystem";

  async onInit(): Promise<void> {
    // Subscribe to events
    eventHandler.register(new MySystemMessageEvent(this));
    logger.info("MySystem initialized!");
  }

  async onReady(): Promise<void> {
    // Start intervals, queues, or initial checks
    logger.info("MySystem is ready to work");
  }

  public async handleMessage(data: GatewayMessageCreateDispatchData, api: any): Promise<void> {
    // Business logic here
    if (data.content === "ping system") {
      logger.info("System received ping");
    }
  }
}
```

2. **Register the System** in `src/index.ts`:

```typescript
import { MySystem } from "#modules/systems/impl/MySystem.js";

// ... inside bootstrap()
await bot.getSystemManager().register(MySystem);
```

### Types of Systems

Use systems for complex features that require state or background logic:

- **TicketSystem**: Manages tickets, interacts with buttons, handles transcripts
- **WelcomeSystem**: Generates welcome images, checks DB config
- **LevelingSystem**: Tracks XP, manages debouncing, syncs to DB
- **GiveawaySystem**: Uses job queues to end giveaways at specific times

---

## Component System

The component system handles buttons, select menus, and modals. Components can be **dynamic** (temporary) or **persistent** (survive bot restarts).

### Modal Components

Modals are forms that appear when triggered by buttons or commands. They allow users to input text data.

#### Creating a Modal

```typescript
import { BaseModal, TextInputStyle } from "#modules/components/BaseModal.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";

export class FeedbackModal extends BaseModal {
  public readonly customId = "util:feedback:modal";
  public readonly title = "Send Feedback";
  public readonly inputs = [
    {
      customId: "feedback:subject",
      label: "Subject",
      style: TextInputStyle.Short, // Single-line input
      placeholder: "Brief description",
      required: true,
      minLength: 3,
      maxLength: 100,
    },
    {
      customId: "feedback:message",
      label: "Message",
      style: TextInputStyle.Paragraph, // Multi-line input
      placeholder: "Please provide detailed feedback...",
      required: true,
      minLength: 10,
      maxLength: 1000,
    },
  ];

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId, modalData } = context;

    if (!modalData) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ No data received from modal.",
        flags: 64, // Ephemeral
      });
      return;
    }

    const subject = modalData.get("feedback:subject") || "";
    const message = modalData.get("feedback:message") || "";

    // Process the modal data
    const embed = new EmbedBuilder()
      .setTitle("✅ Feedback Received")
      .setDescription("Thank you for your feedback!")
      .addField("Subject", subject)
      .addField("Message", message)
      .setColor(Colors.Green)
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      flags: 64, // Ephemeral
    });
  }
}
```

#### Opening a Modal from a Button

```typescript
import { BaseButton } from "#modules/components/BaseButton.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";
import { FeedbackModal } from "#modules/components/impl/util/FeedbackModal.js";

export class OpenModalButton extends BaseButton {
  public readonly customId = "util:open-feedback-modal";
  public readonly style = ButtonStyle.Primary;
  public readonly label = "Open Feedback Modal";

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction } = context;
    const modal = new FeedbackModal();

    // Show modal (must be shown as a response to an interaction)
    // Use REST API directly since interactions.reply() wraps in type 4
    await api.rest.post(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      body: {
        type: 9, // InteractionResponseType.Modal
        data: modal.build(),
      },
    });
  }
}
```

#### Opening a Modal from a Command

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import type { CommandContext } from "#shared/types/discord.js";
import { FeedbackModal } from "#modules/components/impl/util/FeedbackModal.js";

export class FeedbackCommand extends BaseCommand {
  public readonly meta = {
    name: "feedback",
    description: "Send feedback",
    category: "util",
  };

  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;
    const modal = new FeedbackModal();

    // Show modal
    // Use REST API directly since interactions.reply() wraps in type 4
    await api.rest.post(`/interactions/${interaction.id}/${interaction.token}/callback`, {
      body: {
        type: 9, // InteractionResponseType.Modal
        data: modal.build(),
      },
    });
  }
}
```

#### Modal Text Input Options

```typescript
interface ModalTextInput {
  customId: string;        // Unique identifier for the input
  label: string;           // Label shown above the input (max 45 chars)
  style: TextInputStyle;   // TextInputStyle.Short or TextInputStyle.Paragraph
  placeholder?: string;    // Placeholder text
  value?: string;          // Pre-filled value
  required?: boolean;       // Whether the input is required
  minLength?: number;      // Minimum length (0-4000)
  maxLength?: number;      // Maximum length (1-4000)
}
```

#### Modal Constraints

- **Title**: Maximum 45 characters
- **Inputs**: Maximum 5 text inputs per modal
- **Label**: Maximum 45 characters per input
- **Value**: Maximum 4000 characters per input
- **Short input**: Single-line text
- **Paragraph input**: Multi-line text

#### Accessing Modal Data

Modal data is automatically parsed and available in `ComponentContext.modalData`:

```typescript
async execute(context: ComponentContext): Promise<void> {
  const { modalData } = context;

  // modalData is a Map<string, string>
  const subject = modalData?.get("feedback:subject") || "";
  const message = modalData?.get("feedback:message") || "";
}
```

#### Registering Persistent Modals

Modals can be registered as persistent components:

```typescript
// In src/index.ts
import { componentRegistry } from "#modules/components/ComponentRegistry.js";
import { FeedbackModal } from "#modules/components/impl/util/FeedbackModal.js";

// Register persistent modal
componentRegistry.register(new FeedbackModal());
```

**Note**: Modals don't need to be registered to be shown, but registering them allows them to handle submissions after bot restarts.

### Architecture

```
ComponentHandler      # Dispatches interactions (checks persistent first, then dynamic)
ComponentRegistry     # Stores persistent components and factories
ComponentManager      # Manages component lifecycle (timeouts, cleanup)
```

### Dynamic Components

Dynamic components are created on-demand and stored in memory. They're lost when the bot restarts.

**Use for**: Temporary interactions, user-specific actions, one-time confirmations

#### Creating a Dynamic Button

```typescript
import { BaseButton } from "#modules/components/BaseButton.js";
import type { ComponentContext } from "#modules/components/ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";
import { componentManager } from "#modules/components/ComponentManager.js";

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

#### Using Dynamic Components in Commands

```typescript
import { BaseCommand } from "#modules/commands/BaseCommand.js";
import { componentManager } from "#modules/components/ComponentManager.js";
import { MyButton } from "#modules/components/impl/util/MyButton.js";
import { BaseButton } from "#modules/components/BaseButton.js";

export class MyCommand extends BaseCommand {
  async execute(context: CommandContext): Promise<void> {
    const { api, interaction } = context;

    // Create and register component
    const button = new MyButton();
    componentManager.registerComponent(button, {
      timeout: 30 * 60 * 1000, // 30 minutes
      metadata: { originalUserId: context.userId },
    });

    // Send message with component
    await api.interactions.reply(interaction.id, interaction.token, {
      content: "Click the button below:",
      components: [BaseButton.createRow(button)],
    });
  }
}
```

### Persistent Components

Persistent components are registered at bot startup and survive restarts. They're always available.

**Use for**: System-wide buttons (ticket creation, permanent features), components that should work after restarts

#### Registering Persistent Components

**Option 1: Direct Registration** (for components with fixed customId):

```typescript
// In src/index.ts
import { componentRegistry } from "#modules/components/ComponentRegistry.js";
import { MyPersistentButton } from "#modules/components/impl/util/MyPersistentButton.js";

// Register persistent component
componentRegistry.register(new MyPersistentButton());
```

**Option 2: Factory Registration** (for components with dynamic parameters):

```typescript
// In src/index.ts
import { componentRegistry } from "#modules/components/ComponentRegistry.js";
import { ConfirmButtonFactory } from "#modules/components/impl/util/ConfirmButton.js";

// Register factory for components with dynamic customIds
componentRegistry.registerFactory(new ConfirmButtonFactory());
```

### Component Factories

Factories create component instances from `customId` patterns. They allow components with dynamic parameters to be persistent.

#### Creating a Component Factory

```typescript
import type { ComponentFactory } from "#modules/components/ComponentFactory.js";
import { ConfirmButton } from "./ConfirmButton.js";

export class ConfirmButtonFactory implements ComponentFactory<ConfirmButton> {
  private readonly PATTERN = /^util:confirm:(.+?)(?::(success|danger))?$/;

  canHandle(customId: string): boolean {
    return this.PATTERN.test(customId);
  }

  create(customId: string, context?: any): ConfirmButton {
    const match = customId.match(this.PATTERN);
    if (!match) {
      throw new Error(`Invalid customId format: ${customId}`);
    }

    const action = match[1];
    const style = (match[2] as "success" | "danger" | undefined) || "success";
    const metadata = context?.metadata;

    return new ConfirmButton(action, style, metadata);
  }

  getPattern(): string {
    return "util:confirm";
  }
}
```

**How it works:**

1. Factory is registered at startup: `componentRegistry.registerFactory(new ConfirmButtonFactory())`
2. When a button with `customId: "util:confirm:delete-message"` is clicked
3. `ComponentHandler` checks `ComponentRegistry`
4. Factory detects the pattern and creates a `ConfirmButton` instance
5. Component executes normally

**CustomId Format Examples:**

- `util:confirm:delete-message` → Creates ConfirmButton with action="delete-message", style="success"
- `util:confirm:delete-message:danger` → Creates ConfirmButton with action="delete-message", style="danger"
- `util:confirm:test-success` → Creates ConfirmButton with action="test-success", style="success" (inferred)

### Component Custom ID Format

Components use a namespace-based custom ID system:

- **Format**: `"namespace:component-id[:params]"`
- **Examples**: 
  - `leveling:claim-reward` (persistent, fixed)
  - `ticket:close-btn` (persistent, fixed)
  - `util:confirm:delete-message` (persistent, factory)
  - `test:button:abc123` (dynamic, temporary)

### Component Context

```typescript
interface ComponentContext {
  interaction: any;        // Raw interaction data
  api: any;               // Discord API instance
  guildId?: string;       // Server ID (if in guild)
  userId: string;         // User who clicked/interacted
  channelId?: string;      // Channel ID
  message?: any;          // Original message (if applicable)
  customId: string;       // Component's custom ID
  values?: string[];      // Selected values (for select menus)
  componentType: number;  // Component type constant
}
```

### Component Manager Features

```typescript
import { componentManager } from "#modules/components/ComponentManager.js";

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

#### ✅ DO

1. **Use meaningful namespaces** (`leveling:`, `ticket:`, `util:`)
2. **Use persistent components** for system-wide features
3. **Use dynamic components** for temporary, user-specific actions
4. **Implement proper validation** in the `validate()` method
5. **Handle errors gracefully** with user-friendly messages
6. **Use ephemeral responses** for sensitive operations
7. **Set appropriate timeouts** for temporary components

#### ❌ DON'T

1. **Never hardcode user IDs** - use metadata or validation
2. **Never ignore component validation** - always check permissions/context
3. **Never create long-lived dynamic components** - use persistent components instead
4. **Never use generic custom IDs** - be specific to avoid conflicts
5. **Never forget to handle component errors** - users will see failures

---

## Database & Repositories

The project uses Prisma ORM with a repository pattern for data access.

### Creating a Repository

```typescript
import { BaseRepository } from "#infrastructure/database/repositories/BaseRepository.js";
import { prisma } from "#infrastructure/database/prisma.js";
import { cacheService } from "#infrastructure/cache/CacheService.js";
import type { Prisma } from "../generated/prisma/client.js";

export class MyRepository extends BaseRepository<
  MyModel,                           // Model type
  Prisma.MyModelCreateInput,         // Create input type
  Prisma.MyModelUpdateInput          // Update input type
> {
  constructor() {
    super(
      "myModel",                     // Model name (for cache keys)
      prisma,                        // Prisma client
      cacheService,                  // Cache service
      {
        enableCache: true,           // Enable caching
        cacheTTL: 1800,              // Cache TTL in seconds (30 min)
        cacheNamespace: "myModel",   // Cache namespace
      }
    );
  }

  async findById(id: string): Promise<MyModel | null> {
    if (this.options.enableCache) {
      return await this.cache.getOrSet(
        this.getCacheKey(id),
        async () => {
          return await this.prisma.myModel.findUnique({
            where: { id },
          });
        },
        {
          ttl: this.options.cacheTTL,
          namespace: this.options.cacheNamespace,
        }
      );
    }

    return await this.prisma.myModel.findUnique({
      where: { id },
    });
  }

  async findAll(): Promise<MyModel[]> {
    return await this.prisma.myModel.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: Prisma.MyModelCreateInput): Promise<MyModel> {
    const model = await this.prisma.myModel.create({ data });
    
    // Invalidate cache if needed
    if (this.options.enableCache) {
      await this.invalidateAllCache();
    }
    
    return model;
  }

  async update(id: string, data: Prisma.MyModelUpdateInput): Promise<MyModel> {
    const model = await this.prisma.myModel.update({
      where: { id },
      data,
    });

    // Invalidate cache for this specific item
    if (this.options.enableCache) {
      await this.invalidateCache(id);
    }

    return model;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.myModel.delete({
      where: { id },
    });

    // Invalidate cache
    if (this.options.enableCache) {
      await this.invalidateCache(id);
    }
  }
}
```

### Using Repositories

```typescript
import { container } from "#core/Container.js";
import { MyRepository } from "#infrastructure/database/repositories/MyRepository.js";

// In Bot.ts or during registration
container.registerSingleton("MyRepository", () => new MyRepository());

// In commands, events, or systems
const myRepo = await container.resolve<MyRepository>("MyRepository");

// Use the repository
const model = await myRepo.findById("123");
const all = await myRepo.findAll();
const created = await myRepo.create({ name: "Test" });
const updated = await myRepo.update("123", { name: "Updated" });
await myRepo.delete("123");
```

### Transactions

```typescript
await myRepo.transaction(async (tx) => {
  const model1 = await tx.myModel.create({ data: { name: "Model 1" } });
  const model2 = await tx.myModel.create({ data: { name: "Model 2" } });
  return { model1, model2 };
});
```

---

## Cache System

The cache system uses Redis for distributed caching with automatic serialization.

### Using Cache Service

```typescript
import { cacheService } from "#infrastructure/cache/CacheService.js";

// Set a value
await cacheService.set("user:123", { name: "John", age: 30 }, {
  ttl: 3600,              // Time to live in seconds (1 hour)
  namespace: "users",      // Optional namespace
});

// Get a value
const user = await cacheService.get<{ name: string; age: number }>("user:123", {
  namespace: "users",
});

// Check if key exists
const exists = await cacheService.exists("user:123", { namespace: "users" });

// Delete a value
await cacheService.delete("user:123", { namespace: "users" });

// Delete by pattern
const deleted = await cacheService.deletePattern("user:*", { namespace: "users" });

// Increment a counter
const count = await cacheService.increment("views:page:123", {
  ttl: 86400, // 24 hours
  namespace: "analytics",
});

// Get or set pattern (cache-aside)
const data = await cacheService.getOrSet(
  "expensive:operation:123",
  async () => {
    // This function only runs on cache miss
    return await expensiveDatabaseQuery();
  },
  {
    ttl: 1800, // 30 minutes
    namespace: "operations",
  }
);
```

### Cache Best Practices

1. **Use namespaces** to organize cache keys
2. **Set appropriate TTLs** based on data freshness requirements
3. **Use `getOrSet`** for cache-aside pattern
4. **Invalidate cache** when data is updated
5. **Use cache for expensive operations** (DB queries, API calls)

---

## Dependency Injection

The project uses a simple DI container for managing service lifetimes.

### Registering Services

```typescript
import { container } from "#core/Container.js";
import { MyService } from "./MyService.js";
import { MyRepository } from "./MyRepository.js";

// Register as singleton (one instance shared across all requests)
container.registerSingleton("MyService", () => new MyService());

// Register as transient (new instance every time)
container.registerTransient("MyService", () => new MyService());

// Register with dependencies
container.registerSingleton("MyRepository", () => new MyRepository());
container.registerSingleton("MyService", () => {
  const repo = container.resolveSync<MyRepository>("MyRepository");
  return new MyService(repo);
});
```

### Resolving Services

```typescript
import { container } from "#core/Container.js";
import { MyService } from "./MyService.js";

// Resolve asynchronously (recommended)
const service = await container.resolve<MyService>("MyService");

// Resolve synchronously (only for already-instantiated singletons)
const service = container.resolveSync<MyService>("MyService");

// Check if service exists
if (container.has("MyService")) {
  const service = await container.resolve<MyService>("MyService");
}
```

### Service Registration in Bot.ts

Services are typically registered in `Bot.ts` during startup:

```typescript
// In Bot.ts registerDependencies()
container.registerSingleton("GuildRepository", () => new GuildRepository());
container.registerSingleton("ModerationConfigRepository", () => new ModerationConfigRepository());
container.registerSingleton("CommandHandler", () => new CommandHandler());
```

---

## Configuration

Configuration is managed through environment variables with validation.

### Environment Variables

Required variables (defined in `.env`):

```env
NODE_ENV=development                    # development | production | test
DISCORD_TOKEN=your_bot_token           # Discord bot token
DISCORD_CLIENT_ID=your_client_id      # Discord application ID
DATABASE_URL=postgresql://...          # PostgreSQL connection string
REDIS_URL=redis://localhost:6379      # Redis connection string
LOG_LEVEL=info                         # trace | debug | info | warn | error | fatal
```

### Using Config

```typescript
import { config } from "#core/Config.js";

// Get a config value
const token = config.get("DISCORD_TOKEN");
const clientId = config.get("DISCORD_CLIENT_ID");
const env = config.get("NODE_ENV");

// Config is validated at startup - invalid configs will throw errors
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
import { cooldownManager } from "#shared/utils/cooldown.js";

// In your command
async execute(context: CommandContext): Promise<void> {
  try {
    // Check cooldown (throws if on cooldown)
    await cooldownManager.checkCooldown(
      this.meta.name,
      context.userId,
      this.meta.cooldown ?? 0
    );
  } catch (error) {
    // User is on cooldown
    await api.interactions.reply(interaction.id, interaction.token, {
      content: "You're on cooldown!",
      flags: 64, // Ephemeral
    });
    return;
  }

  // Execute command logic...

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

// Structured logging with context
logger.info({ userId, guildId }, "Command executed");
logger.error({ error, command: "ping" }, "Command failed");
logger.debug({ data }, "Debug information");
logger.warn({ warning }, "Warning message");
logger.fatal({ error }, "Fatal error occurred");
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
8. **Use persistent components** for system-wide features
9. **Use dynamic components** for temporary, user-specific actions
10. **Invalidate cache** when data is updated
11. **Use transactions** for multi-step database operations

### ❌ DON'T

1. **Never create `new REST()` or `new API()`** in commands/events/components
2. **Never hardcode tokens** - use `config.get()`
3. **Never ignore errors** - at minimum log them
4. **Never use `any` type** when proper types exist
5. **Never make commands that don't respond** - Discord requires a response within 3 seconds
6. **Never create long-lived dynamic components** - use persistent components instead
7. **Never bypass the repository pattern** - always use repositories for database access
8. **Never cache sensitive data** without encryption

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
  api: API;                           // Discord API instance
  guildId: string;                   // Server ID
  userId: string;                     // User who ran the command
  channelId: string;                 // Channel where command was run
  options: Map<string, any>;          // Command options (flattened)
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
│   ├── <command>.ts      # Standalone command or subcommand
│   └── <group>/
│       └── <subcommand>.ts  # Nested subcommand
```

Examples:

- `/ping` → `impl/util/ping.ts`
- `/config` → `impl/config/index.ts`
- `/config message welcomecard` → `impl/config/message/welcomecard.ts`

---

## Quick Reference

### Registration Checklist

When creating a new feature:

1. ✅ Create command/event/system/component file
2. ✅ Import in `src/index.ts`
3. ✅ Register in `src/index.ts` bootstrap function
4. ✅ For commands: Register with Discord using `bot.registerCommands()`
5. ✅ For persistent components: Register in `componentRegistry`
6. ✅ For repositories: Register in `container` (Bot.ts)

### Common Patterns

**Command with Database + Cache:**
```typescript
const repo = await container.resolve<GuildRepository>("GuildRepository");
const guild = await repo.findById(guildId);
```

**Command with Component:**
```typescript
const button = new MyButton();
componentManager.registerComponent(button);
await api.interactions.reply(..., { components: [BaseButton.createRow(button)] });
```

**System with Event Subscription:**
```typescript
eventHandler.register(new MySystemEvent(this));
```

**Cache-Aside Pattern:**
```typescript
const data = await cacheService.getOrSet("key", async () => await fetchData(), { ttl: 3600 });
```

---

This guide should help you develop features without needing to read the source code. For specific implementation details, refer to the actual code files.
