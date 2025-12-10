import { BaseButton } from "../../BaseButton.js";
import type { ComponentContext } from "../../ComponentHandler.js";
import { ButtonStyle } from "@discordjs/core";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { logger } from "#core/Logger.js";

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