const { ComponentType } = require("discord.js");
const { parseRolesToTag, generateListedAsString, addUserToRole, userExistsInAnyRole } = require("./utilFunctions");
const { dungeonInstanceTable, interactionStatusTable } = require("./loadDb");
const { processDungeonEmbed, getDungeonObject, getDungeonButtonRow } = require("./dungeonLogic");
const { processEmbedError, createStatusEmbed } = require("./errorHandling");

async function sendEmbed(mainObject, channel, requiredCompositionList) {
    const { dungeonName, dungeonDifficulty } = mainObject.embedData;
    const interactionUserId = mainObject.interactionUser.userId;

    // Get the roles to tag
    const rolesToTag = parseRolesToTag(dungeonDifficulty, requiredCompositionList, channel.guild.id);

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
            const callUser = addUserToRole(discordUserId, mainObject, "Tank");
            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );
        } else if (i.customId === "Healer") {
            const callUser = addUserToRole(discordUserId, mainObject, "Healer");
            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );
        } else if (i.customId === "DPS") {
            const callUser = addUserToRole(discordUserId, mainObject, "DPS");
            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );
        } else if (i.customId === "getPassphrase") {
            // Confirm the user is in the group
            if (!userExistsInAnyRole(discordUserId, mainObject, "getPassphrase")) {
                await i.reply({
                    content: "Only group members can request the passphrase!",
                    ephemeral: true,
                });
            } else {
                await i.reply({
                    content: `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nAdd this to your note when applying to the group in-game!`,
                    ephemeral: true,
                });
            }
        } else if (i.customId === "cancelGroup") {
            if (discordUserId !== interactionUserId) {
                await i.reply({
                    content: "Only the group leader can cancel the group!",
                    ephemeral: true,
                });
            } else {
                groupUtilityCollector.stop("cancelledAfterCreation");
            }
        }
    });

    groupUtilityCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
            try {
                await createStatusEmbed(
                    "Group creation timed out! (30 mins have passed without a full group forming)",
                    sentEmbed
                );
                // Update the interaction status to "timed out"
                await interactionStatusTable.update(
                    { interaction_status: "timeoutAfterCreation" },
                    { where: { interaction_id: mainObject.interactionId } }
                );
            } catch (e) {
                processEmbedError(e, "Group creation timeout error", interactionUserId);
            }
        } else if (reason === "finished") {
            // Send the finished dungeon data to the database
            try {
                await dungeonInstanceTable.create({
                    dungeon_name: mainObject.embedData.dungeonName,
                    dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                    timed_completed: mainObject.embedData.timedOrCompleted,
                    passphrase: mainObject.utils.passphrase.phrase,
                    interaction_user: mainObject.interactionUser.userId,
                    user_chosen_role: mainObject.interactionUser.userChosenRole,
                    tank: mainObject.roles.Tank.spots[0],
                    healer: mainObject.roles.Healer.spots[0],
                    dps: mainObject.roles.DPS.spots[0],
                    dps2: mainObject.roles.DPS.spots[1],
                    dps3: mainObject.roles.DPS.spots[2],
                });

                // Update the interaction status to "finished" in the database
                await interactionStatusTable.update(
                    { interaction_status: "finished" },
                    { where: { interaction_id: mainObject.interactionId } }
                );
            } catch (e) {
                processEmbedError(e, "Finished processing error", interactionUserId);
            }
        } else if (reason === "cancelledAfterCreation") {
            // Update the embed to reflect the cancellation
            try {
                await createStatusEmbed("LFG cancelled by group creator.", sentEmbed);

                // Update the interaction status to "cancelled" in the database
                await interactionStatusTable.update(
                    { interaction_status: "cancelledAfterCreation" },
                    { where: { interaction_id: mainObject.interactionId } }
                );
            } catch (e) {
                processEmbedError(e, "Cancelled after creation error", interactionUserId);
            }
        }
    });
}

module.exports = { sendEmbed };
