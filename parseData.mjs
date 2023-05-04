// Parses the competition folder structure into a json file
// Run with Node.js
// TODO: complete parseIO
// TODO: parse hashcode
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
 * Parses how the code is scored/validated
 *
 * @param {string} problemFolder
 * @returns
 */
async function parseIO(problemFolder) {
    // TODO: complete
    return problemFolder;
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

        const isCustom = Boolean(problemObj.validation);

        const info = await parseIO(problemFolder);

        if (roundObj.name.length === 0) {
            roundObj.name = problemObj.source;
        }
        console.assert(roundObj.name === problemObj.source);

        roundObj.problems.push({
            name: problemObj.name,
            isCustom,
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

const archive = "./coding-competitions-archive";

// Parses the directories
const [codejam, codejam_to_io, farewell, kickstart] = await Promise.all([
    parseDirectory(`${archive}/codejam`),
    parseDirectory(`${archive}/codejam_to_io`),
    parseDirectory(`${archive}/farewell`),
    parseDirectory(`${archive}/kickstart`),
]);

// Data object
const dataObj = {
    codejam,
    codejam_to_io,
    farewell,
    hashcode: {},
    kickstart,
};

// Writes it to a file
await fs.writeFile("./competitionStructure.json", JSON.stringify(dataObj, null, 4));
