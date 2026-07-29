const path = require("path");
const { runProcess } = require("./_run");

const CODES_DIR = path.join(__dirname, "..", "codes");
// tsx (esbuild-based) runs TypeScript directly, stripping types without a
// separate type-check step — fast and good enough for execution.
const TSX_BIN = path.join(__dirname, "..", "node_modules", ".bin", "tsx");

async function executeTypeScript(codeFile, input) {
  try {
    const output = await runProcess(TSX_BIN, [path.join(CODES_DIR, codeFile)], input);
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { executeTypeScript };
