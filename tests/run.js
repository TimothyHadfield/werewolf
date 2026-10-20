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
console.log(pass + " passed, " + failN + " failed");
process.exit(failN ? 1 : 0);
