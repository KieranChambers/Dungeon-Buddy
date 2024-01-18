const { ButtonStyle } = require("discord.js");
const { generatePassphrase } = require("./utilFunctions");
const { wowWords } = require("./loadJson.js");
const { tankEmoji, healerEmoji, dpsEmoji } = require("../config.js");

function getMainObject(interaction) {
    const mainObject = {
        roles: {
            Tank: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Tank",
                emoji: tankEmoji,
            },
            Healer: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "Healer",
                emoji: healerEmoji,
            },
            DPS: {
                spots: [],
                nicknames: [],
                style: ButtonStyle.Secondary,
                disabled: false,
                customId: "DPS",
                emoji: dpsEmoji,
            },
            DPS2: {
                customId: "DPS2",
                emoji: dpsEmoji,
            },
            DPS3: {
                customId: "DPS3",
                emoji: dpsEmoji,
            },
        },
        embedData: {
            creatorNotes: "",
            dungeonName: "",
            dungeonDifficulty: "",
            timeOrCompletion: "",
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
