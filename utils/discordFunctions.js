const { ButtonBuilder } = require("discord.js");

function createButton({ customId, emoji, style, disabled }) {
    return new ButtonBuilder()
        .setCustomId(customId)
        .setEmoji(emoji)
        .setStyle(style)
        .setDisabled(disabled);
}

module.exports = { createButton };
