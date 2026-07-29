const express = require("express");
const cors = require("cors");

const { createCodeFile } = require("./createCodeFile");
const { removeCodeFile } = require("./removeCodeFile");
const {
  executeJava,
  executePython,
  executeCorCPP,
  executeJavaScript,
  executeGo,
} = require("./executeCode");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cors());

// Language slug -> runner. Matches the slugs the ws-server sends
// (js, py, java, cpp, go). TypeScript is mapped to js upstream; Rust is
// rejected upstream and is not handled here.
const RUNNERS = {
  py: executePython,
  js: executeJavaScript,
  java: executeJava,
  cpp: executeCorCPP,
  go: executeGo,
};

// Always responds with the CodeX-compatible shape the ws-server expects:
//   { timeStamp, status, output, error }
function respond(res, { status, output = "", error = "" }) {
  res.json({ timeStamp: Date.now(), status, output, error });
}

app.post("/", async (req, res) => {
  const { language = "", code = "", input = "" } = req.body ?? {};

  if (typeof code !== "string" || code.trim() === "") {
    respond(res, { status: 400, error: "No code specified to execute." });
    return;
  }

  const runner = RUNNERS[language];
  if (!runner) {
    respond(res, { status: 400, error: `Language "${language}" is not supported.` });
    return;
  }

  const codeFile = createCodeFile(language, code);
  try {
    const result = await runner(codeFile, input);
    if (result.success) {
      respond(res, { status: 200, output: result.output ?? "" });
    } else {
      // A failed run (compile/runtime/timeout) still returns HTTP 200 with the
      // error text populated; the caller derives its own status from `error`.
      respond(res, { status: 200, error: String(result.error ?? "") });
    }
  } catch (err) {
    respond(res, { status: 500, error: String(err?.message ?? err) });
  } finally {
    removeCodeFile(codeFile.split(".")[0], language);
  }
});

app.get("/status", (_req, res) => {
  res.json({ timeStamp: Date.now(), status: 200, uptime: process.uptime() });
});

app.listen(port, () => {
  console.log(`devcollab-codex-api listening on port ${port}`);
});
