// Parses the competition folder structure into a json file
// Run with Node.js
// TODO: parse "custom" and "custom interactive"
import fs from "node:fs/promises";
import path from "node:path";

/**
 * A very crude yaml file parser
 * Doesn't even properly parse the yaml file
 *
 * @param {string} filePath
 */
async function customYamlParser(filePath) {
    const file = await fs.readFile(filePath, "utf-8");
    const lines = file
        .trim()
        .split(/\n+/)
        .map((x) => x.trim())
        .filter((x) => x.length !== 0 && !x.startsWith("#"));
    const lines2 = lines.map((x) => x.split(":").map((x) => x.trim()));
    const yamlObj = Object.fromEntries(lines2);
    return yamlObj;
}

/**
 * Parses the data folder
 *
 * @param {string} dataFolder
 */
async function parseDataFolder(dataFolder) {
    const dataObj = {
        points: -1,
        sample: [],
        secret: [],
    };
    const files = await fs.readdir(dataFolder);
    console.assert(files.filter((x) => x !== "sample" && x !== "secret" && x !== "testdata.yaml").length === 0);
    console.assert(files.includes("secret"));
    if (files.includes("sample")) {
        dataObj.sample.push({
            name: "sample1",
            points: 0,
            input: path.join(dataFolder, "sample", "1.in"),
            output: path.join(dataFolder, "sample", "1.ans"),
        });
        const testData = await customYamlParser(path.join(dataFolder, "sample", "testdata.yaml"));
        console.assert(testData.accept_score === "0");
        console.assert(testData.range === "0 0");
    }
    const testData2 = await customYamlParser(path.join(dataFolder, "secret", "testdata.yaml"));
    dataObj.points = Number(testData2.range.split(" ").at(-1));
    const secretPath = path.join(dataFolder, "secret");
    const subtasks = (await fs.readdir(secretPath)).filter((x) => x.startsWith("subtask"));
    const subtaskLength = 7;
    for (const subtask of subtasks) {
        const subTaskPath = path.join(secretPath, subtask);
        const number = Number(subtask.slice(subtaskLength));
        const subtaskData = await customYamlParser(path.join(subTaskPath, "testdata.yaml"));
        const subtaskPoints = Number(subtaskData.range.split(" ").at(-1));
        dataObj.secret.push({
            name: `secret${number}`,
            points: subtaskPoints,
            input: path.join(subTaskPath, "1.in"),
            output: path.join(subTaskPath, "1.ans"),
        });
    }
    return dataObj;
}

/**
 * Parses how the code is scored/validated
 *
 * @param {string} problemFolder
 * @param {string} validationType
 * @returns
 */
async function parseIO(problemFolder, validationType) {
    console.assert(validationType === "default" || validationType === "custom" || validationType === "custom interactive");
    if (validationType === "custom interactive") {
        return problemFolder;
    }
    if (validationType === "custom") {
        return problemFolder;
    }
    const dataObj = await parseDataFolder(path.join(problemFolder, "data"));
    return dataObj;
}

/**
 * Parses the rounds in each competition
 *
 * @param {string[]} problemFiles
 * @returns
 */
async function parseFiles(problemFiles) {
    const problemFolders = problemFiles.map((x) => path.dirname(x));
    const roundFolders = [...new Set(problemFolders.map((x) => path.join(x, "..")))];
    const roundMap = new Map(
        roundFolders.map((x) => [
            x,
            {
                name: "",
                year: Number(path.basename(path.join(x, ".."))) || 2023,
                folder: x,
                overview: path.join(x, "round_overview.html"),
                problems: [],
            },
        ])
    );
    for (const problemFolder of problemFolders) {
        const roundFolder = path.join(problemFolder, "..");
        const roundObj = roundMap.get(roundFolder);

        const problemYaml = path.join(problemFolder, "problem.yaml");
        const analysisPDF = path.join(problemFolder, "analysis.pdf");
        const statementPDF = path.join(problemFolder, "statement.pdf");
        const analysisHTML = path.join(problemFolder, "problem_statement", "analysis.html");
        const statementHTML = path.join(problemFolder, "problem_statement", "statement.html");

        const problemObj = await customYamlParser(problemYaml);

        const validationType = problemObj.validation ?? "default";

        const info = await parseIO(problemFolder, validationType);

        if (roundObj.name.length === 0) {
            roundObj.name = problemObj.source;
        }
        console.assert(roundObj.name === problemObj.source);

        roundObj.problems.push({
            name: problemObj.name,
            validationType,
            folder: problemFolder,
            statementPDF,
            analysisPDF,
            statementHTML,
            analysisHTML,
            info,
        });
    }
    return [...roundMap.values()];
}

