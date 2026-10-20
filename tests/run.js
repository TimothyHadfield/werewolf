// Tiny test runner: node tests/run.js  (runs every tests/*.test.js)
const fs = require("fs");
const path = require("path");
let pass = 0, failN = 0;
global.test = function (name, fn) {
  try { fn(); pass++; }
  catch (e) { failN++; console.log("FAIL " + name + "\n  " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join("\n  ") : e)); }
};
fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort().forEach((f) => {
  const before = pass + failN;
  require(path.join(__dirname, f));
  console.log(f + ": " + (pass + failN - before) + " tests");
});
// ES-module tests (the real online.js) run as their own node process.
fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.mjs")).sort().forEach((f) => {
  try { process.stdout.write(require("child_process").execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" })); pass++; }
  catch (e) { failN++; console.log("FAIL " + f + "\n  " + String(e.stdout || "") + String(e.stderr || "").split("\n").slice(0, 6).join("\n  ")); }
});
console.log(pass + " passed, " + failN + " failed");
process.exit(failN ? 1 : 0);
