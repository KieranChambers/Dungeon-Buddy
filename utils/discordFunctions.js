const { ButtonBuilder } = require("discord.js");

function createButton({ customId, label, emoji, style, disabled }) {
    const button = new ButtonBuilder().setCustomId(customId).setStyle(style).setDisabled(disabled);

    if (label) {
        button.setLabel(label);
    }

    if (emoji) {
        button.setEmoji(emoji);
    }

    return button;
}

module.exports = { createButton };
