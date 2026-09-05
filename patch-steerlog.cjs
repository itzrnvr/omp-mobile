const fs = require("fs");
const p = "D:/omp-mobile/server/src/index.ts";
let t = fs.readFileSync(p, "utf8");
const old = "  const ownerWs = extOwnerWs(cmd.sessionId);\n  if (ownerWs) {\n    sendWs(ownerWs, { type: 'ext_steer', content: cmd.content });";
const neu =
  "  const ownerWs = extOwnerWs(cmd.sessionId);\n" +
  "  console.log('[steer] send for ' + (cmd.sessionId || '').slice(0, 8) + ' owner=' + (ownerWs ? 'yes' : 'no'));\n" +
  "  if (ownerWs) {\n" +
  "    sendWs(ownerWs, { type: 'ext_steer', content: cmd.content });\n" +
  "    console.log('[steer] forwarded to ext ws');";
if (!t.includes(old)) {
  console.log("ANCHOR MISS");
  process.exit(1);
}
t = t.replace(old, neu);
fs.writeFileSync(p, t);
console.log("forward log added ok");
