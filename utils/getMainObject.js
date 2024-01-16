const { ButtonStyle } = require("discord.js");
const { generatePassphrase } = require("./utilFunctions");
const { wowWords } = require("./loadJson.js");

function getMainObject(interaction) {
    const mainObject = {
        roles: {
            Tank: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Tank",
                emoji: `<:tankrole:1193998691200159754>`,
            },
            Healer: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Healer",
                emoji: `<:healerrole:1193998685894357172>`,
            },
            DPS: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "DPS",
                emoji: `<:dpsrole:1193998689056870430>`,
            },
            DPS2: {
                customId: "DPS2",
                emoji: `<:dpsrole:1193998689056870430>`,
            },
            DPS3: {
                customId: "DPS3",
                emoji: `<:dpsrole:1193998689056870430>`,
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
            nickname: interaction.member.nickname != null ? interaction.member.nickname : interaction.user.globalName,
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
