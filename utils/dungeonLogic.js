const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle,
    ComponentType,
} = require("discord.js");
const { createButton } = require("./discordFunctions");
const { generateRoleIcons, sendPassphraseToUser, addUserToRole, removeUserFromRole } = require("./utilFunctions");

function getEligibleComposition(mainObject) {
    if (!mainObject.interactionUser.userChosenRole) {
        const selectComposition = new StringSelectMenuBuilder()
            .setCustomId("composition")
            .setPlaceholder("What roles are you looking for?")
            .setMinValues(1)
            .addOptions(new StringSelectMenuOptionBuilder().setLabel("Choose your role first!").setValue("none"));
        return selectComposition;
    }
    const selectComposition = new StringSelectMenuBuilder()
        .setCustomId("composition")
        .setPlaceholder("What roles are you looking for?")
        .setMinValues(1)
        .setMaxValues(4);

    for (const role in mainObject.roles) {
        // Skip the user's own role
        if (mainObject.roles[role].customId !== mainObject.interactionUser.userChosenRole) {
            // For DPS roles, use a generic label "DPS"
            const label = role.startsWith("DPS") ? "DPS" : role;

            selectComposition.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(label)
                    .setValue(mainObject.roles[role].customId)
                    .setEmoji(mainObject.roles[role].emoji)
            );
        }
    }

    return selectComposition;
}

class DungeonManager {
    constructor() {
        this.tempFinishedCollector = null;
    }

    async processDungeonEmbed(i, rolesToTag, dungeon, difficulty, mainObject, groupUtilityCollector, callUser) {
        // Acknowledge the interaction immediately if it has not been responded to
        if (!i.deferred && !i.replied) {
            await i.deferUpdate();
        }

        const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);

        // Logic to determine message content based on dungeon status
        const messageContent = `${mainObject.embedData.dungeonName} ${mainObject.embedData.dungeonDifficulty} - ${
            newDungeonObject.status === "full" ? `~~${rolesToTag}~~` : rolesToTag
        }`;

        const newEmbedButtonRow = getDungeonButtonRow(mainObject);

        try {
            if (newDungeonObject.status === "full") {
                const tempFinishedButtonRow = getTempFinishedButtonRow();

                const tempFinishedMessage = await i.editReply({
                    content: messageContent,
                    embeds: [newDungeonObject],
                    components: [tempFinishedButtonRow],
                });

                this.tempFinishedCollector = tempFinishedMessage.createMessageComponentCollector({
                    compontentType: ComponentType.Button,
                    time: 600_000, // Wait 10 minutes before timing out
                });

                this.tempFinishedCollector.on("end", async (_, reason) => {
                    if (reason === "time") {
                        const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
                        if (newDungeonObject.status === "full") {
                            groupUtilityCollector.stop("finished");
                        }
                    } else if (reason === "finished") {
                        groupUtilityCollector.stop("finished");
                    } else if (reason === "groupInProgress") {
                        // Reset the tempFinishedCollector to null once the group is in progress again
                        this.tempFinishedCollector = null;
                    }
                });
            } else {
                // Check for tempFinishedCollector and stop it if it exists
                if (this.tempFinishedCollector) {
                    this.tempFinishedCollector.stop("groupInProgress");
                }

                await i.editReply({
                    content: messageContent,
                    embeds: [newDungeonObject],
                    components: [newEmbedButtonRow],
                });
            }
        } catch (e) {
            console.log("Error processing dungeon embed:", e);
        }

