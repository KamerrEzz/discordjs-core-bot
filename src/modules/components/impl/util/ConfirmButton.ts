import { BaseButton } from "../../BaseButton.js";
import type { ComponentContext } from "../../ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { logger } from "#core/Logger.js";
import type { ComponentFactory } from "../../ComponentFactory.js";

/**
 * Confirm Button Component
 * A reusable confirmation button with success/danger styles
 */
export class ConfirmButton extends BaseButton {
  public readonly customId: string;
  public readonly style: ButtonStyle;
  public readonly label: string;

  constructor(
    private action: string,
    private confirmStyle: "success" | "danger" = "success",
    private metadata?: Record<string, any>
  ) {
    super();
    
    this.customId = `util:confirm:${action}`;
    this.style = confirmStyle === "success" ? ButtonStyle.Success : ButtonStyle.Danger;
    this.label = confirmStyle === "success" ? "✅ Confirm" : "❌ Cancel";
    (this as any).once = true; // One-time use
  }

  async execute(context: ComponentContext): Promise<void> {
    const { api, interaction, userId } = context;

    // Check if user is the original interaction user
    if (this.metadata?.originalUserId && this.metadata.originalUserId !== userId) {
      await api.interactions.reply(interaction.id, interaction.token, {
        content: "❌ This button is not for you!",
        flags: 64, // Ephemeral
      });
      return;
    }

    // Execute confirmation action
    const embed = new EmbedBuilder()
      .setTitle(this.action)
      .setDescription(
        this.confirmStyle === "success" 
          ? `✅ <@${userId}> confirmed the action.`
          : `❌ <@${userId}> cancelled the action.`
      )
      .setColor(this.confirmStyle === "success" ? Colors.Green : Colors.Red)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
    });

    // Log the action
    logger.info({ 
      userId, 
      action: this.action, 
      confirmed: this.confirmStyle === "success",
      metadata: this.metadata 
    }, "Confirmation button executed");
  }

  /**
   * Static factory method to create confirm/cancel button pair
   */
  public static createConfirmPair(
    action: string,
    originalUserId: string,
    metadata?: Record<string, any>
  ): [ConfirmButton, ConfirmButton] {
    const confirmButton = new ConfirmButton(action, "success", {
      ...metadata,
      originalUserId,
    });

    const cancelButton = new ConfirmButton(action, "danger", {
      ...metadata,
      originalUserId,
    });

    return [confirmButton, cancelButton];
  }
}

/**
 * Factory for creating ConfirmButton instances from customId
 * Allows ConfirmButton to be persistent across bot restarts
 * 
 * CustomId format: util:confirm:${action} or util:confirm:${action}:${style}
 * Examples:
 * - util:confirm:test-success -> ConfirmButton with action="test-success", style="success"
 * - util:confirm:test-danger -> ConfirmButton with action="test-danger", style="danger"
 * - util:confirm:delete:success -> ConfirmButton with action="delete", style="success"
 */
export class ConfirmButtonFactory implements ComponentFactory<ConfirmButton> {
  private readonly PATTERN = /^util:confirm:(.+?)(?::(success|danger))?$/;

  canHandle(customId: string): boolean {
    return this.PATTERN.test(customId);
  }

  create(customId: string, context?: any): ConfirmButton {
    const match = customId.match(this.PATTERN);
    if (!match) {
      throw new Error(`Invalid ConfirmButton customId format: ${customId}`);
    }

    const action = match[1];
    const style = (match[2] as "success" | "danger" | undefined) || this.inferStyleFromAction(action);

    // Try to extract metadata from context if available
    const metadata = context?.metadata;

    return new ConfirmButton(action, style, metadata);
  }

  getPattern(): string {
    return "util:confirm";
  }

  /**
   * Infer button style from action name
   * If action ends with "-success" or "-danger", use that style
   * Otherwise default to "success"
   */
  private inferStyleFromAction(action: string): "success" | "danger" {
    if (action.endsWith("-danger") || action.endsWith("-cancel")) {
      return "danger";
    }
    if (action.endsWith("-success") || action.endsWith("-confirm")) {
      return "success";
    }
    // Default to success for confirm buttons
    return "success";
  }
}