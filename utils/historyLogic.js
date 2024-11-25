const { tankEmoji, healerEmoji, dpsEmoji } = require("../config");

function getPastDungeonObject(dungeonInstance, timeOptions) {
    const creatorNotes = null;
    const dungeonValues = dungeonInstance.dataValues;
    const dungeon = dungeonValues.dungeon_name;
    const difficulty = dungeonValues.dungeon_difficulty;
    const timeCompletion = dungeonValues.timed_completed;
    const dateTime = dungeonValues.createdAt.toLocaleString("en-GB", timeOptions);
    const passphrase = dungeonValues.passphrase;
    const groupStatus = dungeonValues.reason === "finished" ? "✅" : "❌";
    const groupCreator = dungeonValues.interaction_user;
    const tankId = dungeonValues.tank;
    const healerId = dungeonValues.healer;
    const dpsIds = [dungeonValues.dps, dungeonValues.dps2, dungeonValues.dps3]
        .filter((spot) => spot !== null)
        .map((spot) => spot + "\n")
        .join("");

    // Allows us to build fields conditionally
    let fields = [
        ...(creatorNotes ? [{ name: `"${creatorNotes}"`, value: ``, inline: false }] : []),
        { name: ``, value: `${dateTime}`, inline: false },
        { name: `Passphrase`, value: `\`${passphrase}\``, inline: false },
        { name: `🚩 Creator`, value: `${groupCreator}`, inline: false },
        { name: `${tankEmoji} Tank `, value: `${tankId || "\u200b"}`, inline: false },
        { name: `${healerEmoji} Healer`, value: `${healerId || "\u200b"}`, inline: false },
        { name: `${dpsEmoji} DPS`, value: `${dpsIds || "\u200b"}`, inline: false },
    ];

    const dungeonObject = {
        color: 0x3c424b,
        title: `${dungeon} ${difficulty} (${timeCompletion}) ${groupStatus}`,
        fields: fields,
    };

    return dungeonObject;
}

module.exports = { getPastDungeonObject };
