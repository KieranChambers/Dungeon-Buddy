const fs = require("fs");

function loadJSON(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function getCurrentExpSeason() {
    const config = loadJSON("./jsonFiles/config.json");
    const currentExpansion = config.currentExpansion;
    const currentSeason = config.currentSeason;
    return [currentExpansion, currentSeason];
}

function getDungeonData(currentExpansion, currentSeason) {
    const dungeonData = loadJSON(`./jsonFiles/dungeonData/${currentExpansion}/season${currentSeason}.json`);

    const dungeonList = [];
    const acronymToNameMap = {};

    for (const dungeon in dungeonData) {
        dungeonList.push(dungeon);
        acronymToNameMap[dungeonData[dungeon].acronym] = dungeon;
    }

    return { dungeonData, dungeonList, acronymToNameMap };
}

const [currentExpansion, currentSeason] = getCurrentExpSeason();
const { dungeonData, dungeonList, acronymToNameMap } = getDungeonData(currentExpansion, currentSeason);
const wowWords = loadJSON("./jsonFiles/wowWords.json");

module.exports = { dungeonData, dungeonList, acronymToNameMap, wowWords, currentExpansion, currentSeason };
