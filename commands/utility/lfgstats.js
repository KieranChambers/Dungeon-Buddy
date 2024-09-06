const fs = require("fs").promises; // Ensure to require the promise-based version of 'fs'
const path = require("path");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require("discord.js");
const { processError } = require("../../utils/errorHandling.js");
const { currentExpansion, currentSeason } = require("../../utils/loadJson.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lfgstats")
        .setDescription("Check the overall dungeon stats recorded by the bot"),
    async execute(interaction) {
        const dungeonUserStatsPath = path.join(
            __dirname,
            `../../jsonFiles/dungeonUserStats/${currentExpansion}/season${currentSeason}.json`
        );
        const dungeonUserStatsData = await fs.readFile(dungeonUserStatsPath, "utf8");
        const dungeonUserStats = JSON.parse(dungeonUserStatsData);

        const embedFields = [
            {
                name: `${dungeonUserStats.dungeonGroupsCreated.total} Total Groups Created`,
                value: `**${dungeonUserStats.dungeonGroupsCreated.today} - 24H\n${dungeonUserStats.dungeonGroupsCreated.weekly} - 7D\n${dungeonUserStats.dungeonGroupsCreated.monthly} - 30D**`,
            },
            {
                name: `S${currentSeason} Most Popular Dungeons`,
                value: `${dungeonUserStats.mostPopularDungeons
                    .map((dungeon) => `**${dungeon.count} - ${dungeon.dungeon_name}**`)
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
                new StringSelectMenuOptionBuilder().setLabel("M0").setValue("key_levels_one"),
                new StringSelectMenuOptionBuilder().setLabel("M2-M3").setValue("key_levels_two"),
                new StringSelectMenuOptionBuilder().setLabel("M4-M6").setValue("key_levels_three"),
                new StringSelectMenuOptionBuilder().setLabel("M7-M9").setValue("key_levels_four"),
                new StringSelectMenuOptionBuilder().setLabel("M10").setValue("key_levels_five")
            );

        const getKeyLevelRow = new ActionRowBuilder().addComponents(selectKeyLevelRow);

        const userStatsEmbed = await interaction.reply({
            embeds: [userStatsEmbedObject],
            components: [getKeyLevelRow],
            ephemeral: true,
        });

        const keyLevelTitleObject = {
            key_levels_one: "M0",
            key_levels_two: "M2-M3",
            key_levels_three: "M4-M6",
            key_levels_four: "M7-M9",
            key_levels_five: "M10",
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
                            name: `S${currentSeason} Most Popular Keys ${menuTitle}`,
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

                    await i.deferUpdate();
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
