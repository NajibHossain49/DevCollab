const { v4: getUUID } = require("uuid");
const fs = require("fs");
const path = require("path");

const CODES_DIR = path.join(__dirname, "codes");
const CLASSES_DIR = path.join(__dirname, "classes");

if (!fs.existsSync(CODES_DIR)) fs.mkdirSync(CODES_DIR);
if (!fs.existsSync(CLASSES_DIR)) fs.mkdirSync(CLASSES_DIR);

// Writes the submitted source to codes/<uuid>.<language> and returns the
// file name. The extension doubles as the language marker for cleanup.
const createCodeFile = (language, code) => {
  const jobID = getUUID();
  const fileName = `${jobID}.${language}`;
  fs.writeFileSync(path.join(CODES_DIR, fileName), code.toString());
  return fileName;
};

module.exports = { createCodeFile };