        // Additional logic for newUser handling
        if (callUser === "newUser") {
            await sendPassphraseToUser(i, mainObject);
        }
    }

    async changeGroup(interaction, groupUtilityCollector, mainObject) {
        try {
            // Map user IDs to their nicknames and roles
            let idNickRoleMapping = buildIdNickRoleMapping(mainObject);

            const [groupRemoveUserRow, groupChangeRoleRow] = getGroupChangeUtilityRow(idNickRoleMapping, mainObject);
            const groupChangeConfirmRow = getGroupChangeConfirmRow();

            const groupChangesView = await interaction.followUp({
                content:
                    "Make changes to your group below.\n*To cancel your group click the 'Cancel Group' button 2x.*",
                ephemeral: true,
                components: [groupRemoveUserRow, groupChangeRoleRow, groupChangeConfirmRow],
            });

            // Add a collector to listen for the group changes
            const groupChangesCollector = groupChangesView.createMessageComponentCollector({
                ComponentType: ComponentType.Button,
                time: 60_000,
            });

            // Define variables to store the group changes
            let usersToRemove = null;
            let newGroupCreatorRole = null;
            let cancelGroupCounter = 0;

            groupChangesCollector.on("collect", async (i) => {
                const dungeonName = mainObject.embedData.dungeonName;
                const dungeonDifficulty = mainObject.embedData.dungeonDifficulty;
                const dungeonObject = getDungeonObject(dungeonName, dungeonDifficulty, mainObject);
                const groupStatus = dungeonObject.status;

                if (i.customId === "removeGroupUsers") {
                    // Don't update the value if there's no users to remove
                    if (i.values[0] !== "none") {
                        usersToRemove = i.values;
                    }
                    await i.deferUpdate();
                } else if (i.customId === "changeRole") {
                    // Don't update the value if there's no roles to change to
                    if (i.values[0] !== "none") {
                        newGroupCreatorRole = i.values[0];
                    }
                    await i.deferUpdate();
                } else if (i.customId === "confirmGroupChanges") {
                    const rolesToTag = mainObject.embedData.rolesToTag;
                    const callUser = "existingUser";

                    // Check if the user has made any changes
                    if (!usersToRemove && !newGroupCreatorRole) {
                        await i.deferUpdate();
                        return;
                    }

                    // TODO: Change this so when the user wants to remove members they can choose to swap to that role
                    if (usersToRemove) {
                        // Update the idNickRoleMapping to make sure the member hasn't left already
                        idNickRoleMapping = buildIdNickRoleMapping(mainObject);

                        usersToRemove.forEach((userId) => {
                            try {
                                if (!idNickRoleMapping[userId]) {
                                    return;
                                }

                                const { nickname, role } = idNickRoleMapping[userId];
                                removeUserFromRole(userId, nickname, mainObject, role, mainObject.roles[role]);
                            } catch (e) {
                                console.log("Error removing user from role:", e);
                            }
                        });
                        // Reset the users to remove to null after processing to avoid errors
                        usersToRemove = null;
                    }
                    if (newGroupCreatorRole) {
                        const role = mainObject.roles[newGroupCreatorRole];
                        let contentMessage = "";

                        // Check if the role is unavailable at the moment
                        if (role.inProgress) {
                            contentMessage = `The ${newGroupCreatorRole} role is unavailable at the moment. No changes have been made.`;
                        } else {
                            // Determine if the role is full based on its type and number of spots
                            const isDPSFull = newGroupCreatorRole === "DPS" && role.spots.length >= 3;
                            const isOtherRolesFull = newGroupCreatorRole !== "DPS" && role.spots.length >= 1;

                            if (isDPSFull || isOtherRolesFull) {
                                contentMessage = `The ${newGroupCreatorRole} role is full. No changes have been made.`;
                            }
                        }

                        if (contentMessage) {
                            // Reset the new group creator role after failing to avoid errors
                            newGroupCreatorRole = null;

                            await i.update({
                                content: contentMessage,
                                ephemeral: true,
                                components: [],
                            });
                            return;
                        }

                        // Temporarily set the new role to inProgress
                        role.inProgress = true;

                        const interactionUser = mainObject.interactionUser;
                        addUserToRole(
                            interactionUser.userId,
                            interactionUser.nickname + " 🚩",
                            mainObject,
                            newGroupCreatorRole,
                            "groupCancellationCollector"
                        );

                        // Reset the value to false after the user has been added
                        role.inProgress = false;

                        // Update the main object with the new group creator role
                        mainObject.interactionUser.userChosenRole = newGroupCreatorRole;

                        // Reset the new group creator role to null after processing
                        newGroupCreatorRole = null;
                    }

                    await this.processDungeonEmbed(
                        interaction,
                        rolesToTag,
                        dungeonName,
                        dungeonDifficulty,
                        mainObject,
                        groupUtilityCollector,
                        callUser
                    );

                    await i.update({
                        content: "Your changes have been made to the group.",
                        ephemeral: true,
                        components: [],
                    });

                    groupChangesCollector.stop("confirmGroupChanges");
                } else if (i.customId === "abortGroupChanges") {
                    await i.update({
                        content: "No changes have been made to the group.",
                        ephemeral: true,
                        components: [],
                    });
                    groupChangesCollector.stop("abortGroupChanges");
                } else if (i.customId === "cancelGroup") {
                    // Pressing the cancel button twice will stop the main collector
                    if (cancelGroupCounter >= 1) {
                        await i.update({
                            content: "The group has been cancelled.",
                            ephemeral: true,
                            components: [],
                        });
                        groupChangesCollector.stop("confirmCancelGroup");
                        return;
                    }
                    cancelGroupCounter++;
                    await i.deferUpdate();
                } else if (i.customId === "finishGroup") {
                    if (groupStatus !== "full") {
                        i.deferUpdate();
                    } else {
                        await i.update({
                            content: "The group is now formed. Enjoy your dungeon!",
                            ephemeral: true,
                            components: [],
                        });
                        groupChangesCollector.stop("finishGroup");
                    }
                }
            });

            groupChangesCollector.on("end", async (_, reason) => {
                if (reason === "time") {
                    interaction.followUp({
                        content:
                            "The group utility view has expired (60s). Please click on ⚙️ to open the group utility again.",
                        ephemeral: true,
                        components: [],
                    });
                } else if (reason === "confirmCancelGroup") {
                    // Call the stop method to stop the groupUtilityCollector and cancel the group
                    groupUtilityCollector.stop("cancelledAfterCreation");
                } else if (reason === "finishGroup") {
                    // Call the stop method to stop the tempFinishedCollector and finish the group
                    this.tempFinishedCollector.stop("finished");
                }
            });
        } catch (e) {
            console.log("Error with group utility changes", e);
        }
    }
}

