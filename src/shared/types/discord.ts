import type {
  APIInteraction,
  APIChatInputApplicationCommandInteraction,
  APIApplicationCommandInteractionDataOption,
  APIApplicationCommandOption,
} from '@discordjs/core';
import type { API } from '@discordjs/core';

export type ChatInputInteraction = APIChatInputApplicationCommandInteraction;

export interface CommandContext {
  interaction: ChatInputInteraction;
  api: API;
  guildId: string;
  userId: string;
  channelId: string;
  options: Map<string, any>;
}

export interface SubcommandGroupData {
  name: string;
  description: string;
  subcommands: SubcommandData[];
}

export interface SubcommandData {
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
}

export interface CommandData {
  name: string;
  description: string;
  options?: APIApplicationCommandOption[];
  defaultMemberPermissions?: string;
  dmPermission?: boolean;
}
