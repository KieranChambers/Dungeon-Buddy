const { ComponentType } = require("discord.js");
const { parseRolesToTag, generateListedAsString, addUserToRole } = require("./utilFunctions");
const { dungeonInstanceTable } = require("./loadDb");
const { getDungeonObject, getDungeonButtonRow } = require("./dungeonLogic");

async function sendEmbed(mainObject, channel, dungeon, difficulty, requiredCompositionList) {
    // Get the roles to tag
    const rolesToTag = parseRolesToTag(difficulty, requiredCompositionList, channel.guild.id);

    // Update the listedAs field in the mainObject
    mainObject.embedData.listedAs = generateListedAsString(dungeon, difficulty);

    // Create the object that is used to send to the embed
    const dungeonObject = getDungeonObject(dungeon, difficulty, mainObject);

    // Create the button row for the embed
    const embedButtonRow = getDungeonButtonRow(mainObject);

    const sentEmbed = await channel.send({
        content: `${rolesToTag}`,
        embeds: [dungeonObject],
        components: [embedButtonRow],
    });

    const groupUtilityCollector = sentEmbed.createMessageComponentCollector({
        componentType: ComponentType.Button,
        // time: 30_000, // ! Change this back from 10s to 30 minutes
    });

    groupUtilityCollector.on("collect", async (i) => {
        const discordUserId = `<@${i.user.id}>`;
        if (i.customId === "Tank") {
            addUserToRole(discordUserId, mainObject, "Tank");

            const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
            const newEmbedButtonRow = getDungeonButtonRow(mainObject);

            await i.update({
                content: `${rolesToTag}`,
                embeds: [newDungeonObject],
                components: [newEmbedButtonRow],
            });
        } else if (i.customId === "Healer") {
            addUserToRole(discordUserId, mainObject, "Healer");

            const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
            const newEmbedButtonRow = getDungeonButtonRow(mainObject);

            await i.update({
                content: `${rolesToTag}`,
                embeds: [newDungeonObject],
                components: [newEmbedButtonRow],
            });
        } else if (i.customId === "DPS") {
            addUserToRole(discordUserId, mainObject, "DPS");

            const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
            if (newDungeonObject.status === "full") {
                // Passing through custom id "limit" to the collector end event
                groupUtilityCollector.stop("limit");
                await i.update({
                    content: ``,
                    embeds: [newDungeonObject],
                    components: [],
                });
            } else {
                const newEmbedButtonRow = getDungeonButtonRow(mainObject);

                await i.update({
                    content: `${rolesToTag}`,
                    embeds: [newDungeonObject],
                    components: [newEmbedButtonRow],
                });
            }
        }
    });

    groupUtilityCollector.on("end", async (collected, reason) => {
        console.log(reason);
        if (reason === "time") {
            const timedOutObject = {
                title: "LFG TIMED OUT (30 mins) ⏰",
                color: 0x3c424b,
            };

            try {
                await sentEmbed.edit({
                    content: "",
                    embeds: [timedOutObject],
                    components: [],
                });
            } catch (err) {
                console.error("Error editing message:", err);
            }
        } else if (reason === "limit") {
            try {
                await dungeonInstanceTable.create({
                    dungeon_name: mainObject.embedData.dungeonName,
                    dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                    interaction_user: mainObject.interactionUser.userId,
                    user_chosen_role: mainObject.interactionUser.userChosenRole,
                    tank: mainObject.roles.Tank.spots[0],
                    healer: mainObject.roles.Healer.spots[0],
                    dps: mainObject.roles.DPS.spots[0],
                    dps2: mainObject.roles.DPS.spots[1],
                    dps3: mainObject.roles.DPS.spots[2],
                });
            } catch (err) {
                console.error("Error writing to table:", err);
            }
        }
    });
}

module.exports = { sendEmbed };