function getDungeonObject(dungeon, difficulty, mainObject) {
    const listedAs = mainObject.embedData.listedAs;
    const timeCompletion = mainObject.embedData.timeOrCompletion;
    const creatorNotes = mainObject.embedData.creatorNotes;

    const tank = mainObject.roles.Tank;
    const healer = mainObject.roles.Healer;
    const dps = mainObject.roles.DPS;

    const tankEmoji = tank.emoji;
    const healerEmoji = healer.emoji;
    const dpsEmoji = dps.emoji;

    const tankNickname = tank.nicknames.join("\n");
    const healerNickname = healer.nicknames.join("\n");
    let dpsNicknames = dps.nicknames;

    const totalDps = 3;

    // Fill with placeholders if there are fewer than 3 DPS members
    const filledDpsEmojis = Array(totalDps).fill(dpsEmoji);
    const filledDpsNicknames = dpsNicknames.concat(Array(totalDps - dpsNicknames.length).fill(" "));

    // Generate a list with emojis and nicknames combined
    const dpsList = filledDpsEmojis.map((emoji, index) => `${emoji} ${filledDpsNicknames[index]}`).join("\n");

    const roleIcons = generateRoleIcons(mainObject);
    const joinedRoleIcons = roleIcons.join(" ");

    const roleFieldValue = `${tankEmoji} ${tankNickname}\n${healerEmoji} ${healerNickname}\n${dpsList}`;

    let fields = creatorNotes
        ? [
              {
                  name: `${dungeon} ${difficulty} (${timeCompletion})`,
                  value: `** \n"${creatorNotes}"\n\n${roleFieldValue}**`,
                  inline: false,
              },
          ]
        : [
              {
                  name: `${dungeon} ${difficulty} (${timeCompletion})`,
                  value: `**\n${roleFieldValue}**`,
                  inline: false,
              },
          ];

    const dungeonObject = {
        color: 0x3c424b,
        title: `${listedAs}  ${joinedRoleIcons}`,
        fields: fields,
        footer: { text: "/lfghelp for more info about Dungeon Buddy" },
        status: "inProgress",
        spots: roleIcons.length,
    };

    if (roleIcons.length > 4) {
        dungeonObject.status = "full";
        dungeonObject.footer = null;
    }

    return dungeonObject;
}

function getDungeonButtonRow(mainObject) {
    const tank = mainObject.roles.Tank;
    const healer = mainObject.roles.Healer;
    const dps = mainObject.roles.DPS;

    const addTankToGroup = createButton({
        customId: tank.customId,
        emoji: tank.emoji,
        style: tank.style,
        disabled: tank.disabled,
    });
    const addHealerToGroup = createButton({
        customId: healer.customId,
        emoji: healer.emoji,
        style: healer.style,
        disabled: healer.disabled,
    });
    const addDpsToGroup = createButton({
        customId: dps.customId,
        emoji: dps.emoji,
        style: dps.style,
        disabled: dps.disabled,
    });

    const getPassphraseButton = createButton({
        customId: "getPassphrase",
        emoji: "🔑",
        style: ButtonStyle.Secondary,
        disabled: false,
    });

    const groupUtilityButton = createButton({
        customId: "groupUtility",
        label: "⚙️",
        style: ButtonStyle.Secondary,
        disabled: false,
    });

    const embedButtonRow = new ActionRowBuilder().addComponents(
        addTankToGroup,
        addHealerToGroup,
        addDpsToGroup,
        getPassphraseButton,
        groupUtilityButton
    );

    return embedButtonRow;
}

