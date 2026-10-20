// Sets the build id shown in the app and the ?v= cache-buster on every script/style.
// Run before each commit that ships: node tools/stamp.js
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const d = new Date();
const id = d.toISOString().slice(0, 10) + "." + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0");
fs.writeFileSync(path.join(root, "js", "build.js"), "window.WW_BUILD = \"build " + id + "\";\n");
const f = path.join(root, "index.html");
fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/\?v=[^"]+/g, "?v=" + id));
console.log("build " + id);
