const { tankEmoji, healerEmoji, dpsEmoji } = require("../config");

function getPastDungeonObject(dungeonInstance) {
    const creatorNotes = null;
    const dungeonValues = dungeonInstance.dataValues;
    const dungeon = dungeonValues.dungeon_name;
    const difficulty = dungeonValues.dungeon_difficulty;
    const timeCompletion = dungeonValues.timed_completed;
    const passphrase = dungeonValues.passphrase;
    const tankId = dungeonValues.tank;
    const healerId = dungeonValues.healer;
    const dpsIds = [dungeonValues.dps, dungeonValues.dps2, dungeonValues.dps3]
        .filter((spot) => spot !== null)
        .map((spot) => spot + "\n")
        .join("");

    // Allows us to build fields conditionally
    let fields = [
        ...(creatorNotes ? [{ name: `"${creatorNotes}"`, value: ``, inline: false }] : []),
        { name: `Passphrase`, value: `\`${passphrase}\``, inline: true },
        { name: `${tankEmoji} Tank `, value: `${tankId || "\u200b"}`, inline: false },

        { name: `${healerEmoji} Healer`, value: `${healerId || "\u200b"}`, inline: false },
        { name: `${dpsEmoji} DPS`, value: `${dpsIds || "\u200b"}`, inline: false },
    ];

    const dungeonObject = {
        color: 0x3c424b,
        title: `${dungeon} ${difficulty} (${timeCompletion})`,
        fields: fields,
    };

    return dungeonObject;
}

module.exports = { getPastDungeonObject };
