const { dungeonData } = require("./loadJson.js");

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

function addUserToRole(userId, mainObject, newRole) {
    if (userId === mainObject.interactionUser.userId) {
        mainObject.roles.Tank.spots.push(mainObject.embedData.filledSpot);
    } else {
        // Use slice(0, 3) to select the first three roles
        const firstThreeRoles = Object.entries(mainObject.roles).slice(0, 3);

        // Check if the user already is part of the group
        for (let [roleName, roleData] of firstThreeRoles) {
            if (roleData.spots.includes(userId)) {
                // Remove the user from the previous role
                const userIndex = roleData.spots.indexOf(userId);
                if (userIndex > -1) {
                    roleData.spots.splice(userIndex, 1);

                    // If the previous role button was disabled, enable it
                    if (roleName === "Tank" || roleName === "Healer") {
                        mainObject.roles[roleName].disabled = false;
                    } else if (roleName === "DPS" && roleData.spots.length < 3) {
                        mainObject.roles[roleName].disabled = false;
                    }
                }
            }
        }
        // Add the user to the new role
        mainObject.roles[newRole].spots.push(userId);

        if (mainObject.roles[newRole].spots.length === 3) {
            mainObject.roles[newRole].disabled = true;
        } else if (newRole === "Tank" || newRole === "Healer") {
            mainObject.roles[newRole].disabled = true;
        }
    }

    // TODO: Think about if we need this or if a full group is enough
    // Counting the total number of filled spots
    // let filledSpotsCount = 0;
    // for (let roleData of Object.values(mainObject.roles).slice(0, 3)) {
    //     filledSpotsCount += roleData.spots.length;
    // }

    return;
}

module.exports = {
    generateRoleIcons,
    generateListedAsString,
    generatePassphrase,
    isDPSRole,
    parseRolesToTag,
    addUserToRole,
};
