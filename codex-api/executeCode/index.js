const { executeJava } = require("./java");
const { executePython } = require("./python");
const { executeCorCPP } = require("./c_or_cpp");
const { executeJavaScript } = require("./javascript");
const { executeGo } = require("./go");
const { executeTypeScript } = require("./typescript");
const { executeRust } = require("./rust");

module.exports = {
  executeJava,
  executePython,
  executeCorCPP,
  executeJavaScript,
  executeGo,
  executeTypeScript,
  executeRust,
};
