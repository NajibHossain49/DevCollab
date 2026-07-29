const path = require("path");
const { runProcess } = require("./_run");

const CODES_DIR = path.join(__dirname, "..", "codes");

async function executePython(codeFile, input) {
  try {
    const output = await runProcess("python3", [path.join(CODES_DIR, codeFile)], input);
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { executePython };
