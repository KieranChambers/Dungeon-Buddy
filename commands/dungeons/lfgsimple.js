const {
    ActionRowBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
} = require("discord.js");

const { dungeonList } = require("../../utils/loadJson");
const { getMainObject } = require("../../utils/getMainObject");
const { stripListedAsNumbers, isDPSRole } = require("../../utils/utilFunctions");
const { getEligibleComposition } = require("../../utils/dungeonLogic");
const { sendEmbed } = require("../../utils/sendEmbed");
const { interactionStatusTable } = require("../../utils/loadDb");
const { processError, createStatusEmbed } = require("../../utils/errorHandling");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lfgsimple")
        .setDescription("Post a message to find a group for your key.")
        .addStringOption((option) =>
            option
                .setName("dungeon")
                .setDescription("Select a dungeon to run.")
                .setRequired(true)
                .addChoices(...dungeonList.map((dungeon) => ({ name: dungeon, value: dungeon })))
        )
        .addStringOption((option) =>
            option
                .setName("listed_as")
                .setDescription("Specify a listed as name for your dungeon. Otherwise one will be generated for you.")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("creator_notes")
                .setDescription("Add some additional information about your group.")
                .setRequired(false)
        ),
    async execute(interaction) {
        const mainObject = getMainObject(interaction);

        const dungeonToRun = interaction.options.getString("dungeon");
        mainObject.embedData.dungeonName = dungeonToRun;

        // Set the listed as group name/creator notes if the user specified one
        const listedAs = interaction.options.getString("listed_as");
        if (listedAs) {
            const tempListedAs = stripListedAsNumbers(listedAs);
            if (tempListedAs) {
                mainObject.embedData.listedAs = tempListedAs;
            }
        }
        const creatorNotes = interaction.options.getString("creator_notes");
        if (creatorNotes) {
            mainObject.embedData.creatorNotes = creatorNotes;
        }

        // Timeout for the interaction collector
        const timeout = 90_000;

        // Parse key levels from the channel name
        const currentChannel = interaction.channel;
        const channelName = currentChannel.name;
        const channelNameSplit = channelName.split("-");
        const lowerDifficultyRange = parseInt(channelNameSplit[1].replace("m", ""));
        const upperDifficultyRange = lowerDifficultyRange === 0 ? 0 : parseInt(channelNameSplit[2].replace("m", ""));
        const difficultyPrefix = lowerDifficultyRange === 0 ? "M" : "+";

        // Make a list with dungeon difficulty ranges like +2, +3, +4
        const dungeonDifficultyRanges = [];

        for (let i = lowerDifficultyRange; i <= upperDifficultyRange; i++) {
            dungeonDifficultyRanges.push(i);
        }

        function getSelectDifficultyRow(difficultyPlaceholder) {
            const getSelectDifficulty = new StringSelectMenuBuilder()
                .setCustomId("difficulty")
                .setPlaceholder(difficultyPlaceholder)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    dungeonDifficultyRanges.map((range) =>
                        new StringSelectMenuOptionBuilder().setLabel(`${difficultyPrefix}${range}`).setValue(`${range}`)
                    )
                );

            const difficultyRow = new ActionRowBuilder().addComponents(getSelectDifficulty);
            return difficultyRow;
        }

        function getTimeCompletionRow(timeCompletionPlaceholder) {
            const getTimeCompletion = new StringSelectMenuBuilder()
                .setCustomId("timeCompletion")
                .setPlaceholder(timeCompletionPlaceholder)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel("Time").setValue("Time"),
                    new StringSelectMenuOptionBuilder().setLabel("Completion").setValue("Completion")
                );

            const timeCompletionRow = new ActionRowBuilder().addComponents(getTimeCompletion);
            return timeCompletionRow;
        }

        function getConfirmCancelRow() {
            const confirmSuccess = new ButtonBuilder().setLabel("Create Group").setCustomId("confirm").setStyle(3);
            const confirmCancel = new ButtonBuilder().setLabel("Cancel").setCustomId("cancel").setStyle(4);

            const confirmCancelRow = new ActionRowBuilder().addComponents(confirmSuccess, confirmCancel);
            return confirmCancelRow;
        }

        function getRows(difficultyPlaceholder, timeCompletionPlaceholder) {
            const difficultyRow = getSelectDifficultyRow(difficultyPlaceholder);
            const timeCompletionRow = getTimeCompletionRow(timeCompletionPlaceholder);
            const confirmCancelRow = getConfirmCancelRow();

            return [difficultyRow, timeCompletionRow, confirmCancelRow];
        }

        // Temporary storage for dropdown values
        let dungeonDifficultyPlaceholder = "Select a difficulty";
        let timeOrCompletionPlaceholder = "Time/Completion?";

        async function updateRows(i, msgContent, dungeonDifficulty, timeOrCompletion) {
            const [difficultyRow, timeCompletionRow, confirmCancelRow] = getRows(
                dungeonDifficulty || dungeonDifficultyPlaceholder,
                timeOrCompletion || timeOrCompletionPlaceholder
            );

            await i.update({
                content: msgContent,
                ephemeral: true,
                components: [difficultyRow, timeCompletionRow, confirmCancelRow],
            });
        }

        const userFilter = (i) => i.user.id === interaction.user.id;

        try {
            const [difficultyRow, timeCompletionRow, confirmCancelRow] = getRows(
                dungeonDifficultyPlaceholder,
                timeOrCompletionPlaceholder
            );

            let messageContent = `You are creating a group for ${dungeonToRun}.`;
            const dungeonResponse = await interaction.reply({
                content: messageContent,
                ephemeral: true,
                components: [difficultyRow, timeCompletionRow, confirmCancelRow],
            });

            // Temporary storage for dungeon/group values
            let dungeonDifficulty = null;
            let timeOrCompletion = null;

            // Create a collector for both the drop-down menu and button interactions
            const dungeonCollector = dungeonResponse.createMessageComponentCollector({
                filter: userFilter,
                time: timeout,
            });

            dungeonCollector.on("collect", async (i) => {
                if (i.customId === "difficulty") {
                    dungeonDifficulty = `${difficultyPrefix}${i.values[0]}`;
                    mainObject.embedData.dungeonDifficulty = dungeonDifficulty;

                    await i.deferUpdate();
                } else if (i.customId === "timeCompletion") {
                    timeOrCompletion = i.values[0];
                    mainObject.embedData.timeOrCompletion = timeOrCompletion;

                    await i.deferUpdate();
                } else if (i.customId === "confirm") {
                    // Notify the user if they haven't selected all the required options
                    // With a unique message for each missing option in order of priority
                    let messageContentMissing = messageContent;
                    if (!dungeonDifficulty) {
                        messageContentMissing += "\n**Please select a difficulty.**";
                    } else if (!timeOrCompletion) {
                        messageContentMissing += "\n**Please select time/completion.**";
                    }

                    if (!dungeonDifficulty || !timeOrCompletion) {
                        await updateRows(i, messageContentMissing, dungeonDifficulty, timeOrCompletion);
                    }
                } else if (i.customId === "cancel") {
                    dungeonCollector.stop("cancelled");
                }
            });

            dungeonCollector.on("end", async (collected, reason) => {
                if (reason === "time") {
                    await dungeonResponse.edit({
                        content: "LFG timed out! Please use /lfgsimple again to create a new group.",
                        components: [],
                    });

                    interactionStatusTable.create({
                        interaction_id: interaction.id,
                        interaction_user: interaction.user.id,
                        interaction_status: "timeoutBeforeCreation",
                        command_used: "lfgsimple",
                    });
                } else if (reason === "cancelled") {
                    await createStatusEmbed("LFG cancelled by the user.", dungeonResponse);

                    interactionStatusTable.create({
                        interaction_id: interaction.id,
                        interaction_user: interaction.user.id,
                        interaction_status: "cancelled",
                        command_used: "lfgsimple",
                    });
                }
            });
        } catch (e) {
            processError(e, interaction);
        }
    },
};
