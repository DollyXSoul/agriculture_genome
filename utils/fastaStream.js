const fs = require("fs");

async function readFastaRegion(filePath, opts = {}) {
  const {
    contig = null,
    start = 1,
    end = null,
    maxLen = 300000,
    takeFirstContig = true,
  } = opts;

  const rs = fs.createReadStream(filePath, {
    encoding: "utf8",
    highWaterMark: 1 << 20,
  });

  let seq = "";
  let current = null;
  let want = !contig;
  let pos = 0;
  let done = false;
  let leftover = "";

  for await (const chunk of rs) {
    if (done) break;
    const data = leftover + chunk;
    const lines = data.split(/\r?\n/);
    leftover = lines.pop() ?? "";
    for (let raw of lines) {
      if (done) break;
      const line = raw.trim();
      if (!line) continue;
      if (line[0] === ">") {
        current = line.slice(1).split(/\s/)[0];
        want = contig
          ? current === contig
          : takeFirstContig
          ? seq.length === 0
          : true;
        continue;
      }
      if (!want) continue;
      const s = line.toUpperCase().replace(/[^ACGTN\-]/g, "");
      for (let c of s) {
        pos += 1;
        if (pos < start) continue;
        if (end && pos > end) {
          done = true;
          break;
        }
        if (seq.length < maxLen) seq += c;
        else {
          done = true;
          break;
        }
      }
    }
  }
  return seq;
}

module.exports = { readFastaRegion };
