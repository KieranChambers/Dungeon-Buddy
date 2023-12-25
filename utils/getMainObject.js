const { ButtonStyle } = require("discord.js");
const { generatePassphrase } = require("./utilFunctions");
const { wowWords } = require("./loadJson.js");

function getMainObject(interaction) {
    const mainObject = {
        roles: {
            Tank: {
                spots: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Tank",
                emoji: `<:tankrole:1181327150708686848>`,
            },
            Healer: {
                spots: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Healer",
                emoji: `<:healrole:1181327153749561364>`,
            },
            DPS: {
                spots: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "DPS",
                emoji: `<:dpsrole:1181327148624117870>`,
            },
            DPS2: {
                customId: "DPS2",
                emoji: `<:dpsrole:1181327148624117870>`,
            },
            DPS3: {
                customId: "DPS3",
                emoji: `<:dpsrole:1181327148624117870>`,
            },
        },
        embedData: {
            dungeonName: "",
            dungeonDifficulty: "",
            timedOrCompleted: "",
            listedAs: "",
            spotIcons: [],
            filledSpot: "~~Filled Spot~~",
        },
        interactionId: interaction.id,
        interactionUser: {
            userId: `<@${interaction.user.id}>`,
            userChosenRole: "",
        },
        utils: {
            passphrase: {
                phrase: generatePassphrase(wowWords),
            },
        },
    };

    return mainObject;
}

module.exports = { getMainObject };
