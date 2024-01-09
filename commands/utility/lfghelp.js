const { SlashCommandBuilder } = require("@discordjs/builders");

const message = `
Post any issues in <#1090020015589294132> and feel free to tag <@268396301928890369>!

There are currently 2 commands available: 
\`\`\` /lfg\`\`\`
This is used to create a group for the dungeon. Users choose the following *required* options from a drop-down style menu:
- Dungeon
- Dungeon difficulty
- Timed/Completed
- Your role
- Required roles

\`\`\` /lfghistory\`\`\`
This is used to check up-to 10 of your previous dungeons.
- Previous teammates & passphrases can be found here.

**INFO**
- By default, a generated \`listed_as\` group name will be supplied for you. It contains a random two-letter suffix to assist members in finding your group in-game.
- You can assign your own \`listed_as\` name during the creation process by typing \`/lfg\`, choosing the \`<listed_as>\` option and entering your desired group name.
- A *hidden* passphrase is generated when you create a group. This is only available to you and the other members that join.
- The group creator can fill roles by clicking on the respective role button. This is good if you have a friend who is joining the group but is not on discord.
- Group members can change roles by clicking on another role. This is not the case for the group creator.
- Group members can leave the group by clicking on the ❌ button.
- The group creator can cancel the group by clicking on the ❌ button and confirming the action.
- 60s timeout when using choosing each of the required options. 30min timeout on filling a group.`;

module.exports = {
    data: new SlashCommandBuilder().setName("lfghelp").setDescription("Get help with the commands for LFG."),
    async execute(interaction) {
        await interaction.reply({
            content: `${message}`,
            ephemeral: true,
        });
    },
};
