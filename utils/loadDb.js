const Sequelize = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize("database", "user", "password", {
    host: process.env.DB_HOST,
    dialect: process.env.DB_DIALECT,
    storage: process.env.DB_STORAGE,
});

// Define the structure for the DungeonInstance table
const dungeonInstanceTable = sequelize.define("dungeoninstance", {
    dungeon_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    dungeon_name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    dungeon_difficulty: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    interaction_user: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    user_chosen_role: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    tank: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    healer: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    dps: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    dps2: {
        type: Sequelize.STRING,
        allowNull: true,
    },
    dps3: {
        type: Sequelize.STRING,
        allowNull: true,
    },
});

const errorTable = sequelize.define("errors", {
    error_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    error_name: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    error_message: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    user_id: {
        type: Sequelize.STRING,
        allowNull: false,
    },
});

const interactionStatusTable = sequelize.define("interaction_status", {
    status_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    interaction_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },
    interaction_user: {
        type: Sequelize.STRING,
        allowNull: false,
    },
    interaction_status: {
        type: Sequelize.STRING,
        allowNull: false,
    },
});

function syncTables() {
    sequelize.sync({ force: false });
}

module.exports = { syncTables, dungeonInstanceTable, errorTable, interactionStatusTable };
