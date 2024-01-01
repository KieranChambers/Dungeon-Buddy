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

async function sendPassphraseToUser(interaction, mainObject) {
    await interaction.followUp({
        content: `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nAdd this to your note when applying to the group in-game!`,
        ephemeral: true,
    });
}

// Disable the button if the role is full
function updateButtonState(mainObject, roleName) {
    const role = mainObject.roles[roleName];
    if (roleName === "Tank" || roleName === "Healer") {
        role.disabled = role.spots.length >= 1;
    } else {
        role.disabled = role.spots.length >= 3;
    }
}

function userExistsInAnyRole(userId, mainObject, type) {
    const firstThreeRoles = Object.entries(mainObject.roles).slice(0, 3);

    for (let [roleName, roleData] of firstThreeRoles) {
        if (roleData.spots.includes(userId) && type === "getPassphrase") {
            return true;
        } else if (roleData.spots.includes(userId) && type === "addUserToRole") {
            roleData.spots.splice(roleData.spots.indexOf(userId), 1);
            // Enable the button if the role is no longer full
            updateButtonState(mainObject, roleName);
            return true;
        }
    }

    return false;
}

function addUserToRole(userId, mainObject, newRole) {
    if (userId === mainObject.interactionUser.userId) {
        mainObject.roles[newRole].spots.push(mainObject.embedData.filledSpot);
        updateButtonState(mainObject, newRole);
        return "interactionUser";
    } else {
        mainObject.roles[newRole].spots.push(userId);
        updateButtonState(mainObject, newRole);

        if (userExistsInAnyRole(userId, mainObject, "addUserToRole")) {
            return "existingUser";
        } else {
            return "newUser";
        }
    }
}

module.exports = {
    generateRoleIcons,
    generateListedAsString,
    generatePassphrase,
    isDPSRole,
    parseRolesToTag,
    userExistsInAnyRole,
    addUserToRole,
    sendPassphraseToUser,
};
