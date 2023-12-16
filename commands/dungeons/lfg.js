const {
    ActionRowBuilder,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ComponentType,
    ButtonBuilder,
    ButtonStyle,
} = require("discord.js");

const { dungeonList, wowWords } = require("../../utils/loadJson");
const { generatePassphrase, isDPSRole } = require("../../utils/utilFunctions");
const { getEligibleComposition } = require("../../utils/dungeonLogic");
const { sendEmbed } = require("../../utils/sendEmbed");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lfg")
        .setDescription("Post a message to find a group for your key."),
    async execute(interaction) {
        const mainObject = {
            roles: {
                Tank: {
                    spots: [],
                    style: ButtonStyle.Secondary,
                    disabled: false,
                    customId: "Tank",
                    emoji: `<:tankrole:1181327150708686848>`,
                },
                Healer: {
                    spots: [],
                    style: ButtonStyle.Secondary,
                    disabled: false,
                    customId: "Healer",
                    emoji: `<:healrole:1181327153749561364>`,
                },
                DPS: {
                    spots: [],
                    style: ButtonStyle.Secondary,
                    disabled: false,
                    customId: "DPS",
                    emoji: `<:dpsrole:1181327148624117870>`,
                },
                DPS2: {
                    customId: "DPS2",
                    emoji: `<:dpsrole:1181327148624117870>`,
                },
                DPS3: {
                    customId: "DPS3",
                    emoji: `<:dpsrole:1181327148624117870>`,
                },
            },
            embedData: {
                dungeonName: "",
                dungeonDifficulty: "",
                listedAs: "",
                spotIcons: [],
                filledSpot: "~~Filled Spot~~",
            },
            interactionUser: {
                userId: `<@${interaction.user.id}>`,
                userChosenRole: "",
            },
            utils: {
                passphrase: {
                    phrase: generatePassphrase(wowWords),
                },
            },
        };

        const timeout = 60_000;

        const selectDungeon = new StringSelectMenuBuilder()
            .setCustomId("dungeons")
            .setPlaceholder("Select a dungeon")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                dungeonList.map((dungeon) =>
                    new StringSelectMenuOptionBuilder().setLabel(dungeon).setValue(dungeon)
                )
            );

        // Parse key levels from the channel name
        const currentChannel = interaction.channel;
        const channelName = currentChannel.name;
        const channelNameSplit = channelName.split("-");
        const lowerDifficultyRange = parseInt(channelNameSplit[1].replace("m", ""));
        const upperDifficultyRange =
            lowerDifficultyRange === 21 ? 30 : parseInt(channelNameSplit[2].replace("m", ""));

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
                new StringSelectMenuOptionBuilder()
                    .setLabel("DPS")
                    .setValue("DPS")
                    .setEmoji(mainObject.roles.DPS.emoji)
            );

        const confirmSuccess = new ButtonBuilder()
            .setLabel("Confirm")
            .setCustomId("confirm")
            .setStyle(3);

        const confirmCancel = new ButtonBuilder()
            .setLabel("Cancel")
            .setCustomId("cancel")
            .setStyle(4);

        const dungeonRow = new ActionRowBuilder().addComponents(selectDungeon);
        const difficultyRow = new ActionRowBuilder().addComponents(selectDifficulty);
        const userRoleRow = new ActionRowBuilder().addComponents(selectUserRole);

        const confirmCancelRow = new ActionRowBuilder().addComponents(
            confirmSuccess,
            confirmCancel
        );

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

                const userRoleResponse = await difficultyConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}`,
                    components: [userRoleRow],
                });

                const userRoleConfirmation = await userRoleResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const userChosenRole = userRoleConfirmation.values[0];
                mainObject.interactionUser.userChosenRole = userChosenRole;

                // Calculate the eligible composition based on the user's chosen role
                const selectComposition = getEligibleComposition(mainObject);

                const teamCompositionRow = new ActionRowBuilder().addComponents(selectComposition);

                const compositionResponse = await userRoleConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}\nDifficulty: +${dungeonDifficulty}\nYour role: ${userChosenRole}\n`,
                    components: [teamCompositionRow],
                });

                const compositionConfirmation = await compositionResponse.awaitMessageComponent({
                    filter: userFilter,
                    time: timeout,
                });

                const dungeonCompositionList = compositionConfirmation.values;

                mainObject.roles[userChosenRole].spots.push(mainObject.interactionUser.userId);

                const filledSpot = mainObject.embedData.filledSpot;

                for (const role in mainObject.roles) {
                    if (!dungeonCompositionList.includes(role)) {
                        // Add filled members to the spots, except for the user's chosen role
                        if (role !== userChosenRole) {
                            if (isDPSRole(role)) {
                                if (mainObject.roles["DPS"].spots.length < 3) {
                                    mainObject.roles["DPS"].spots.push(filledSpot);
                                }
                            } else {
                                mainObject.roles[role].spots.push(filledSpot);
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
                const dungeonComposition = updatedDungeonCompositionList.join(", ");

                await compositionConfirmation.update({
                    content: `Dungeon: ${dungeonToRun}.\nDifficulty: +${dungeonDifficulty}.\nYour role: ${userChosenRole}\nNeed: ${dungeonComposition}.`,
                    components: [confirmCancelRow],
                });

                const confirmCollector = dungeonResponse.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: timeout,
                    filter: userFilter,
                });

                confirmCollector.on("collect", async (i) => {
                    if (i.customId === "confirm") {
                        sendEmbed(mainObject, currentChannel, updatedDungeonCompositionList);

                        await compositionConfirmation.deleteReply();
                    }
                    if (i.customId === "cancel") {
                        await interaction.followUp({
                            content:
                                "Cancelled. Please try the command again if you wish to create a group.",
                            ephemeral: true,
                        });
                    }
                });
            } catch (e) {
                // Check if the error is due to a timeout
                if (
                    e.name.includes("InteractionCollectorError") &&
                    e.message.includes("Collector received no interactions")
                ) {
                    // Inform user about the timeout
                    await interaction.editReply({
                        content:
                            "You did not respond in time (60s).\nPlease try the command again if you wish to create a group.",
                        ephemeral: true,
                        component: [],
                    });
                } else {
                    // Optionally send a message to the user if the error is different
                    await interaction.editReply({
                        content: "An error occurred while processing your request.",
                        ephemeral: true,
                        component: [],
                    });
                }
            }
        }
        runCommandLogic();
    },
};
