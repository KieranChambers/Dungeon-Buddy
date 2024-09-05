const { dungeonData } = require("./loadJson.js");

const filterSpots = (spots, interactionUserId) => {
    return spots.filter((member) => member !== interactionUserId && !member.includes("~~Filled Spot"));
};

async function sendCancelMessage(channel, mainObject, message) {
    const interactionUserId = mainObject.interactionUser.userId;
    const dungeonName = mainObject.embedData.dungeonName;
    const dungeonDifficulty = mainObject.embedData.dungeonDifficulty;

    // Only notify the other members that are not the interaction user
    const membersToTag = [
        ...filterSpots(mainObject.roles.Tank.spots, interactionUserId),
        ...filterSpots(mainObject.roles.Healer.spots, interactionUserId),
        ...filterSpots(mainObject.roles.DPS.spots, interactionUserId),
    ];

    // If there are no members to tag, return
    if (membersToTag.length === 0) {
        return;
    }

    await channel.send({
        content: `${dungeonName} ${dungeonDifficulty} ${message} \n${membersToTag.join(" ")}`,
    });
}

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

    if (difficulty == "M0") {
        roleDifficultyString = "-M0";
    } else if (difficulty < 4) {
        roleDifficultyString = "-M2-3";
    } else if (difficulty < 7) {
        roleDifficultyString = "-M4-6";
    } else if (difficulty < 10) {
        roleDifficultyString = "-M7-9";
    } else {
        roleDifficultyString = "M10";
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

function addUserToRole(userId, userNickname, mainObject, newRole, typeOfCollector) {
    if (userId === mainObject.interactionUser.userId && typeOfCollector === "groupUtilityCollector") {
        const filledSpot = mainObject.embedData.filledSpot;
        let filledSpotCounter = mainObject.embedData.filledSpotCounter;
        const filledSpotCombined = `${filledSpot}${filledSpotCounter}`;

        mainObject.roles[newRole].spots.push(filledSpotCombined);
        mainObject.roles[newRole].nicknames.push(filledSpot);

        filledSpotCounter++;
        mainObject.embedData.filledSpotCounter = filledSpotCounter;

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

// TODO: Pull the short forms in using the existing dungeon data JSON
async function invalidDungeonString(interaction, reason) {
    const breakdownString = `\n\nExample string: \`aa 0t d hdd\`\n\`aa\` - Short form dungeon name\n\`0t\` - dungeon level + time or completion\n\`d\` - your role\n\`hdd\` - Required roles\n\nShort form Dungeon Names (not case-sensitive)\nAA - Algeth'ar Academy\nBH - Brackenhide Hollow\nHOI - Halls of Infusion\nNELT - Neltharus\nRLP - Ruby Life Pools\nAV - The Azure Vault\nNO - The Nokhud Offensive\nULD - Uldaman: Legacy of Tyr\n\n`;
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
    sendCancelMessage,
};
