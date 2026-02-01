const { REST, Routes } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Deploys slash commands to Discord
 * @param {string} token - Discord bot token
 * @param {string} clientId - Discord application client ID
 * @param {string} guildId - Discord guild/server ID
 * @returns {Promise<void>}
 */
async function deployCommands(token, clientId, guildId) {
    const commands = [];
    
    // Grab all the command files from the commands directory
    const foldersPath = path.join(__dirname, "..", "commands");
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
        
        // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            
            if ("data" in command && "execute" in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
            }
        }
    }

    // Construct and prepare an instance of the REST module
    const rest = new REST().setToken(token);

    try {
        console.log(`[DEPLOY] Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
            body: commands,
        });

        console.log(`[DEPLOY] Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error("[DEPLOY ERROR]", error);
        throw error;
    }
}

module.exports = { deployCommands };
