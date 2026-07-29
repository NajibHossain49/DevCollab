const { executeJava } = require("./java");
const { executePython } = require("./python");
const { executeCorCPP } = require("./c_or_cpp");
const { executeJavaScript } = require("./javascript");
const { executeGo } = require("./go");

module.exports = {
  executeJava,
  executePython,
  executeCorCPP,
  executeJavaScript,
  executeGo,
};
