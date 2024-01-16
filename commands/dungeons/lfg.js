const {
    ActionRowBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonBuilder,
} = require("discord.js");

const { dungeonList } = require("../../utils/loadJson");
const { getMainObject } = require("../../utils/getMainObject");
const { isDPSRole } = require("../../utils/utilFunctions");
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
                .setName("listed_as")
                .setDescription("Specify a listed as name for your dungeon. Otherwise one will be generated for you.")
                .setRequired(false)
        ),
    async execute(interaction) {
        const mainObject = getMainObject(interaction);

        // Set the listed as name if the user specified one
        const listedAs = interaction.options.getString("listed_as");
        if (listedAs) {
            mainObject.embedData.listedAs = listedAs;
        }

        // Timeout for the interaction collector
        const timeout = 60_000;

        const selectDungeon = new StringSelectMenuBuilder()
            .setCustomId("dungeons")
            .setPlaceholder("Select a dungeon")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                dungeonList.map((dungeon) => new StringSelectMenuOptionBuilder().setLabel(dungeon).setValue(dungeon))
            );

        // Parse key levels from the channel name
        const currentChannel = interaction.channel;
        const channelName = currentChannel.name;
        const channelNameSplit = channelName.split("-");
        const lowerDifficultyRange = parseInt(channelNameSplit[1].replace("m", ""));
        const upperDifficultyRange = lowerDifficultyRange === 21 ? 30 : parseInt(channelNameSplit[2].replace("m", ""));

        // Make a list with dungeon difficulty ranges like +2, +3, +4
        const dungeonDifficultyRanges = [];

        for (let i = lowerDifficultyRange; i <= upperDifficultyRange; i++) {
            dungeonDifficultyRanges.push(i);
        }

        const selectDifficulty = new StringSelectMenuBuilder()
            .setCustomId("difficulty")
            .setPlaceholder("Select a difficulty")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                dungeonDifficultyRanges.map((range) =>
                    new StringSelectMenuOptionBuilder().setLabel(`+${range}`).setValue(`${range}`)
                )
            );

        const selectTimedCompleted = new StringSelectMenuBuilder()
            .setCustomId("timedCompleted")
            .setPlaceholder("Is the goal to time or complete the dungeon?")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel("Timed").setValue("Timed"),
                new StringSelectMenuOptionBuilder().setLabel("Completed").setValue("Completed")
            );

        const selectUserRole = new StringSelectMenuBuilder()
            .setCustomId("userRole")
            .setPlaceholder("Select your role")
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
                new StringSelectMenuOptionBuilder().setLabel("DPS").setValue("DPS").setEmoji(mainObject.roles.DPS.emoji)
            );

        const confirmSuccess = new ButtonBuilder().setLabel("Create Group").setCustomId("confirm").setStyle(3);
        const confirmCancel = new ButtonBuilder().setLabel("Cancel").setCustomId("cancel").setStyle(4);

        const dungeonRow = new ActionRowBuilder().addComponents(selectDungeon);
        const difficultyRow = new ActionRowBuilder().addComponents(selectDifficulty);
        const timedCompletedRow = new ActionRowBuilder().addComponents(selectTimedCompleted);
        const userRoleRow = new ActionRowBuilder().addComponents(selectUserRole);
        const confirmCancelRow = new ActionRowBuilder().addComponents(confirmSuccess, confirmCancel);

        const dungeonResponse = await interaction.reply({
            ephemeral: true,
            components: [dungeonRow],
        });

        const userFilter = (i) => i.user.id === interaction.user.id;

        async function runCommandLogic() {
            try {
                const dungeonConfirmation = await dungeonResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const dungeonToRun = dungeonConfirmation.values[0];
                mainObject.embedData.dungeonName = dungeonToRun;

                const difficultyResponse = await dungeonConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}.`,
                    components: [difficultyRow],
                });

                const difficultyConfirmation = await difficultyResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const dungeonDifficulty = difficultyConfirmation.values[0];
                mainObject.embedData.dungeonDifficulty = `+${dungeonDifficulty}`;

                const timedCompletedResponse = await difficultyConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}`,
                    components: [timedCompletedRow],
                });

                const timedCompletedConfirmation = await timedCompletedResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const timedOrCompleted = timedCompletedConfirmation.values[0];
                mainObject.embedData.timedOrCompleted = timedOrCompleted;

                const userRoleResponse = await timedCompletedConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}\nTimed/Completed: ${timedOrCompleted}`,
                    components: [userRoleRow],
                });

                const userRoleConfirmation = await userRoleResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const userChosenRole = userRoleConfirmation.values[0];
                // Add the user's chosen role to the main object so it's easily accessible
                mainObject.interactionUser.userChosenRole = userChosenRole;

                // Calculate the eligible composition based on the user's chosen role
                const selectComposition = getEligibleComposition(mainObject);

                const teamCompositionRow = new ActionRowBuilder().addComponents(selectComposition);

                const compositionResponse = await userRoleConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}\nTimed/Completed: ${timedOrCompleted}\nYour role: ${userChosenRole}\nRequired roles:`,
                    components: [teamCompositionRow, confirmCancelRow],
                });

                // Temporary storage for dropdown values
                let dungeonCompositionList = null;

                // Create a collector for both dropdown and button interactions
                const confirmCollector = compositionResponse.createMessageComponentCollector({
                    filter: userFilter,
                    time: timeout,
                });

                confirmCollector.on("collect", async (i) => {
                    if (i.isStringSelectMenu()) {
                        dungeonCompositionList = i.values;

                        // This is required if user selects the wrong roles and wants to change them
                        await i.deferUpdate();
                    } else if (i.customId === "confirm") {
                        // Inform the user if they didn't select any roles
                        if (!dungeonCompositionList) {
                            // If the user didn't select any roles display a warning message
                            await compositionResponse.edit({
                                content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}\nTimed/Completed: ${timedOrCompleted}\nYour role: ${userChosenRole}\nRequired roles:\n**Please select at least one role!**`,
                                components: [teamCompositionRow, confirmCancelRow],
                            });

                            await i.deferUpdate();
                        } else {
                            // Add the user to the main object
                            mainObject.roles[userChosenRole].spots.push(mainObject.interactionUser.userId);
                            mainObject.roles[userChosenRole].nicknames.push(mainObject.interactionUser.nickname);

                            // Pull the filled spot from the main object
                            const filledSpot = mainObject.embedData.filledSpot;

                            for (const role in mainObject.roles) {
                                if (!dungeonCompositionList.includes(role)) {
                                    // Add filled members to the spots, except for the user's chosen role
                                    if (role !== userChosenRole) {
                                        if (isDPSRole(role)) {
                                            if (mainObject.roles["DPS"].spots.length < 3) {
                                                mainObject.roles["DPS"].spots.push(filledSpot);
                                                mainObject.roles["DPS"].nicknames.push(filledSpot);
                                            }
                                        } else {
                                            mainObject.roles[role].spots.push(filledSpot);
                                            mainObject.roles["DPS"].nicknames.push(filledSpot);
                                        }
                                    }

                                    if (isDPSRole(role) & (mainObject.roles["DPS"].spots.length >= 3)) {
                                        mainObject.roles["DPS"].disabled = true;
                                    } else if (!isDPSRole(role)) {
                                        mainObject.roles[role].disabled = true;
                                    }
                                }
                            }

                            const updatedDungeonCompositionList = dungeonCompositionList.map((role) => {
                                return role.startsWith("DPS") ? "DPS" : role;
                            });

                            if (i.customId === "confirm") {
                                await sendEmbed(mainObject, currentChannel, updatedDungeonCompositionList);

                                await i.reply({
                                    content: `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nLook out for NoP members applying with this in-game!`,
                                    ephemeral: true,
                                });

                                // Delete the interaction confirmation messages due to the ephemeral flag
                                await interaction.deleteReply();

                                // Send the created dungeon status to the database
                                await interactionStatusTable.create({
                                    interaction_id: interaction.id,
                                    interaction_user: interaction.user.id,
                                    interaction_status: "created",
                                });

                                confirmCollector.stop("confirmCreation");
                            }
                        }
                    } else if (i.customId === "cancel") {
                        await createStatusEmbed("LFG cancelled by the user.", compositionResponse);

                        interactionStatusTable.create({
                            interaction_id: interaction.id,
                            interaction_user: interaction.user.id,
                            interaction_status: "cancelled",
                        });
                    }
                });

                confirmCollector.on("end", async (collected, reason) => {
                    if (reason === "time") {
                        await compositionResponse.edit({
                            content: "LFG timed out! Please use /lfg again to create a new group.",
                            components: [],
                        });

                        interactionStatusTable.create({
                            interaction_id: interaction.id,
                            interaction_user: interaction.user.id,
                            interaction_status: "timeoutBeforeCreation",
                        });
                    }
                });
            } catch (e) {
                processError(e, interaction);
            }
        }
        runCommandLogic();
    },
};