/**
 * Searches through the folder structure
 *
 * @param {string} dir
 * @returns
 */
async function fileSearch(dir) {
    const dirItems = await fs.readdir(dir);
    return await Promise.all(
        dirItems.map(async (x) => {
            const itemPath = path.join(dir, x);
            const isFile = (await fs.lstat(itemPath)).isFile();
            return { path: itemPath, isFile };
        })
    );
}

/**
 * Gets the file path for all the problem.yaml files
 *
 * @param {string} dir
 * @returns
 */
async function getProblemFiles(dir) {
    /** @type {string[]} */
    const problemFiles = [];
    /** @type {string[]} */
    const arr = [dir];
    while (arr.length !== 0) {
        const dirPath = arr.shift();
        const files = await fileSearch(dirPath);
        const yamlFiles = files.filter((x) => x.isFile && x.path.endsWith("problem.yaml"));
        if (yamlFiles.length !== 0) {
            problemFiles.push(...yamlFiles.map((x) => x.path));
            continue;
        }
        const dirs = files.filter((x) => !x.isFile).map((x) => x.path);
        arr.push(...dirs);
    }
    return problemFiles;
}

/**
 * Parses a competition directory
 *
 * @param {string} dir
 * @returns
 */
async function parseDirectory(dir) {
    const problemFiles = await getProblemFiles(dir);
    const roundObjects = await parseFiles(problemFiles);
    const roundObjects2 = {};
    for (const roundObject of roundObjects) {
        if (!roundObjects2[roundObject.year]) {
            roundObjects2[roundObject.year] = [];
        }
        roundObjects2[roundObject.year].push(roundObject);
    }
    return roundObjects2;
}

/**
 * Special function to parse Google Hash Code
 *
 * @param {string} dir
 */
async function parseHashCode(dir) {
    const hashObj = {};
    const folders = (await fs.readdir(dir)).filter((x) => !x.endsWith(".pdf")).map((x) => path.join(dir, x));
    for (const folder of folders) {
        const baseFolderName = path.basename(folder);
        const splitFolderName = baseFolderName.split("_");
        const year = Number(splitFolderName[1]);
        const type = splitFolderName[2];
        console.assert(splitFolderName[0] === "hashcode");
        console.assert(Number.isFinite(year));
        console.assert(type === "qualification" || type === "final");

        if (!hashObj[year]) {
            hashObj[year] = {
                name: `Hash Code ${year}`,
                year: year,
                qualification: {
                    name: `Hash Code ${year} - Qualification Round`,
                    problemPDF: "",
                    files: [],
                },
                final: {
                    name: `Hash Code ${year} - Final Round`,
                    problemPDF: "",
                    files: [],
                },
            };
        }

        const files = (await fs.readdir(folder)).map((x) => path.join(folder, x));

        hashObj[year][type].problemPDF = path.join(path.dirname(folder), baseFolderName + ".pdf");
        hashObj[year][type].files.push(...files);
    }
    return hashObj;
}

const archive = "./coding-competitions-archive";

// Parses the directories
const [codejam, codejam_to_io, farewell, kickstart] = await Promise.all([
    parseDirectory(`${archive}/codejam`),
    parseDirectory(`${archive}/codejam_to_io`),
    parseDirectory(`${archive}/farewell`),
    parseDirectory(`${archive}/kickstart`),
]);

const hashcode = await parseHashCode(`${archive}/hashcode`);

// Data object
const dataObj = {
    codejam,
    codejam_to_io,
    farewell,
    hashcode,
    kickstart,
};

// Writes it to a file
await fs.writeFile("./competitionStructure.json", JSON.stringify(dataObj, null, 4));
