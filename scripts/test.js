const assert = require("assert");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const cli = path.join(root, "dist", "cli.js");

function runCli(configPath) {
  execFileSync(process.execPath, [cli, "-p", configPath], {
    stdio: "inherit"
  });
}

runCli(path.join(root, "tests", "ts", "tsconfig.json"));
runCli(path.join(root, "tests", "tsx", "tsconfig.json"));

const tsMod = require(path.join(root, "tests", "out", "ts", "index.js"));
assert.deepStrictEqual(tsMod.calls, ["A", "B", "B", "A", "A", "B"]);
assert.strictEqual(tsMod.earlyResult, 3);
assert.strictEqual(tsMod.arrowResult, 6);
assert.strictEqual(tsMod.overloadedEarly, 6);
assert.strictEqual(tsMod.overloadedString, "ok!");
assert.strictEqual(tsMod.defaultResult, 17);
assert.strictEqual(typeof tsMod.default, "function");
assert.strictEqual(tsMod.email, "a@b.com");

const tsxMod = require(path.join(root, "tests", "out", "tsx", "index.js"));
assert.deepStrictEqual(tsxMod.calls, ["D", "D"]);
assert.strictEqual(tsxMod.earlyResult, "hi:X");
assert.strictEqual(tsxMod.rendered, "hi:Y");
assert.strictEqual(tsxMod.tag, "div");
assert.strictEqual(tsxMod.jsxAt.children.join(""), "@decorator");

console.log("All tests passed.");
