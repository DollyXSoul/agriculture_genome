const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");

const { readFastaRegion } = require("./utils/fastaStream");
const {
  skipAwareScoreLinear,
  skipAwareCountsSmall,
  skipAwareAlignSmall,
} = require("./alignments/skipAlignmentLinear");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const d = path.join(__dirname, "uploads");
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    cb(null, d);
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage });

// Home
app.get("/", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

function buildDpView(reference, query, matrices, cap = 20) {
  if (!matrices) return null;
  const m = reference.length;
  const n = query.length;
  const rows = Math.min(m + 1, cap);
  const cols = Math.min(n + 1, cap);

  const sliceMatrix = (mat) => {
    const out = [];
    for (let i = 0; i < rows; i++) {
      out.push(mat[i].slice(0, cols));
    }
    return out;
  };

  return {
    rows,
    cols,
    refPrefix: reference.slice(0, rows - 1),
    qryPrefix: query.slice(0, cols - 1),
    M: sliceMatrix(matrices.M),
    I: sliceMatrix(matrices.I),
    D: sliceMatrix(matrices.D),
    S: sliceMatrix(matrices.S),
    infValue: 1e12,
  };
}

// ALIGN TEXT (short inputs; returns score + counts)
app.post("/api/align-text", (req, res) => {
  try {
    const reference = (req.body.reference || "").toUpperCase();
    const query = (req.body.query || "").toUpperCase();
    const wantCounts = req.body.wantCounts === "true";
    const wantTranscript = req.body.wantTranscript === "true";
    const wantDpView = req.body.wantDpView === "true"; // NEW
    const bandVal = req.body.band ? Number(req.body.band) : null;

    if (!reference || !query) {
      return res
        .status(400)
        .json({ error: "reference and query are required" });
    }

    const t0 = Date.now();
    let perPos = null;
    let dpView = null;
    let score;

    if (wantTranscript) {
      const smallRes = skipAwareAlignSmall(reference, query, {
        withMatrices: wantDpView,
      });
      perPos = {
        alignedRef: smallRes.alignedRef,
        alignedQry: smallRes.alignedQry,
        ops: smallRes.ops,
      };
      score = smallRes.score;
      if (wantDpView && smallRes.matrices) {
        dpView = buildDpView(reference, query, smallRes.matrices);
      }
    } else {
      const resScore = skipAwareScoreLinear(reference, query, {
        band: bandVal,
      });
      score = resScore.score;
    }

    let ops = null;
    if (wantCounts && reference.length <= 50000 && query.length <= 50000) {
      ops = skipAwareCountsSmall(reference, query);
    }
    const dt = Date.now() - t0;

    return res.json({
      success: true,
      data: {
        alignmentScore: score,
        perPosition: perPos,
        operations: ops,
        dpView,
        seqLengths: { ref: reference.length, qry: query.length },
        runtimeMs: dt,
        note: perPos
          ? "Per-position transcript generated with exact DP"
          : "Transcript disabled (use checkbox) or large input",
      },
    });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json({ error: "alignment failed", details: e.message });
  }
});

// ALIGN FILES (streams .fna and caps regions; returns score, counts optional)
app.post(
  "/api/align-files",
  upload.fields([
    { name: "referenceFile", maxCount: 1 },
    { name: "queryFile", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (!req.files?.referenceFile || !req.files?.queryFile) {
        return res
          .status(400)
          .json({ error: "referenceFile and queryFile are required" });
      }

      const {
        contigRef,
        contigQry,
        startRef,
        endRef,
        startQry,
        endQry,
        maxLen,
      } = req.body;

      const maxBps = maxLen ? Number(maxLen) : 300000;

      const refPath = req.files.referenceFile[0].path;
      const qryPath = req.files.queryFile[0].path;

      const refSeq = await readFastaRegion(refPath, {
        contig: contigRef || null,
        start: startRef ? Number(startRef) : 1,
        end: endRef ? Number(endRef) : null,
        maxLen: maxBps,
        takeFirstContig: !contigRef,
      });

      const qrySeq = await readFastaRegion(qryPath, {
        contig: contigQry || null,
        start: startQry ? Number(startQry) : 1,
        end: endQry ? Number(endQry) : null,
        maxLen: maxBps,
        takeFirstContig: !contigQry,
      });

      console.log("Lengths:", refSeq.length, qrySeq.length);

      // clean temp uploads
      try {
        fs.unlinkSync(refPath);
        fs.unlinkSync(qryPath);
      } catch {}

      if (!refSeq || !qrySeq) {
        return res
          .status(400)
          .json({ error: "no sequence data found in one or both files" });
      }

      const wantCounts = req.body.wantCounts === "true";
      const wantTranscript = req.body.wantTranscript === "true";
      const wantDpView = req.body.wantDpView === "true"; // NEW
      console.log("FILE wantDpView =", req.body.wantDpView);
      const bandWidth = req.body.band ? Number(req.body.band) : null;

      const small = refSeq.length <= 50000 && qrySeq.length <= 50000;

      let perPos = null;
      let dpView = null;
      let score;

      const t0 = Date.now();

      if (wantTranscript && small) {
        // ask small-DP function to also give matrices when we want the DP view
        const smallRes = skipAwareAlignSmall(refSeq, qrySeq, {
          withMatrices: wantDpView,
        });

        perPos = {
          alignedRef: smallRes.alignedRef,
          alignedQry: smallRes.alignedQry,
          ops: smallRes.ops,
        };
        score = smallRes.score;

        if (wantDpView && smallRes.matrices) {
          dpView = buildDpView(refSeq, qrySeq, smallRes.matrices);
        }
      } else {
        // large inputs or transcript disabled → linear-space score only
        const resScore = skipAwareScoreLinear(refSeq, qrySeq, {
          band: bandWidth,
        });
        score = resScore.score;
      }

      let ops = null;
      if (wantCounts && small) {
        ops = skipAwareCountsSmall(refSeq, qrySeq);
      }

      const dt = Date.now() - t0;

      return res.json({
        success: true,
        data: {
          alignmentScore: score,
          perPosition: perPos, // null if large or transcript off
          operations: ops,
          dpView, // NEW: DP snapshot for small inputs
          seqLengths: { ref: refSeq.length, qry: qrySeq.length },
          params: { band: bandWidth },
          runtimeMs: dt,
          note: perPos
            ? "Per-position transcript generated (small inputs)"
            : "Transcript omitted to keep memory linear on large inputs",
        },
      });
    } catch (e) {
      console.error(e);
      return res
        .status(500)
        .json({ error: "file alignment failed", details: e.message });
    }
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT}`);
});