function getTempFinishedButtonRow() {
    const groupUtilityButton = createButton({
        customId: "groupUtility",
        emoji: "⚙️",
        style: ButtonStyle.Secondary,
        disabled: false,
    });

    const tempFinishedButtonRow = new ActionRowBuilder().addComponents(groupUtilityButton);

    return tempFinishedButtonRow;
}

function getGroupChangeUtilityRow(idNickRoleMapping, mainObject) {
    const groupCreatorRole = mainObject.interactionUser.userChosenRole;

    const nicknames = Object.entries(idNickRoleMapping)
        .filter(([userId]) => userId !== mainObject.interactionUser.userId)
        .map(([userId, { nickname, role }]) => {
            return {
                label: nickname,
                value: userId,
                emoji: mainObject.roles[role].emoji,
            };
        });

    if (nicknames.length === 0) {
        nicknames.push({ label: "No users to remove", value: "none", emoji: "⛔" });
    }

    const removeUserRow = new StringSelectMenuBuilder()
        .setCustomId("removeGroupUsers")
        .setPlaceholder("Select users to remove from the group")
        .setMaxValues(nicknames.length)
        .addOptions(nicknames);

    const availableRoles = Object.entries(mainObject.roles)
        .slice(0, 3)
        .filter(
            ([roleName, roleData]) =>
                roleName !== groupCreatorRole &&
                ((roleName !== "DPS" && roleData.spots.length < 1) || (roleName === "DPS" && roleData.spots.length < 3))
        )
        .map(([roleName, roleData]) => ({
            label: roleName,
            value: roleData.customId,
            emoji: roleData.emoji,
        }));

    if (availableRoles.length === 0) {
        availableRoles.push({ label: "No roles available", value: "none", emoji: "⛔" });
    }

    const changeRoleRow = new StringSelectMenuBuilder()
        .setCustomId("changeRole")
        .setPlaceholder("Change your role")
        .setMaxValues(1)
        .addOptions(availableRoles);

    const groupRemoveUserRow = new ActionRowBuilder().addComponents(removeUserRow);
    const groupChangeRoleRow = new ActionRowBuilder().addComponents(changeRoleRow);

    return [groupRemoveUserRow, groupChangeRoleRow];
}

function getGroupChangeConfirmRow() {
    const confirmGroupChangesButton = createButton({
        customId: "confirmGroupChanges",
        label: "Update Group",
        style: ButtonStyle.Primary,
        disabled: false,
    });

    const abortGroupChangesButton = createButton({
        customId: "abortGroupChanges",
        label: "Abort Changes",
        style: ButtonStyle.Secondary,
        disabled: false,
    });

    const cancelGroupButton = createButton({
        customId: "cancelGroup",
        label: "Cancel Group",
        style: ButtonStyle.Danger,
        disabled: false,
    });

    const finishGroupButton = createButton({
        customId: "finishGroup",
        label: "Finish Group",
        style: ButtonStyle.Success,
        disabled: false,
    });

    const groupChangeConfirmRow = new ActionRowBuilder().addComponents(
        confirmGroupChangesButton,
        abortGroupChangesButton,
        cancelGroupButton,
        finishGroupButton
    );

    return groupChangeConfirmRow;
}

function buildIdNickRoleMapping(mainObject) {
    const idNickRoleMapping = {};

    Object.entries(mainObject.roles).forEach(([role, { spots, nicknames }]) => {
        if (spots && nicknames) {
            spots.forEach((userId, index) => {
                const nickname = nicknames[index];
                if (userId && nickname) {
                    idNickRoleMapping[userId] = { nickname, role };
                }
            });
        }
    });

    return idNickRoleMapping;
}

module.exports = {
    getEligibleComposition,
    getDungeonObject,
    getDungeonButtonRow,
    DungeonManager,
};
