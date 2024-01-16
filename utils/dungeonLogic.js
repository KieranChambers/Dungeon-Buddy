const {
    ActionRowBuilder,
    ComponentType,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle,
} = require("discord.js");
const { dungeonData } = require("./loadJson");
const { createButton } = require("./discordFunctions");
const { generateRoleIcons, sendPassphraseToUser } = require("./utilFunctions");

function getEligibleComposition(mainObject) {
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

async function processDungeonEmbed(i, rolesToTag, dungeon, difficulty, mainObject, groupUtilityCollector, callUser) {
    const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
    if (newDungeonObject.status === "full") {
        await i.update({
            content: ``,
            embeds: [newDungeonObject],
            components: [],
        });

        if (callUser === "newUser") {
            await sendPassphraseToUser(i, mainObject);
        }
        // Call the stop method to stop the collector
        groupUtilityCollector.stop("finished");
    } else {
        const newEmbedButtonRow = getDungeonButtonRow(mainObject);

        await i.update({
            content: `${rolesToTag}`,
            embeds: [newDungeonObject],
            components: [newEmbedButtonRow],
        });

        if (callUser === "newUser") {
            await sendPassphraseToUser(i, mainObject);
        }
    }
}

function getDungeonObject(dungeon, difficulty, mainObject) {
    const listedAs = mainObject.embedData.listedAs;
    const interactionUserNick = mainObject.interactionUser.nickname;
    const timedCompleted = mainObject.embedData.timedOrCompleted;

    const tank = mainObject.roles.Tank;
    const healer = mainObject.roles.Healer;
    const dps = mainObject.roles.DPS;

    const tankNickname = tank.nicknames.join("\n");
    const healerNickname = healer.nicknames.join("\n");
    const dpsNicknames = dps.nicknames.join("\n");

    const tankEmoji = tank.emoji;
    const healerEmoji = healer.emoji;
    const dpsEmoji = dps.emoji;

    const roleIcons = generateRoleIcons(mainObject);
    const joinedRoleIcons = roleIcons.join(" ");

    const dungeonObject = {
        color: 0x3c424b,
        title: `${dungeon} ${difficulty}  ${joinedRoleIcons}`,
        url: `${dungeonData[dungeon].wowheadStrategyUrl}`,
        image: { url: `${dungeonData[dungeon].bannerImageUrl}` },
        fields: [
            { name: `Created by`, value: `${interactionUserNick}`, inline: false },
            { name: `Listed as`, value: ` ${listedAs}`, inline: true },
            { name: "Timed/Completed", value: `${timedCompleted}`, inline: true },
            { name: `${tankEmoji} Tank `, value: `${tankNickname || "\u200b"}`, inline: false },

            { name: `${healerEmoji} Healer`, value: `${healerNickname || "\u200b"}`, inline: false },
            { name: `${dpsEmoji} DPS`, value: `${dpsNicknames || "\u200b"}`, inline: false },
        ],
        // TODO: Create a function to generate random footer tips
        // footer: { text: "" },
        status: "",
    };
    if (roleIcons.length > 4) {
        dungeonObject.title += " (FULL)";
        dungeonObject.image = null;
        dungeonObject.status = "full";
    }
    return dungeonObject;
}

function getGroupCancelRow() {
    const confirmCancelButton = createButton({
        customId: "confirmCancelGroup",
        label: "Yes",
        style: ButtonStyle.Success,
        disabled: false,
    });

    const denyCancelButton = createButton({
        customId: "denyCancelGroup",
        label: "No",
        style: ButtonStyle.Danger,
        disabled: false,
    });

    const cancelGroupRow = new ActionRowBuilder().addComponents(confirmCancelButton, denyCancelButton);

    return cancelGroupRow;
}

async function cancelGroup(interaction, groupUtilityCollector) {
    const cancelButtonRow = getGroupCancelRow();

    const confirmGroupCancellation = await interaction.followUp({
        content: "Are you sure you want to cancel the group?",
        ephemeral: true,
        components: [cancelButtonRow],
    });

    // Add a collector to listen for the confirmation
    const groupCancellationCollector = confirmGroupCancellation.createMessageComponentCollector({
        ComponentType: ComponentType.Button,
        time: 60_000,
    });

    groupCancellationCollector.on("collect", async (i) => {
        if (i.customId === "confirmCancelGroup") {
            i.update({
                content: "Your group has been cancelled.",
                components: [],
            });
            groupCancellationCollector.stop("confirmed");
        } else if (i.customId === "denyCancelGroup") {
            await i.update({
                content: "Group cancellation aborted.",
                components: [],
            });
            // Call the stop method so that the collector doesn't time out
            groupCancellationCollector.stop("denied");
        }
    });

    groupCancellationCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
            await interaction.followUp({
                content:
                    "Group cancellation timed out. If you want to cancel the group please click on the ❌ button again.",
                ephemeral: true,
                components: [],
            });
        } else if (reason === "confirmed") {
            // Call the stop method to stop the main collector
            groupUtilityCollector.stop("cancelledAfterCreation");
        }
    });
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

    const cancelGroupButton = createButton({
        customId: "cancelGroup",
        emoji: "❌",
        style: ButtonStyle.Secondary,
        disabled: false,
    });

    const embedButtonRow = new ActionRowBuilder().addComponents(
        addTankToGroup,
        addHealerToGroup,
        addDpsToGroup,
        getPassphraseButton,
        cancelGroupButton
    );

    return embedButtonRow;
}

module.exports = {
    getEligibleComposition,
    processDungeonEmbed,
    getDungeonObject,
    getDungeonButtonRow,
    cancelGroup,
};
