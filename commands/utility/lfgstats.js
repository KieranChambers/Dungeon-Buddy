const fs = require("fs").promises; // Ensure to require the promise-based version of 'fs'
const path = require("path");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { processError } = require("../../utils/errorHandling.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lfgstats")
        .setDescription("Check the overall dungeon stats recorded by the bot"),
    async execute(interaction) {
        const dungeonUserStatsPath = path.join(__dirname, "../../jsonFiles/dungeonUserStats.json");
        const dungeonUserStatsData = await fs.readFile(dungeonUserStatsPath, "utf8");
        const dungeonUserStats = JSON.parse(dungeonUserStatsData);

        const embedFields = [
            {
                name: `${dungeonUserStats.dungeonGroupsCreated.total} Groups Created`,
                value: `**${dungeonUserStats.dungeonGroupsCreated.today} x 24H\n${dungeonUserStats.dungeonGroupsCreated.weekly} x 7D\n${dungeonUserStats.dungeonGroupsCreated.monthly} x 30D**`,
            },
            {
                name: "Most Popular Dungeons",
                value: `${dungeonUserStats.mostPopularDungeons
                    .map((dungeon) => `**${dungeon.count} x ${dungeon.dungeon_name}**`)
                    .join("\n")}`,
            },
        ];

        const userStatsEmbedObject = {
            color: 0x3c424b,
            title: `LFG Stats 🤓`,
            fields: embedFields,
        };

        const selectKeyLevelRow = new StringSelectMenuBuilder()
            .setCustomId("select_key_level")
            .setPlaceholder("Select key levels to see their stats")
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                new StringSelectMenuOptionBuilder().setLabel("M2-M10").setValue("key_levels_one"),
                new StringSelectMenuOptionBuilder().setLabel("M11-M15").setValue("key_levels_two"),
                new StringSelectMenuOptionBuilder().setLabel("M16-M20").setValue("key_levels_three"),
                new StringSelectMenuOptionBuilder().setLabel("M21+").setValue("key_levels_four")
            );

        const getKeyLevelRow = new ActionRowBuilder().addComponents(selectKeyLevelRow);

        const userStatsEmbed = await interaction.reply({
            embeds: [userStatsEmbedObject],
            components: [getKeyLevelRow],
            ephemeral: true,
        });

        const keyLevelTitleObject = {
            key_levels_one: "M2-M10",
            key_levels_two: "M11-M15",
            key_levels_three: "M16-M20",
            key_levels_four: "M21+",
        };

        const userFilter = (i) => i.user.id === interaction.user.id;

        try {
            const popularKeyLevelCollector = userStatsEmbed.createMessageComponentCollector({
                filter: userFilter,
                time: 120_000,
            });

            popularKeyLevelCollector.on("collect", async (i) => {
                if (i.customId === "select_key_level") {
                    const keyLevelValue = i.values;
                    const menuTitle = keyLevelTitleObject[keyLevelValue];

                    const popularKeyFields = [
                        {
                            name: `Most Popular Keys ${menuTitle}`,
                            value: `\n\n${dungeonUserStats.mostPopularKeys[keyLevelValue]
                                .map(
                                    (dungeon) =>
                                        `**${dungeon.count} x ${dungeon.dungeon_name} ${dungeon.dungeon_difficulty}**`
                                )
                                .join("\n")}`,
                        },
                    ];

                    userStatsEmbedObject.fields = popularKeyFields;

                    await userStatsEmbed.edit({
                        embeds: [userStatsEmbedObject],
                        components: [getKeyLevelRow],
                    });

                    i.deferUpdate();
                }
            });

            popularKeyLevelCollector.on("end", async (collected, reason) => {
                if (reason === "time") {
                    await userStatsEmbed.edit({
                        content: "LFG Stats timed out! (2 mins have passed).",
                        components: [],
                    });
                }
            });
        } catch (e) {
            processError(e, userStatsEmbed);
        }
    },
};
