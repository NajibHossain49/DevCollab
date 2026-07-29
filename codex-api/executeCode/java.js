const path = require("path");
const { runProcess } = require("./_run");

const CODES_DIR = path.join(__dirname, "..", "codes");

// Uses the JDK single-file source-code launcher (JEP 330, Java 11+): the
// public class name does not need to match the file name, so user code that
// declares `public class Main` runs regardless of the generated file name.
async function executeJava(codeFile, input) {
  try {
    const output = await runProcess(
      "java",
      ["-Dfile.encoding=UTF-8", path.join(CODES_DIR, codeFile)],
      input,
    );
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { executeJava };
