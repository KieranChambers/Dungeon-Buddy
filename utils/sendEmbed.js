const { ComponentType } = require("discord.js");
const {
    cleanFilledValues,
    parseRolesToTag,
    generateListedAsString,
    addUserToRole,
    userExistsInAnyRole,
    removeUserFromRole,
    sendCancelMessage,
} = require("./utilFunctions");
const { dungeonInstanceTable, interactionStatusTable } = require("./loadDb");
const { getDungeonObject, getDungeonButtonRow, DungeonManager } = require("./dungeonLogic");
const { processSendEmbedError } = require("./errorHandling");
const { dungeonData, currentExpansion, currentSeason } = require("./loadJson.js");

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

    const dungeonManager = new DungeonManager();

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
            await dungeonManager.processDungeonEmbed(
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
            await dungeonManager.processDungeonEmbed(
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

            await dungeonManager.processDungeonEmbed(
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
        } else if (i.customId === "groupUtility") {
            if (!userExistsInAnyRole(discordUserId, mainObject)) {
                await i.deferUpdate();
                return;
            } else {
                if (discordUserId === interactionUserId) {
                    await i.deferUpdate();

                    // The group creator has advanced options
                    await dungeonManager.changeGroup(i, groupUtilityCollector, mainObject);
                } else {
                    const [roleName, roleData] = userExistsInAnyRole(discordUserId, mainObject);
                    removeUserFromRole(discordUserId, discordNickname, mainObject, roleName, roleData);

                    await dungeonManager.processDungeonEmbed(
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

    groupUtilityCollector.on("end", async (_, reason) => {
        const tank = mainObject.roles.Tank.spots[0] ? cleanFilledValues(mainObject.roles.Tank.spots[0]) : "";
        const healer = mainObject.roles.Healer.spots[0] ? cleanFilledValues(mainObject.roles.Healer.spots[0]) : "";
        const dps = mainObject.roles.DPS.spots[0] ? cleanFilledValues(mainObject.roles.DPS.spots[0]) : "";
        const dps2 = mainObject.roles.DPS.spots[1] ? cleanFilledValues(mainObject.roles.DPS.spots[1]) : "";
        const dps3 = mainObject.roles.DPS.spots[2] ? cleanFilledValues(mainObject.roles.DPS.spots[2]) : "";

        if (reason === "time") {
            try {
                // Pull in dungeonObject and check if group was finished on timeout
                const tempDungeonObject = getDungeonObject(dungeonName, dungeonDifficulty, mainObject);
                if (tempDungeonObject.status === "full") {
                    // Send the finished dungeon data to the database
                    await dungeonInstanceTable.create({
                        dungeon_name: mainObject.embedData.dungeonName,
                        dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                        timed_completed: mainObject.embedData.timeOrCompletion,
                        passphrase: mainObject.utils.passphrase.phrase,
                        interaction_user: mainObject.interactionUser.userId,
                        user_chosen_role: mainObject.interactionUser.userChosenRole,
                        tank: tank,
                        healer: healer,
                        dps: dps,
                        dps2: dps2,
                        dps3: dps3,
                        expansion: currentExpansion,
                        season: currentSeason,
                        reason: "finished",
                    });

                    await sentEmbed.edit({
                        components: [],
                    });
                } else {
                    await sentEmbed.edit({
                        content: `Group creation timed out! (~30 mins have passed).`,
                        components: [],
                    });
                    // Update the interaction status to "timed out"
                    await interactionStatusTable.update(
                        { interaction_status: "timeoutAfterCreation" },
                        { where: { interaction_id: mainObject.interactionId } }
                    );

                    // Send group timeout message to the group members
                    await sendCancelMessage(channel, mainObject, "timed out");
                }
            } catch (e) {
                processSendEmbedError(e, "Group creation timeout error", interactionUserId);
            }
        } else if (reason === "finished") {
            try {
                // Send the finished dungeon data to the database
                await dungeonInstanceTable.create({
                    dungeon_name: mainObject.embedData.dungeonName,
                    dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                    timed_completed: mainObject.embedData.timeOrCompletion, // TODO: Change this to new names
                    passphrase: mainObject.utils.passphrase.phrase,
                    interaction_user: mainObject.interactionUser.userId,
                    user_chosen_role: mainObject.interactionUser.userChosenRole,
                    tank: tank,
                    healer: healer,
                    dps: dps,
                    dps2: dps2,
                    dps3: dps3,
                    expansion: currentExpansion,
                    season: currentSeason,
                    reason: reason,
                });

                // Remove the components from the embed when the group is finished
                await sentEmbed.edit({
                    components: [],
                });
            } catch (e) {
                processSendEmbedError(e, "Finished processing error", interactionUserId);
                console.log(e);
            }
        } else if (reason === "cancelledAfterCreation") {
            try {
                await dungeonInstanceTable.create({
                    dungeon_name: mainObject.embedData.dungeonName,
                    dungeon_difficulty: mainObject.embedData.dungeonDifficulty,
                    timed_completed: mainObject.embedData.timeOrCompletion,
                    passphrase: mainObject.utils.passphrase.phrase,
                    interaction_user: mainObject.interactionUser.userId,
                    user_chosen_role: mainObject.interactionUser.userChosenRole,
                    tank: tank,
                    healer: healer,
                    dps: dps,
                    dps2: dps2,
                    dps3: dps3,
                    expansion: currentExpansion,
                    season: currentSeason,
                    reason: reason,
                });

                // Send a message to the group members that the group has been cancelled
                await sendCancelMessage(channel, mainObject, "cancelled by group creator");

                // Update the embed to show that the group has been cancelled
                await sentEmbed.edit({
                    content: `This group has been cancelled by the group creator.`,
                    components: [],
                });
            } catch (e) {
                processSendEmbedError(e, "Cancelled after creation error", interactionUserId);
            }
        }
    });
}

module.exports = { sendEmbed };
