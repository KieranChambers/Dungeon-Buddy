const { SlashCommandBuilder } = require("@discordjs/builders");

const message = `
Post any issues in <#1194741620441096332>

\`/lfg\` is used to create a group for the dungeon. Choose desired dungeon > dungeon difficulty > timed/completed > your role > required roles.

\`/lfgquick\` is used to quickly create a group using a *quick string*. Example: \`fall 15toa d hdd\` (Type \`/lfgquick\` and enter \`help\` for a detailed breakdown of this command).

\`/lfghistory\` is used to check up-to 10 of your latest groups. Previous teammates & passphrases can be found here.

\`/lfgstats\` is used to check total groups created, groups created in the last 24h, 7d, 30d & also the most popular dungeons for each key range.

Info:
- A generated \`listed_as\` group name will be supplied for you. It contains a random two-letter suffix to assist members in finding your group in-game
- You can assign your own \`listed_as\` name during the creation process by typing \`/lfg\`, choosing the \`<listed_as>\` option and entering your desired group name
- A *hidden* passphrase is generated when you create a group. This is only available to you and the other members that join
- The group creator can fill roles by clicking on the respective role button. This is good if you have a friend who is joining the group but is not on discord
- Group members can change roles by clicking on another role
- Group members can leave the group by clicking on the ⚙️ button
- The group creator can cancel the group by clicking on the ⚙️ button and then clicking on \`Cancel Group\` 2x
- LFG times out after 30 mins if there is still available spots
- Once a group is filled, the buttons will disappear after roughly 2 mins`;

module.exports = {
    data: new SlashCommandBuilder().setName("lfghelp").setDescription("Get help with the commands for LFG."),
    async execute(interaction) {
        await interaction.reply({
            content: `${message}`,
            ephemeral: true,
        });
    },
};
