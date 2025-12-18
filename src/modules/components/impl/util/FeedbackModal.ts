import { BaseModal, TextInputStyle } from "../../BaseModal.js";
import type { ComponentContext } from "../../ComponentHandler.js";
import { EmbedBuilder, Colors } from "#shared/utils/embed.js";
import { logger } from "#core/Logger.js";

/**
 * Feedback Modal Component
 * Example modal for collecting user feedback
 */
export class FeedbackModal extends BaseModal {
  public readonly customId = "util:feedback:modal";
  public readonly title = "Send Feedback";
  public readonly inputs = [
    {
      customId: "feedback:subject",
      label: "Subject",
      style: TextInputStyle.Short,
      placeholder: "Brief description of your feedback",
      required: true,
      minLength: 3,
      maxLength: 100,
    },
    {
      customId: "feedback:message",
      label: "Message",
      style: TextInputStyle.Paragraph,
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

    const subject = modalData.get("feedback:subject") || "No subject";
    const message = modalData.get("feedback:message") || "No message";

    // Log feedback
    logger.info({ userId, subject, message }, "Feedback received");

    // Send confirmation
    const embed = new EmbedBuilder()
      .setTitle("✅ Feedback Received")
      .setDescription("Thank you for your feedback! We'll review it soon.")
      .addField("Subject", subject)
      .addField("Message", message.length > 1024 ? message.substring(0, 1021) + "..." : message)
      .setColor(Colors.Green)
      .setTimestamp()
      .toJSON();

    await api.interactions.reply(interaction.id, interaction.token, {
      embeds: [embed],
      flags: 64, // Ephemeral
    });
  }
}

