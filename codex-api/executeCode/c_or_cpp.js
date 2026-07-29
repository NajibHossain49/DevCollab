const path = require("path");
const { runProcess } = require("./_run");

const CODES_DIR = path.join(__dirname, "..", "codes");
const CLASSES_DIR = path.join(__dirname, "..", "classes");

// Compiles the source with g++ and, on success, runs the produced binary.
// A non-zero g++ exit surfaces the compiler error; a non-zero run exit
// surfaces the program's stderr.
async function executeCorCPP(codeFile, input) {
  const base = codeFile.split(".")[0];
  const source = path.join(CODES_DIR, codeFile);
  const binary = path.join(CLASSES_DIR, `${base}.out`);

  try {
    await runProcess("g++", [source, "-O2", "-o", binary], "");
    const output = await runProcess(binary, [], input);
    return { success: true, output };
  } catch (error) {
    return { success: false, error };
  }
}

module.exports = { executeCorCPP };
