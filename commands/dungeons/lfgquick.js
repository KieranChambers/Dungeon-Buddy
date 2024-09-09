const { SlashCommandBuilder } = require("discord.js");

const { acronymToNameMap } = require("../../utils/loadJson");
const { getMainObject } = require("../../utils/getMainObject");
const { stripListedAsNumbers, invalidDungeonString } = require("../../utils/utilFunctions");
const { sendEmbed } = require("../../utils/sendEmbed");
const { interactionStatusTable } = require("../../utils/loadDb");
const { processError } = require("../../utils/errorHandling");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lfgquick")
        .setDescription("Use the quick command to find a group for your key.")
        .addStringOption((option) =>
            option
                .setName("quick_dungeon_string")
                .setDescription(`Enter the quick string for your key e.g. "fall 15t t hdd"`)
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("listed_as")
                .setDescription("Specify a listed as name for your dungeon. Otherwise one will be generated for you.")
                .setRequired(false)
        )
        .addStringOption((option) =>
            option
                .setName("creator_notes")
                .setDescription("Add some additional information about your group.")
                .setRequired(false)
        ),
    async execute(interaction) {
        const mainObject = getMainObject(interaction);

        try {
            const quickString = interaction.options.getString("quick_dungeon_string");
            const quickStringParts = quickString.split(" ");
            if (quickStringParts.length !== 4) {
                await invalidDungeonString(interaction, "**String must be 4 parts separated by spaces.**");
                return;
            }

            const dungeonAcronym = quickStringParts[0];
            if (!acronymToNameMap.hasOwnProperty(dungeonAcronym.toUpperCase())) {
                await invalidDungeonString(interaction, "**You entered an invalid dungeon acronym.**");
                return;
            }

            const levelAndRunType = quickStringParts[1];
            const timeCompletionMatch = levelAndRunType.match(/(\d+)(c|t)/i);
            if (!timeCompletionMatch) {
                await invalidDungeonString(interaction, "**Invalid time or completion.**");
                return;
            }

            const userRole = quickStringParts[2];
            const roleMatch = userRole.match(/(t|h|d)/i);
            if (!roleMatch || userRole.length > 1) {
                await invalidDungeonString(interaction, "**You entered an invalid user role.**");
                return;
            }

            const requiredRoles = quickStringParts[3];
            const requiredRolesMatch = requiredRoles.match(/(t|h|d)/i);
            if (!requiredRolesMatch || requiredRoles.length > 4) {
                await invalidDungeonString(interaction, "**You entered invalid required roles.**");
                return;
            }

            // Count the number of each role in the string
            const roleCounts = { t: 0, h: 0, d: 0 };
            roleCounts[userRole.toLowerCase()] += 1;

            for (const char of requiredRoles.toLowerCase()) {
                if (roleCounts.hasOwnProperty(char)) {
                    roleCounts[char] += 1;
                }
            }

            if (roleCounts.t > 1 || roleCounts.h > 1 || roleCounts.d > 3) {
                await invalidDungeonString(interaction, "**You entered too many of the same role.**");
                return;
            }

            // Parse key levels from the channel name
            const currentChannel = interaction.channel;
            const channelName = currentChannel.name;
            const channelNameSplit = channelName.split("-");
            const lowerDifficultyRange = parseInt(channelNameSplit[1].replace("m", ""));
            const upperDifficultyRange =
                lowerDifficultyRange === 0 ? 0 : parseInt(channelNameSplit[2].replace("m", ""));

            const difficultyPrefix = lowerDifficultyRange === 0 ? "M" : "+";
            const dungeonDifficulty = parseInt(timeCompletionMatch[1], 10);
            if (dungeonDifficulty < lowerDifficultyRange || dungeonDifficulty > upperDifficultyRange) {
                await invalidDungeonString(
                    interaction,
                    `**Your key level must be between +${lowerDifficultyRange} and +${upperDifficultyRange} in this chat.**`
                );
                return;
            }

            // Set the listed as group name/creator notes if applicable
            const listedAs = interaction.options.getString("listed_as");
            if (listedAs) {
                const tempListedAs = stripListedAsNumbers(listedAs);
                if (tempListedAs) {    
                    mainObject.embedData.listedAs = tempListedAs;
                }
            }
            const creatorNotes = interaction.options.getString("creator_notes");
            if (creatorNotes) {
                mainObject.embedData.creatorNotes = creatorNotes;
            }

            const dungeonToRun = acronymToNameMap[dungeonAcronym.toUpperCase()];
            mainObject.embedData.dungeonName = dungeonToRun;
            mainObject.embedData.dungeonDifficulty = `${difficultyPrefix}${dungeonDifficulty}`;

            const timeOrCompletion = timeCompletionMatch[2].toUpperCase() === "C" ? "Completion" : "Time";
            mainObject.embedData.timeOrCompletion = timeOrCompletion;

            // Add the user's chosen role to the main object so it's easily accessible
            const userRoleUpper = userRole.toUpperCase();
            const userChosenRole = userRoleUpper === "T" ? "Tank" : userRoleUpper === "H" ? "Healer" : "DPS";
            mainObject.interactionUser.userChosenRole = userChosenRole;
            mainObject.roles[userChosenRole].spots.push(mainObject.interactionUser.userId);
            mainObject.roles[userChosenRole].nicknames.push(mainObject.interactionUser.nickname + " 🚩");
            if (userChosenRole !== "DPS") {
                mainObject.roles[userChosenRole].disabled = true;
            }

            const requiredRolesArray = [];
            for (const char of requiredRoles) {
                const charUpper = char.toUpperCase();
                if (charUpper === "T") {
                    requiredRolesArray.push("Tank");
                } else if (charUpper === "H") {
                    requiredRolesArray.push("Healer");
                } else if (charUpper === "D") {
                    requiredRolesArray.push("DPS");
                }
            }

            const standardComposition = ["Tank", "Healer", "DPS", "DPS", "DPS"];

            const rolesMap = new Map();

            requiredRolesArray.forEach((item) => rolesMap.set(item, (rolesMap.get(item) || 0) + 1));

            const dungeonComposition = standardComposition.filter((item) => {
                if (!rolesMap.has(item) || rolesMap.get(item) === 0) {
                    return true;
                }
                rolesMap.set(item, rolesMap.get(item) - 1);
                return false;
            });

            // Remove the users chosen role
            const index = dungeonComposition.indexOf(userChosenRole);
            if (index > -1) {
                dungeonComposition.splice(index, 1);
            }

            const filledSpot = mainObject.embedData.filledSpot;
            let filledSpotCounter = 0;

            for (const role of dungeonComposition) {
                const filledSpotCombined = `${filledSpot}${filledSpotCounter}`;

                // Add filled members to the spots and nicknames arrays
                mainObject.roles[role].spots.push(filledSpotCombined);
                mainObject.roles[role].nicknames.push(filledSpot);

                //  Disable the role buttons if the role is full
                if (mainObject.roles["DPS"].spots.length >= 3) {
                    mainObject.roles["DPS"].disabled = true;
                } else if (role !== "DPS") {
                    mainObject.roles[role].disabled = true;
                }
                filledSpotCounter++;
            }

            // Update the filled spot counter in the main object
            mainObject.embedData.filledSpotCounter = filledSpotCounter;

            // Reply to the interaction first then send the embed which catches any errors
            await interaction.reply({
                content: `**Please ensure applying members are __from NoP__ and __use the passphrase__ in-game!**\nThe passphrase for the dungeon is: \`${mainObject.utils.passphrase.phrase}\``,
                ephemeral: true,
            });

            await sendEmbed(mainObject, currentChannel, requiredRolesArray);

            // Send the created dungeon status to the database
            await interactionStatusTable.create({
                interaction_id: interaction.id,
                interaction_user: interaction.user.id,
                interaction_status: "created",
                command_used: "lfgquick",
            });
        } catch (e) {
            processError(e, interaction);
        }
    },
};
