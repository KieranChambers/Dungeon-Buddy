const { SlashCommandBuilder } = require("@discordjs/builders");
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} = require("discord.js");
const { Op } = require("sequelize");
const { dungeonInstanceTable } = require("../../utils/loadDb.js");
const { getPastDungeonObject } = require("../../utils/historyLogic.js");

const timeOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false, // Use 24-hour format
    timeZone: "UTC", // EU Server time (UTC)
    timeZoneName: "short",
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("Check the team composition of a previous dungeon"),
    async execute(interaction) {
        const roles = ["tank", "healer", "dps", "dps2", "dps3"];
        const userIdString = `<@${interaction.user.id}>`;

        const orCondition = roles.map((role) => ({ [role]: userIdString }));

        const userDungeonInstances = await dungeonInstanceTable.findAll({
            where: {
                [Op.or]: orCondition,
            },
            order: [["createdAt", "DESC"]],
            limit: 10,
        });

        if (userDungeonInstances.length === 0) {
            await interaction.reply({
                content: "You haven't been in any dungeons yet!",
                ephemeral: true,
            });
            return;
        }

        const selectDungeonRow = new StringSelectMenuBuilder()
            .setCustomId("selectPastDungeon")
            .setPlaceholder("Select a previous dungeon to view")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                userDungeonInstances.map((dungeon, position) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(
                            `${dungeon.dataValues.dungeon_name} ${
                                dungeon.dataValues.dungeon_difficulty
                            } - ${dungeon.dataValues.createdAt.toLocaleString(
                                "en-GB",
                                timeOptions
                            )}`
                        )
                        .setValue(position.toString())
                )
            );

        const pastDungeonRow = new ActionRowBuilder().addComponents(selectDungeonRow);

        const pastDungeonMessage = await interaction.reply({
            components: [pastDungeonRow],
            ephemeral: true,
        });

        const userFilter = (i) => i.user.id === interaction.user.id;

        try {
            const getPastDungeonValue = await pastDungeonMessage.awaitMessageComponent({
                filter: userFilter,
                time: 60_000,
            });

            const pastDungeonValue = getPastDungeonValue.values[0];
            const pastDungeonObject = getPastDungeonObject(userDungeonInstances[pastDungeonValue]);

            await getPastDungeonValue.update({
                embeds: [pastDungeonObject],
                components: [],
            });

            return;
        } catch (e) {
            // Check if the error is due to a timeout
            if (
                e.name.includes("InteractionCollectorError") &&
                e.message.includes("Collector received no interactions")
            ) {
                // Inform user about the timeout
                await interaction.editReply({
                    content:
                        "You did not respond in time (60s). Please try the command again if you wish to view past dungeons.",
                    ephemeral: true,
                    components: [], // Need to send empty components to remove the dropdown
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
    },
};
