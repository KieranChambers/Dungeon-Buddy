const { errorTable } = require("./loadDb");

async function processError(error, interaction) {
    let errorName = "";
    // Check if the error is due to a timeout
    if (
        error.name.includes("InteractionCollectorError") &&
        error.message.includes("Collector received no interactions")
    ) {
        // Simpler name for a standard timeout error
        errorName = "timeout";

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

    // Send the error to the database
    await errorTable.create({
        error_name: errorName || error.name,
        error_message: error.message,
        user_id: interaction.user.id,
    });
}

module.exports = { processError };
