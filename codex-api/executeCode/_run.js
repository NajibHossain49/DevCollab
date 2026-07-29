const { spawn } = require("child_process");

// Hard cap on how long a single spawned process may run. Kept generous enough
// to cover cold compile+run for Java/C++/Go.
const TIMEOUT_SECONDS = 10;

// Spawns a process, optionally feeds it stdin, and collects stdout/stderr.
// Resolves with stdout on a zero exit code; rejects with stderr (or a timeout
// message) otherwise. Using the exit code — rather than the mere presence of
// stderr — avoids treating compiler warnings on stderr as failures.
function runProcess(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(
        reject,
        `Error: Timed Out. Your code took too long to execute, over ${TIMEOUT_SECONDS} seconds.`,
      );
    }, TIMEOUT_SECONDS * 1000);

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }
    child.stdin.on("error", () => {});
    child.stdout.on("data", (data) => (stdout += data.toString()));
    child.stderr.on("data", (data) => (stderr += data.toString()));

    child.on("error", (err) => finish(reject, String(err.message ?? err)));
    child.on("exit", (code) => {
      if (code === 0) {
        finish(resolve, stdout);
      } else {
        finish(reject, stderr || stdout || `Process exited with code ${code}`);
      }
    });
  });
}

module.exports = { runProcess };
