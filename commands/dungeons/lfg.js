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
        .setName("lfg")
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
        const isSingularKeyLevel = channelNameSplit.length === 2;

        const lowerDifficultyRange = parseInt(channelNameSplit[1].replace("m", ""));

        let upperDifficultyRange;
        if (isSingularKeyLevel) {
            upperDifficultyRange = lowerDifficultyRange;
        } else {
            upperDifficultyRange = parseInt(channelNameSplit[2].replace("m", ""));
        }

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
                    new StringSelectMenuOptionBuilder().setLabel("Time or abandon").setValue("timeorabandon"),
                    new StringSelectMenuOptionBuilder().setLabel("Time but complete").setValue("timebutcomplete"),
                    new StringSelectMenuOptionBuilder().setLabel("Vault completion").setValue("vaultcompletion")
                );

            const timeCompletionRow = new ActionRowBuilder().addComponents(getTimeCompletion);
            return timeCompletionRow;
        }

        function getSelectUserRoleRow(userRolePlaceholder) {
            const getSelectUserRow = new StringSelectMenuBuilder()
                .setCustomId("userRole")
                .setPlaceholder(userRolePlaceholder)
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel("Tank")
                        .setValue("Tank")
                        .setEmoji(mainObject.roles.Tank.emoji),
                    new StringSelectMenuOptionBuilder()
                        .setLabel("Healer")
                        .setValue("Healer")
                        .setEmoji(mainObject.roles.Healer.emoji),
                    new StringSelectMenuOptionBuilder()
                        .setLabel("DPS")
                        .setValue("DPS")
                        .setEmoji(mainObject.roles.DPS.emoji)
                );

            const userRoleRow = new ActionRowBuilder().addComponents(getSelectUserRow);
            return userRoleRow;
        }

        function getEligibleCompositionRow() {
            const eligibleComposition = getEligibleComposition(mainObject);

            const eligibleCompositionRow = new ActionRowBuilder().addComponents(eligibleComposition);
            return eligibleCompositionRow;
        }

        function getConfirmCancelRow() {
            const confirmSuccess = new ButtonBuilder().setLabel("Create Group").setCustomId("confirm").setStyle(3);
            const confirmCancel = new ButtonBuilder().setLabel("Cancel").setCustomId("cancel").setStyle(4);

            const confirmCancelRow = new ActionRowBuilder().addComponents(confirmSuccess, confirmCancel);
            return confirmCancelRow;
        }

        function getRows(
            difficultyPlaceholder,
            timeCompletionPlaceholder,
            selectUserPlaceholder,
            teamCompositionPlaceholder
        ) {
            const difficultyRow = getSelectDifficultyRow(difficultyPlaceholder);
            const timeCompletionRow = getTimeCompletionRow(timeCompletionPlaceholder);
            const userRoleRow = getSelectUserRoleRow(selectUserPlaceholder);
            const eligibleCompositionRow = getEligibleCompositionRow(teamCompositionPlaceholder);
            const confirmCancelRow = getConfirmCancelRow();

            return [difficultyRow, timeCompletionRow, userRoleRow, eligibleCompositionRow, confirmCancelRow];
        }

        // Temporary storage for dropdown values
        let dungeonDifficultyPlaceholder = "Select a difficulty";
        let timeOrCompletionPlaceholder = "Time/Abandon/Completion?";
        let userChosenRolePlaceholder = "Select your role";
        let dungeonCompositionPlaceholder = "Select your composition";

        async function updateRows(
            i,
            msgContent,
            dungeonDifficulty,
            timeOrCompletion,
            userChosenRole,
            dungeonComposition
        ) {
            const [difficultyRow, timeCompletionRow, userRoleRow, eligibleCompositionRow, confirmCancelRow] = getRows(
                dungeonDifficulty || dungeonDifficultyPlaceholder,
                timeOrCompletion || timeOrCompletionPlaceholder,
                userChosenRole || userChosenRolePlaceholder,
                dungeonComposition || dungeonCompositionPlaceholder
            );

            await i.update({
                content: msgContent,
                ephemeral: true,
                components: [difficultyRow, timeCompletionRow, userRoleRow, eligibleCompositionRow, confirmCancelRow],
            });
        }

        const userFilter = (i) => i.user.id === interaction.user.id;

        try {
            const [difficultyRow, timeCompletionRow, userRoleRow, eligibleCompositionRow, confirmCancelRow] = getRows(
                dungeonDifficultyPlaceholder,
                timeOrCompletionPlaceholder,
                userChosenRolePlaceholder,
                dungeonCompositionPlaceholder
            );

            let messageContent = `You are creating a group for ${dungeonToRun}.`;
            const dungeonResponse = await interaction.reply({
                content: messageContent,
                ephemeral: true,
                components: [difficultyRow, timeCompletionRow, userRoleRow, eligibleCompositionRow, confirmCancelRow],
            });

            // Temporary storage for dungeon/group values
            let dungeonDifficulty = null;
            let timeOrCompletion = null;
            let userChosenRole = null;
            let dungeonComposition = null;
            let dungeonCompositionList = null;

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
                } else if (i.customId === "userRole") {
                    // Need to reset the composition list if the user changes their role to avoid
                    // the incorrect composition being sent to the embed
                    if (userChosenRole !== i.values[0]) {
                        dungeonCompositionList = null;
                        dungeonComposition = null;
                    }

                    // Add the user's chosen role to the main object so it's easily accessible
                    userChosenRole = i.values[0];
                    mainObject.interactionUser.userChosenRole = userChosenRole;

                    // Update the required composition drop-down based on the user's chosen role
                    await updateRows(
                        i,
                        messageContent,
                        dungeonDifficulty,
                        timeOrCompletion,
                        userChosenRole,
                        dungeonComposition
                    );
                } else if (i.customId === "composition") {
                    await i.deferUpdate();

                    // Return if the user tries to create a group without selecting their own role
                    if (i.values[0] === "none") {
                        return;
                    }
                    dungeonCompositionList = i.values;
                    dungeonComposition = dungeonCompositionList.join(", ");
                }
                // This is required if user selects the wrong options
                else if (i.customId === "confirm") {
                    // Notify the user if they haven't selected all the required options
                    // With a unique message for each missing option in order of priority
                    let messageContentMissing = messageContent;
                    if (!dungeonDifficulty) {
                        messageContentMissing += "\n**Please select a difficulty.**";
                    } else if (!timeOrCompletion) {
                        messageContentMissing += "\n**Please select time/completion.**";
                    } else if (!userChosenRole) {
                        messageContentMissing += "\n**Please select your role.**";
                    } else if (!dungeonComposition) {
                        messageContentMissing += "\n**Please select required roles.**";
                    }

                    if (!dungeonDifficulty || !timeOrCompletion || !userChosenRole || !dungeonComposition) {
                        await updateRows(
                            i,
                            messageContentMissing,
                            dungeonDifficulty,
                            timeOrCompletion,
                            userChosenRole,
                            dungeonComposition
                        );
                    } else {
                        // Add the user to the main object
                        mainObject.roles[userChosenRole].spots.push(mainObject.interactionUser.userId);
                        mainObject.roles[userChosenRole].nicknames.push(mainObject.interactionUser.nickname + " 🚩");

                        // Pull the filled spot from the main object
                        const filledSpot = mainObject.embedData.filledSpot;
                        let filledSpotCounter = 0;

                        for (const role in mainObject.roles) {
                            if (!dungeonCompositionList.includes(role)) {
                                const filledSpotCombined = `${filledSpot}${filledSpotCounter}`;
                                // Add filled members to the spots, except for the user's chosen role
                                if (role !== userChosenRole) {
                                    if (isDPSRole(role)) {
                                        if (mainObject.roles["DPS"].spots.length < 3) {
                                            mainObject.roles["DPS"].spots.push(filledSpotCombined);
                                            mainObject.roles["DPS"].nicknames.push(filledSpot);
                                        }
                                    } else {
                                        mainObject.roles[role].spots.push(filledSpotCombined);
                                        mainObject.roles[role].nicknames.push(filledSpot);
                                    }
                                }

                                if (isDPSRole(role) & (mainObject.roles["DPS"].spots.length >= 3)) {
                                    mainObject.roles["DPS"].disabled = true;
                                } else if (!isDPSRole(role)) {
                                    mainObject.roles[role].disabled = true;
                                }
                                filledSpotCounter++;
                            }
                        }

                        // Update the filled spot counter in the main object
                        mainObject.embedData.filledSpotCounter = filledSpotCounter;

                        const updatedDungeonCompositionList = dungeonCompositionList.map((role) => {
                            return role.startsWith("DPS") ? "DPS" : role;
                        });

                        await i.update({
                            content: `**Please ensure applying members are __from NoP__ and __use the passphrase__ in-game!**\nThe passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\``,
                            components: [],
                        });

                        await sendEmbed(mainObject, currentChannel, updatedDungeonCompositionList);

                        // Send the created dungeon status to the database
                        await interactionStatusTable.create({
                            interaction_id: interaction.id,
                            interaction_user: interaction.user.id,
                            interaction_status: "created",
                            command_used: "lfg",
                        });

                        dungeonCollector.stop("confirmCreation");
                    }
                } else if (i.customId === "cancel") {
                    dungeonCollector.stop("cancelled");
                }
            });

            dungeonCollector.on("end", async (_, reason) => {
                if (reason === "time") {
                    await dungeonResponse.edit({
                        content: "LFG timed out! Please use /lfg again to create a new group.",
                        components: [],
                    });

                    interactionStatusTable.create({
                        interaction_id: interaction.id,
                        interaction_user: interaction.user.id,
                        interaction_status: "timeoutBeforeCreation",
                        command_used: "lfg",
                    });
                } else if (reason === "cancelled") {
                    await createStatusEmbed("LFG cancelled by the user.", dungeonResponse);

                    interactionStatusTable.create({
                        interaction_id: interaction.id,
                        interaction_user: interaction.user.id,
                        interaction_status: "cancelled",
                        command_used: "lfg",
                    });
                }
            });
        } catch (e) {
            processError(e, interaction);
        }
    },
};
