const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const { skipAwareAlignment } = require("./alignments/skipAlignment");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".fasta", ".fa", ".txt", ".seq"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only FASTA files are allowed!"));
    }
  },
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API: Align two sequences directly
app.post("/api/align-text", (req, res) => {
  try {
    const { reference, query, traitInfo } = req.body;

    if (!reference || !query) {
      return res.status(400).json({
        error: "Both reference and query sequences are required",
      });
    }

    console.log("Aligning sequences:", { reference, query });

    const result = skipAwareAlignment(
      reference.toUpperCase(),
      query.toUpperCase()
    );

    res.json({
      success: true,
      data: {
        reference: reference.toUpperCase(),
        query: query.toUpperCase(),
        alignmentScore: result.score,
        alignmentResult: result.alignment,
        editTranscript: result.transcript,
        traitInfo: traitInfo || "No trait information provided",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Alignment error:", error);
    res.status(500).json({
      error: "Internal server error during alignment",
      details: error.message,
    });
  }
});

// API: Upload and align FASTA files
app.post(
  "/api/align-files",
  upload.fields([
    { name: "referenceFile", maxCount: 1 },
    { name: "queryFile", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const { traitInfo } = req.body;

      if (!req.files.referenceFile || !req.files.queryFile) {
        return res.status(400).json({
          error: "Both reference and query files are required",
        });
      }

      // Read FASTA files
      const refContent = fs.readFileSync(
        req.files.referenceFile[0].path,
        "utf8"
      );
      const queryContent = fs.readFileSync(req.files.queryFile[0].path, "utf8");

      // Parse FASTA (simple parser)
      const refSequence = parseFASTA(refContent);
      const querySequence = parseFASTA(queryContent);

      if (!refSequence || !querySequence) {
        return res.status(400).json({
          error: "Invalid FASTA format",
        });
      }

      const result = skipAwareAlignment(refSequence, querySequence);

      // Clean up uploaded files
      fs.unlinkSync(req.files.referenceFile[0].path);
      fs.unlinkSync(req.files.queryFile[0].path);

      res.json({
        success: true,
        data: {
          reference: refSequence.substring(0, 100) + "...", // Show first 100 chars
          query: querySequence.substring(0, 100) + "...",
          alignmentScore: result.score,
          alignmentResult: result.alignment,
          editTranscript: result.transcript,
          traitInfo: traitInfo || "No trait information provided",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("File alignment error:", error);
      res.status(500).json({
        error: "Internal server error during file alignment",
        details: error.message,
      });
    }
  }
);

// API: Get example sequences
app.get("/api/examples", (req, res) => {
  res.json({
    examples: [
      {
        name: "Rice Drought Tolerance",
        reference: "ATGCG-TAACGTCGAT",
        query: "ATGCGTAACGTCGAT",
        trait: "Drought tolerance - OsDREB gene region",
      },
      {
        name: "Wheat Disease Resistance",
        reference: "CCGTA-AATGCCTAG",
        query: "CCGTAAAATGCCTAG",
        trait: "Powdery mildew resistance - Pm3 gene",
      },
      {
        name: "Corn Yield Enhancement",
        reference: "GGAAT-TCGCAATG",
        query: "GGAATTTCGCAATG",
        trait: "Kernel development - ZmKRN4 gene",
      },
    ],
  });
});

// Simple FASTA parser
function parseFASTA(content) {
  const lines = content.split("\n");
  let sequence = "";

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith(">")) {
      continue; // Skip header lines
    }
    sequence += line.toUpperCase();
  }

  return sequence || null;
}

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ error: error.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(
    `🚀 Agricultural Genomics Tool running on http://localhost:${PORT}`
  );
  console.log(`📊 Upload endpoint: http://localhost:${PORT}/api/align-files`);
  console.log(`🧬 Text alignment: http://localhost:${PORT}/api/align-text`);
});
