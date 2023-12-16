const { ComponentType } = require("discord.js");
const { parseRolesToTag, generateListedAsString, addUserToRole } = require("./utilFunctions");
const { dungeonInstanceTable } = require("./loadDb");
const { processDungeonEmbed, getDungeonObject, getDungeonButtonRow } = require("./dungeonLogic");

async function sendEmbed(mainObject, channel, requiredCompositionList) {
    const { dungeonName, dungeonDifficulty } = mainObject.embedData;

    // Get the roles to tag
    const rolesToTag = parseRolesToTag(
        dungeonDifficulty,
        requiredCompositionList,
        channel.guild.id
    );

    // Update the listedAs field in the mainObject
    mainObject.embedData.listedAs = generateListedAsString(dungeonName, dungeonDifficulty);

    // Create the object that is used to send to the embed
    const dungeonObject = getDungeonObject(dungeonName, dungeonDifficulty, mainObject);

    // Create the button row for the embed
    const embedButtonRow = getDungeonButtonRow(mainObject);

    const sentEmbed = await channel.send({
        content: `${rolesToTag}`,
        embeds: [dungeonObject],
        components: [embedButtonRow],
    });

    const groupUtilityCollector = sentEmbed.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 1_800_000, // Wait 30 minutes to form a group before timing out
    });

    groupUtilityCollector.on("collect", async (i) => {
        const discordUserId = `<@${i.user.id}>`;
        if (i.customId === "Tank") {
            addUserToRole(discordUserId, mainObject, "Tank");
            processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector
            );
        } else if (i.customId === "Healer") {
            addUserToRole(discordUserId, mainObject, "Healer");
            processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector
            );
        } else if (i.customId === "DPS") {
            addUserToRole(discordUserId, mainObject, "DPS");
            processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector
            );
        }
    });

    groupUtilityCollector.on("end", async (collected, reason) => {
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
        } else if (reason === "full") {
            // Send the finished dungeon data to the database
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
