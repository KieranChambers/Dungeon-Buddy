const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle,
} = require("discord.js");
const { dungeonData } = require("./loadJson");
const { createButton } = require("./discordFunctions");
const { generateRoleIcons } = require("./utilFunctions");

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

async function processDungeonEmbed(
    i,
    rolesToTag,
    dungeon,
    difficulty,
    mainObject,
    groupUtilityCollector
) {
    const newDungeonObject = getDungeonObject(dungeon, difficulty, mainObject);
    if (newDungeonObject.status === "full") {
        groupUtilityCollector.stop("finished");
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

function getDungeonObject(dungeon, difficulty, mainObject) {
    const listedAs = mainObject.embedData.listedAs;
    const interactionUser = mainObject.interactionUser.userId;
    const timedCompleted = mainObject.embedData.timedOrCompleted;

    const tank = mainObject.roles.Tank;
    const healer = mainObject.roles.Healer;
    const dps = mainObject.roles.DPS;

    const tankSpot = tank.spots.join("\n");
    const healerSpot = healer.spots.join("\n");
    const dpsSpots = dps.spots.join("\n");

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
            { name: `Created by`, value: `${interactionUser}`, inline: false },
            { name: `Listed as`, value: ` ${listedAs}`, inline: true },
            { name: "Timed/Completed", value: `${timedCompleted}`, inline: true },
            { name: `${tankEmoji} Tank `, value: `${tankSpot || "\u200b"}`, inline: false },

            { name: `${healerEmoji} Healer`, value: `${healerSpot || "\u200b"}`, inline: false },
            { name: `${dpsEmoji} DPS`, value: `${dpsSpots || "\u200b"}`, inline: false },
        ],
        status: "",
    };
    if (roleIcons.length > 4) {
        dungeonObject.title += " (FULL)";
        dungeonObject.image = null;
        dungeonObject.status = "full";
    }
    return dungeonObject;
}

function getDungeonButtonRow(mainObject) {
    const tank = mainObject.roles.Tank;
    const healer = mainObject.roles.Healer;
    const dps = mainObject.roles.DPS;

    const addTankToGroup = createButton(tank, tank.emoji, tank.style, tank.disabled);
    const addHealerToGroup = createButton(healer, healer.emoji, healer.style, healer.disabled);
    const addDpsToGroup = createButton(dps, dps.emoji, dps.style, dps.disabled);

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
};
