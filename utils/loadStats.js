const fs = require("fs");
const path = require("path");
const { Sequelize, Op } = require("sequelize");
const { dungeonInstanceTable, sequelize } = require("./loadDb.js");
const { currentExpansion, currentSeason } = require("./loadJson.js");

const dungeonStatsObject = {
    dungeonGroupsCreated: {
        total: 0,
        today: 0,
        weekly: 0,
        monthly: 0,
    },
    mostPopularDungeons: [],
    mostPopularKeys: {
        key_levels_one: [],
        key_levels_two: [],
        key_levels_three: [],
    },
};

const key_levels = {
    key_levels_one: ["M0"],
    key_levels_two: ["+2", "+3", "+4", "+5"],
    key_levels_three: ["+6", "+7", "+8", "9", "10"],
};

const popularKeysQuery = `
WITH popular_keys AS (
	SELECT
		dungeon_name,
		dungeon_difficulty,
		COUNT(*) AS count,
		ROW_NUMBER() OVER(PARTITION BY dungeon_name ORDER BY COUNT(*) DESC) AS rn
	FROM
		dungeoninstances
	WHERE dungeon_difficulty in (:key_levels)
    AND expansion = '${currentExpansion}'
    AND season = '${currentSeason}'
	GROUP BY
		dungeon_name,
		dungeon_difficulty
	)
	SELECT
		dungeon_name,
		dungeon_difficulty,
		count
	FROM
		popular_keys
	WHERE
		rn = 1
	ORDER BY
		count DESC;
`;

async function loadStats() {
    const numGroupsCreatedTotal = await dungeonInstanceTable
        .findOne({
            attributes: [[sequelize.fn("max", sequelize.col("dungeon_id")), "max_id"]],
        })
        .then((res) => res.dataValues.max_id);

    const numGroupsCreatedToday = await dungeonInstanceTable
        .findOne({
            attributes: [[sequelize.fn("count", sequelize.col("*")), "count"]],
            where: {
                createdAt: {
                    [Op.gte]: new Date(new Date() - 24 * 60 * 60 * 1000),
                },
            },
        })
        .then((res) => res.dataValues.count);

    const numGroupsCreatedWeek = await dungeonInstanceTable
        .findOne({
            attributes: [[sequelize.fn("count", sequelize.col("*")), "count"]],
            where: {
                createdAt: {
                    [Op.gte]: new Date(new Date() - 7 * 24 * 60 * 60 * 1000),
                },
            },
        })
        .then((res) => res.dataValues.count);

    const numGroupsCreatedMonth = await dungeonInstanceTable
        .findOne({
            attributes: [[sequelize.fn("count", sequelize.col("*")), "count"]],
            where: {
                createdAt: {
                    [Op.gte]: new Date(new Date() - 30 * 24 * 60 * 60 * 1000),
                },
            },
        })
        .then((res) => res.dataValues.count);

    // All-time most popular dungeons
    const mostPopularDungeons = await dungeonInstanceTable
        .findAll({
            attributes: ["dungeon_name", [sequelize.fn("count", sequelize.col("*")), "count"]],
            group: ["dungeon_name"],
            order: [[sequelize.literal("count DESC")]],
        })
        .then((res) => res.map((dungeon) => dungeon.dataValues));

    // Most popular keys in each bracket
    for (key in key_levels) {
        const result = await sequelize.query(popularKeysQuery, {
            replacements: { key_levels: key_levels[key] },
            type: Sequelize.QueryTypes.SELECT,
        });
        dungeonStatsObject.mostPopularKeys[key] = result;
    }

    dungeonStatsObject.dungeonGroupsCreated.total = numGroupsCreatedTotal;
    dungeonStatsObject.dungeonGroupsCreated.today = numGroupsCreatedToday;
    dungeonStatsObject.dungeonGroupsCreated.weekly = numGroupsCreatedWeek;
    dungeonStatsObject.dungeonGroupsCreated.monthly = numGroupsCreatedMonth;

    dungeonStatsObject.mostPopularDungeons = mostPopularDungeons;

    // Write dungeonStatsObject to a JSON file
    const dungeonUserStatsPath = path.join(
        __dirname,
        `../jsonFiles/dungeonUserStats/${currentExpansion}/season${currentSeason}.json`
    );
    fs.writeFileSync(dungeonUserStatsPath, JSON.stringify(dungeonStatsObject));
}

module.exports = { loadStats };
