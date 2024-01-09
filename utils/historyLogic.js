function getPastDungeonObject(dungeonInstance) {
    const dungeonValues = dungeonInstance.dataValues;
    const dungeon = dungeonValues.dungeon_name;
    const difficulty = dungeonValues.dungeon_difficulty;
    const timed_completed = dungeonValues.timed_completed;
    const passphrase = dungeonValues.passphrase;
    const interactionUser = dungeonValues.interaction_user;
    const tankSpot = dungeonValues.tank;
    const healerSpot = dungeonValues.healer;
    const dpsSpots = [dungeonValues.dps, dungeonValues.dps2, dungeonValues.dps3]
        .filter((spot) => spot !== null)
        .map((spot) => spot + "\n")
        .join("");

    const tankEmoji = `<:tankrole:1193998691200159754>`;
    const healerEmoji = `<:healerrole:1193998685894357172>`;
    const dpsEmoji = `<:dpsrole:1193998689056870430>`;

    const dungeonObject = {
        color: 0x3c424b,
        title: `${dungeon} ${difficulty}`,
        fields: [
            { name: `Created by`, value: `${interactionUser}`, inline: false },
            { name: `Passphrase`, value: `\`${passphrase}\``, inline: true },
            { name: `Timed/Completed`, value: `${timed_completed}`, inline: true },
            { name: `${tankEmoji} Tank `, value: `${tankSpot || "\u200b"}`, inline: false },

            { name: `${healerEmoji} Healer`, value: `${healerSpot || "\u200b"}`, inline: false },
            { name: `${dpsEmoji} DPS`, value: `${dpsSpots || "\u200b"}`, inline: false },
        ],
    };

    return dungeonObject;
}

module.exports = { getPastDungeonObject };
