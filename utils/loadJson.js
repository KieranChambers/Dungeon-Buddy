const fs = require("fs");

function loadJSON(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function getCurrentSeason() {
    const config = loadJSON("./jsonFiles/config.json");
    return config.currentSeason;
}

function getDungeonData(currentSeason) {
    const dungeonData = loadJSON(`./jsonFiles/dungeonData/season${currentSeason}.json`)[currentSeason];

    const dungeonList = [];
    const acronymToNameMap = {};

    for (const dungeon in dungeonData) {
        dungeonList.push(dungeon);
        acronymToNameMap[dungeonData[dungeon].acronym] = dungeon;
    }

    return { dungeonData, dungeonList, acronymToNameMap };
}

const currentSeason = getCurrentSeason();
const { dungeonData, dungeonList, acronymToNameMap } = getDungeonData(currentSeason);
const wowWords = loadJSON("./jsonFiles/wowWords.json");

module.exports = { dungeonData, dungeonList, acronymToNameMap, wowWords };
