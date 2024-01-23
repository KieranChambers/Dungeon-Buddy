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
    for (const dungeon in dungeonData) {
        dungeonList.push(dungeon);
    }

    return { dungeonData, dungeonList };
}

const currentSeason = getCurrentSeason();
const { dungeonData, dungeonList } = getDungeonData(currentSeason);
const wowWords = loadJSON("./jsonFiles/wowWords.json");

module.exports = { dungeonData, dungeonList, wowWords };
