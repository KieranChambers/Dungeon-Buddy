const { ComponentType } = require("discord.js");
const {
    parseRolesToTag,
    generateListedAsString,
    addUserToRole,
    userExistsInAnyRole,
    removeUserFromRole,
} = require("./utilFunctions");
const { dungeonInstanceTable, interactionStatusTable } = require("./loadDb");
const { processDungeonEmbed, getDungeonObject, getDungeonButtonRow, changeGroup } = require("./dungeonLogic");
const { processSendEmbedError, createStatusEmbed } = require("./errorHandling");
const { dungeonData } = require("./loadJson.js");

async function sendEmbed(mainObject, channel, requiredCompositionList) {
    const { dungeonName, dungeonDifficulty } = mainObject.embedData;
    const interactionUserId = mainObject.interactionUser.userId;

    // Get the roles to tag
    const rolesToTag = parseRolesToTag(dungeonDifficulty, requiredCompositionList, channel.guild.id);

    mainObject.embedData.rolesToTag = rolesToTag;

    // Generate a listed as string for the mainObject if the user hasn't specified one
    if (!mainObject.embedData.listedAs) {
        mainObject.embedData.listedAs = generateListedAsString(dungeonName);
    }

    // Create the object that is used to send to the embed
    const dungeonObject = getDungeonObject(dungeonName, dungeonDifficulty, mainObject);

    // Create the button row for the embed
    const embedButtonRow = getDungeonButtonRow(mainObject);

    const sentEmbed = await channel.send({
        content: `${dungeonData[dungeonName].acronym} ${dungeonDifficulty} - ${rolesToTag}`,
        embeds: [dungeonObject],
        components: [embedButtonRow],
    });

    const groupUtilityCollector = sentEmbed.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 1_800_000, // Wait 30 minutes to form a group before timing out
    });

    groupUtilityCollector.on("collect", async (i) => {
        const discordUserId = `<@${i.user.id}>`;
        const discordNickname = i.member.nickname || i.user.globalName || i.user.username;

        if (i.customId === "Tank") {
            if (mainObject.roles.Tank.inProgress) {
                await i.deferUpdate();
                return;
            }
            mainObject.roles.Tank.inProgress = true;

            const callUser = addUserToRole(discordUserId, discordNickname, mainObject, "Tank", "groupUtilityCollector");
            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );

            mainObject.roles.Tank.inProgress = false;
        } else if (i.customId === "Healer") {
            if (mainObject.roles.Healer.inProgress) {
                await i.deferUpdate();
                return;
            }
            mainObject.roles.Healer.inProgress = true;

            const callUser = addUserToRole(
                discordUserId,
                discordNickname,
                mainObject,
                "Healer",
                "groupUtilityCollector"
            );
            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );

            mainObject.roles.Healer.inProgress = false;
        } else if (i.customId === "DPS") {
            if (mainObject.roles.DPS.inProgress) {
                await i.deferUpdate();
                return;
            }
            mainObject.roles.DPS.inProgress = true;

            const callUser = addUserToRole(discordUserId, discordNickname, mainObject, "DPS", "groupUtilityCollector");
            if (callUser === "sameRole") {
                mainObject.roles.DPS.inProgress = false;
                await i.deferUpdate();
                return;
            }

            await processDungeonEmbed(
                i,
                rolesToTag,
                dungeonName,
                dungeonDifficulty,
                mainObject,
                groupUtilityCollector,
                callUser
            );

            mainObject.roles.DPS.inProgress = false;
        } else if (i.customId === "getPassphrase") {
            // Confirm the user is in the group
            if (!userExistsInAnyRole(discordUserId, mainObject)) {
                await i.deferUpdate();
                return;
            } else {
                let contentMessage;
                if (discordUserId === interactionUserId) {
                    contentMessage = `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nLook out for NoP members applying with this in-game!`;
                } else {
                    contentMessage = `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nAdd this to your note when applying to \`${mainObject.embedData.listedAs}\` in-game!`;
                }
                await i.reply({
                    content: contentMessage,
                    ephemeral: true,
                });
            }
        } else if (i.customId === "cancelGroup") {
            if (!userExistsInAnyRole(discordUserId, mainObject)) {
                await i.deferUpdate();
                return;
            } else {
                if (discordUserId === interactionUserId) {
                    await i.deferUpdate();

                    // The group creator has advanced options
                    await changeGroup(i, groupUtilityCollector, mainObject);
                } else {
                    const [roleName, roleData] = userExistsInAnyRole(discordUserId, mainObject);
                    removeUserFromRole(discordUserId, discordNickname, mainObject, roleName, roleData);
                    groupStatus = await processDungeonEmbed(
                        i,
                        rolesToTag,
                        dungeonName,
                        dungeonDifficulty,
                        mainObject,
                        groupUtilityCollector,
                        "notCallUser"
                    );
                }
            }
        }
    });

    groupUtilityCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
            try {
                await createStatusEmbed("Group creation timed out! (30 mins have passed).", sentEmbed);
                // Update the interaction status to "timed out"
                await interactionStatusTable.update(
                    { interaction_status: "timeoutAfterCreation" },
                    { where: { interaction_id: mainObject.interactionId } }
                );
            } catch (e) {
                processSendEmbedError(e, "Group creation timeout error", interactionUserId);
            }
        } else if (reason === "finished") {
            // Send the finished dungeon data to the database
            try {
                await dungeonInstanceTable.create({
                    dungeon_name: mainObject.embedData.dungeonName,
                    dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                    timed_completed: mainObject.embedData.timeOrCompletion, // TODO: Change this to new names
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
                processSendEmbedError(e, "Finished processing error", interactionUserId);
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
                processSendEmbedError(e, "Cancelled after creation error", interactionUserId);
            }
        }
    });
}

module.exports = { sendEmbed };
