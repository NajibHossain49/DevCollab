const path = require("path");
const { runProcess } = require("./_run");

const CODES_DIR = path.join(__dirname, "..", "codes");

async function executeJavaScript(codeFile, input) {
  try {
    const output = await runProcess("node", [path.join(CODES_DIR, codeFile)], input);
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { executeJavaScript };
