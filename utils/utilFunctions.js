const fs = require("fs");
const config = JSON.parse(fs.readFileSync("./jsonFiles/config.json", "utf8"));
const currentSeason = config.currentSeason;
const dungeonData = JSON.parse(
    fs.readFileSync(`./dungeonData/season${currentSeason}.json`, "utf8")
)[currentSeason];

function generateRoleIcons(mainObject) {
    const roleIcons = [];
    for (const role in mainObject.roles) {
        for (const spot in mainObject.roles[role].spots) {
            roleIcons.push(mainObject.roles[role].emoji);
        }
    }

    return roleIcons;
}

function generateListedAsString(dungeon, difficulty) {
    const dungeonDifficulty = `${difficulty}`;
    const dungeonAcronym = dungeonData[dungeon].acronym;

    return `NoP ${dungeonAcronym} ${dungeonDifficulty}`;
}

function generatePassphrase(wordList, wordCount = 3) {
    // Shuffle the array of words
    for (let i = wordList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wordList[i], wordList[j]] = [wordList[j], wordList[i]];
    }

    // Select the first 'wordCount' words and join them
    return wordList.slice(0, wordCount).join("");
}

// To parse "DPS" from "DPS2", "DPS3", etc.
const isDPSRole = (role) => role.includes("DPS");

function parseRolesToTag(difficulty, requiredComposition, guildId) {
    // Extract unique roles from the requiredComposition list
    const uniqueRoles = [...new Set(requiredComposition)];

    let roleDifficultyString = "";

    if (difficulty < 6) {
        roleDifficultyString = "-M2-5";
    } else if (difficulty < 11) {
        roleDifficultyString = "-M6-10";
    } else if (difficulty < 16) {
        roleDifficultyString = "-M11-15";
    } else if (difficulty < 21) {
        roleDifficultyString = "-M16-20";
    } else {
        roleDifficultyString = "-M21+";
    }

    const globalRoles = global.roleMap.get(guildId);

    const rolesToTag = [];

    for (const role of uniqueRoles) {
        const roleId = globalRoles.get(`${role}${roleDifficultyString}`);
        rolesToTag.push(`${roleId}`);
    }
    const roleMentions = rolesToTag.map((roleId) => `<@&${roleId}>`).join(" ");

    return roleMentions;
}

function isUserInRoleLists(interaction, user, mainObject) {
    // Use slice(0, 3) to select the first three roles
    const firstThreeRoles = Object.values(mainObject.roles).slice(0, 3);
    const lists = firstThreeRoles.map((role) => role.spots);
    const userExists = lists.some((list) => list.includes(user));

    if (userExists) {
        interaction.reply({
            content: `You are already signed up for this dungeon 🙌`,
            ephemeral: true,
        });
    }

    return userExists;
}

module.exports = {
    generateRoleIcons,
    generateListedAsString,
    generatePassphrase,
    isDPSRole,
    parseRolesToTag,
    isUserInRoleLists,
};
