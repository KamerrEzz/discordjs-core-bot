import type { APIEmbed } from '@discordjs/core';

export class EmbedBuilder {
  private embed: APIEmbed = {};

  setTitle(title: string): this {
    this.embed.title = title;
    return this;
  }

  setDescription(description: string): this {
    this.embed.description = description;
    return this;
  }

  setColor(color: number): this {
    this.embed.color = color;
    return this;
  }

  setAuthor(name: string, iconURL?: string, url?: string): this {
    this.embed.author = {
      name,
      icon_url: iconURL,
      url,
    };
    return this;
  }

  setFooter(text: string, iconURL?: string): this {
    this.embed.footer = {
      text,
      icon_url: iconURL,
    };
    return this;
  }

  setTimestamp(timestamp?: Date | number): this {
    this.embed.timestamp = timestamp
      ? new Date(timestamp).toISOString()
      : new Date().toISOString();
    return this;
  }

  setThumbnail(url: string): this {
    this.embed.thumbnail = { url };
    return this;
  }

  setImage(url: string): this {
    this.embed.image = { url };
    return this;
  }

  addField(name: string, value: string, inline: boolean = false): this {
    if (!this.embed.fields) {
      this.embed.fields = [];
    }
    this.embed.fields.push({ name, value, inline });
    return this;
  }

  addFields(...fields: { name: string; value: string; inline?: boolean }[]): this {
    if (!this.embed.fields) {
      this.embed.fields = [];
    }
    this.embed.fields.push(...fields.map(f => ({ ...f, inline: f.inline ?? false })));
    return this;
  }

  setURL(url: string): this {
    this.embed.url = url;
    return this;
  }

  toJSON(): APIEmbed {
    return this.embed;
  }
}

// Color constants
export const Colors = {
  Default: 0x000000,
  White: 0xffffff,
  Aqua: 0x1abc9c,
  Green: 0x57f287,
  Blue: 0x3498db,
  Yellow: 0xfee75c,
  Purple: 0x9b59b6,
  LuminousVividPink: 0xe91e63,
  Fuchsia: 0xeb459e,
  Gold: 0xf1c40f,
  Orange: 0xe67e22,
  Red: 0xed4245,
  Grey: 0x95a5a6,
  Navy: 0x34495e,
  DarkAqua: 0x11806a,
  DarkGreen: 0x1f8b4c,
  DarkBlue: 0x206694,
  DarkPurple: 0x71368a,
  DarkVividPink: 0xad1457,
  DarkGold: 0xc27c0e,
  DarkOrange: 0xa84300,
  DarkRed: 0x992d22,
  DarkGrey: 0x979c9f,
  DarkerGrey: 0x7f8c8d,
  LightGrey: 0xbcc0c0,
  DarkNavy: 0x2c3e50,
  Blurple: 0x5865f2,
  Greyple: 0x99aab5,
  DarkButNotBlack: 0x2c2f33,
  NotQuiteBlack: 0x23272a,
} as const;
