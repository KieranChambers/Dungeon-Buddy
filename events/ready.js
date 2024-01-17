const { Events } = require("discord.js");
const { syncTables } = require("../utils/loadDb");

// TODO: Look into whether we need this in production
// function cacheGuildMembers(client) {
//     // Fetch and cache members for all guilds
//     fetchAndCacheMembers(client);

//     // Set an interval to refetch every hour (3600000 milliseconds)
//     setInterval(() => fetchAndCacheMembers(client), 1800000);
// }

// function fetchAndCacheMembers(client) {
//     console.log("Caching members...");
//     client.guilds.cache.forEach((guild) => {
//         guild.members
//             .fetch()
//             .then((members) => {
//                 console.log(`Fetched and cached ${members.size} members for guild: ${guild.name}`);
//             })
//             .catch((err) => {
//                 console.error(`Error fetching members for guild ${guild.name}: ${err}`);
//             });
//     });
// }

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
        // TODO: Look into whether we need this in production
        // cacheGuildMembers(client);
    },
};
