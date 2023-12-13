const { Events } = require("discord.js");
const { syncTables } = require("../utils/loadDb");

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        syncTables();
        console.log(`Ready! Logged in as ${client.user.tag}`);

        client.guilds.cache.forEach((guild) => {
            guild.roles
                .fetch()
                .then((roles) => {
                    // Create an object to store role names and IDs
                    const roleInfo = new Map();

                    // Iterate over each role and store the name and ID
                    roles.forEach((role) => {
                        roleInfo.set(role.name, role.id);
                    });

                    // Store the role information in the global map
                    global.roleMap.set(guild.id, roleInfo);
                })
                .catch((err) => {
                    console.error(`Error fetching roles for guild ${guild.name}: ${err}`);
                });
        });
    },
};
