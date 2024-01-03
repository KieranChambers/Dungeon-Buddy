const { ButtonBuilder } = require("discord.js");

// TODO: Edit this function to allow for sending buttons with text rather than emojis and fix formatting issue

function createButton({ customId, emoji, style, disabled }) {
    return new ButtonBuilder().setCustomId(customId).setEmoji(emoji).setStyle(style).setDisabled(disabled);
}

module.exports = { createButton };
