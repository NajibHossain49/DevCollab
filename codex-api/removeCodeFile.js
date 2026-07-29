const fs = require("fs");
const path = require("path");

// Best-effort cleanup of the generated source file and any compiled artifact.
const removeCodeFile = (uuid, lang) => {
  const codeFile = path.join(__dirname, `codes/${uuid}.${lang}`);
  const outputFile = path.join(__dirname, `classes/${uuid}.out`);

  for (const file of [codeFile, outputFile]) {
    try {
      fs.unlinkSync(file);
    } catch {
      // Missing file is fine — nothing to clean up.
    }
  }
};

module.exports = { removeCodeFile };
