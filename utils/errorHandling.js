async function processError(error, interaction) {
    // Check if the error is due to a timeout
    if (
        error.name.includes("InteractionCollectorError") &&
        error.message.includes("Collector received no interactions")
    ) {
        // Inform user about the timeout
        await interaction.editReply({
            content:
                "You did not respond in time (60s).\nPlease try the command again if you wish to create a group.",
            ephemeral: true,
            components: [],
        });
    } else {
        // Optionally send a message to the user if the error is different
        await interaction.editReply({
            content: "An error occurred while processing your request.",
            ephemeral: true,
            components: [],
        });
    }
}
