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

function generateRandomLetterPair() {
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    let letters = "";
    for (let i = 0; i < 2; i++) {
        const randomIndex = Math.floor(Math.random() * alphabet.length);
        letters += alphabet[randomIndex];
    }
    return letters.toUpperCase();
}

function generateListedAsString(dungeon) {
    const dungeonAcronym = dungeonData[dungeon].acronym;
    const randomLetterPair = generateRandomLetterPair();

    return `NoP ${dungeonAcronym} ${randomLetterPair}`;
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
        content: `The passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\`\nAdd this to your note when applying to \`${mainObject.embedData.listedAs}\` in-game!`,
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

function removeUserFromRole(userId, userNickname, mainObject, roleName, roleData) {
    roleData.spots.splice(roleData.spots.indexOf(userId), 1);
    roleData.nicknames.splice(roleData.nicknames.indexOf(userNickname), 1);
    updateButtonState(mainObject, roleName);
}

function userExistsInAnyRole(userId, mainObject) {
    const firstThreeRoles = Object.entries(mainObject.roles).slice(0, 3);

    for (let [roleName, roleData] of firstThreeRoles) {
        if (roleData.spots.includes(userId)) {
            return [roleName, roleData];
        }
    }
    return false;
}

function addUserToRole(userId, userNickname, mainObject, newRole) {
    if (userId === mainObject.interactionUser.userId) {
        mainObject.roles[newRole].spots.push(mainObject.embedData.filledSpot);
        mainObject.roles[newRole].nicknames.push(mainObject.embedData.filledSpot);
        updateButtonState(mainObject, newRole);
        return "interactionUser";
    } else {
        if (!userExistsInAnyRole(userId, mainObject)) {
            mainObject.roles[newRole].spots.push(userId);
            mainObject.roles[newRole].nicknames.push(userNickname);
            updateButtonState(mainObject, newRole);
            return "newUser";
        } else {
            const [roleName, roleData] = userExistsInAnyRole(userId, mainObject);
            if (roleName === newRole) {
                return "sameRole";
            }
            removeUserFromRole(userId, userNickname, mainObject, roleName, roleData);
            mainObject.roles[newRole].spots.push(userId);
            mainObject.roles[newRole].nicknames.push(userNickname);
            updateButtonState(mainObject, newRole);
            return "existingUser";
        }
    }
}

async function invalidDungeonString(interaction, reason) {
    const breakdownString = `\n\nExample string: \`fall 15t d hdd\`\n\`fall\` - Short form dungeon name\n\`15t\` - dungeon level + time or completion\n\`d\` - your role\n\`hdd\` - Required roles\n\nShort form Dungeon Names (not case-sensitive)\nAD - Atal'Dazar\nBRH - Black Rook Hold\nDHT - Darkheart Thicket\nFALL - DOTI: Galakrond's Fall\nRISE - DOTI: Murozond's Rise\nBLOOM- The Everbloom\nTOT - Throne of the Tides\nWM - Waycrest Manner\n\n`;
    const invalidDungeonString = `Please enter a valid quick string.`;
    if (!reason) {
        reason = invalidDungeonString + breakdownString;
    } else {
        reason = reason + breakdownString;
    }

    await interaction.reply({
        content: `${reason}`,
        ephemeral: true,
    });
    return;
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
    removeUserFromRole,
    invalidDungeonString,
};
