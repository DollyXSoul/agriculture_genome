/**
 * Skip-Aware Global Alignment Implementation
 * Based on the research paper: Dynamic Programming Alignments With Skips
 */

/**
 * Skip-Aware Global Alignment Implementation
 * Based on the research paper: Dynamic Programming Alignments With Skips
 */

function skipAwareAlignment(reference, query) {
  const m = reference.length;
  const n = query.length;
  const INF = Number.MAX_SAFE_INTEGER;

  // Initialize DP matrices: M=match/mismatch, I=insertion, D=deletion, S=skip
  const M = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(INF));
  const I = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(INF));
  const D = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(INF));
  const S = Array(m + 1)
    .fill()
    .map(() => Array(n + 1).fill(INF));

  // Base cases
  M[0][0] = I[0][0] = D[0][0] = S[0][0] = 0;

  // Initialize first row (insertions in query)
  for (let j = 1; j <= n; j++) {
    I[0][j] = j; // Cost of inserting j characters
    M[0][j] = D[0][j] = S[0][j] = INF;
  }

  // Initialize first column (deletions/skips in reference)
  for (let i = 1; i <= m; i++) {
    if (reference[i - 1] === "-") {
      S[i][0] = 0; // Skip over existing gaps is free
      M[i][0] = I[i][0] = D[i][0] = INF;
    } else {
      D[i][0] = i; // Cost of deleting i characters
      M[i][0] = I[i][0] = S[i][0] = INF;
    }
  }

  // Fill DP matrices
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const refChar = reference[i - 1];
      const queryChar = query[j - 1];

      // Match/Mismatch matrix
      if (refChar !== "-") {
        const cost = refChar === queryChar ? 0 : 1;
        M[i][j] =
          Math.min(
            M[i - 1][j - 1],
            I[i - 1][j - 1],
            D[i - 1][j - 1],
            S[i - 1][j - 1]
          ) + cost;
      }

      // Deletion matrix (delete from query)
      D[i][j] =
        Math.min(M[i][j - 1], I[i][j - 1], D[i][j - 1], S[i][j - 1]) + 1;

      // Insertion matrix (insert from reference)
      if (refChar !== "-") {
        I[i][j] =
          Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]) + 1;
      }

      // Skip matrix (skip over gaps in reference)
      if (refChar === "-") {
        S[i][j] = Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]); // Free skip
      }
    }
  }

  // Find optimal score
  const finalScore = Math.min(M[m][n], I[m][n], D[m][n], S[m][n]);

  // Simple traceback to generate alignment and transcript
  const alignment = generateAlignment(reference, query, M, I, D, S);
  const transcript = generateTranscript(alignment);

  // Count operations from transcript
  const operationCounts = countOperations(transcript);

  return {
    score: finalScore,
    alignment: alignment,
    transcript: transcript,
    operations: operationCounts,
    matrices: {
      M: M[m][n] !== INF ? M[m][n] : "INF",
      I: I[m][n] !== INF ? I[m][n] : "INF",
      D: D[m][n] !== INF ? D[m][n] : "INF",
      S: S[m][n] !== INF ? S[m][n] : "INF",
    },
  };
}

function generateAlignment(reference, query, M, I, D, S) {
  // Simplified alignment generation
  const m = reference.length;
  const n = query.length;

  let alignedRef = "";
  let alignedQuery = "";
  let i = m,
    j = n;

  // Find which matrix has the optimal score
  const finalScore = Math.min(M[m][n], I[m][n], D[m][n], S[m][n]);
  let currentMatrix = "M";

  if (finalScore === I[m][n]) currentMatrix = "I";
  else if (finalScore === D[m][n]) currentMatrix = "D";
  else if (finalScore === S[m][n]) currentMatrix = "S";

  // Simple traceback (basic implementation)
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      alignedRef = reference[i - 1] + alignedRef;
      alignedQuery = query[j - 1] + alignedQuery;
      i--;
      j--;
    } else if (i > 0) {
      alignedRef = reference[i - 1] + alignedRef;
      alignedQuery = "-" + alignedQuery;
      i--;
    } else {
      alignedRef = "-" + alignedRef;
      alignedQuery = query[j - 1] + alignedQuery;
      j--;
    }
  }

  return { alignedRef, alignedQuery };
}

function generateTranscript(alignment) {
  const { alignedRef, alignedQuery } = alignment;
  let transcript = "";

  for (let i = 0; i < alignedRef.length; i++) {
    const refChar = alignedRef[i];
    const queryChar = alignedQuery[i];

    if (refChar === "-" && queryChar !== "-") {
      transcript += "I"; // Insertion
    } else if (refChar !== "-" && queryChar === "-") {
      transcript += "D"; // Deletion
    } else if (refChar === "-" && queryChar === "-") {
      transcript += "S"; // Skip (though this case shouldn't occur in practice)
    } else if (refChar === queryChar) {
      transcript += "M"; // Match
    } else {
      // Check if this is a skip over existing gap
      if (refChar === "-") {
        transcript += "S"; // Skip
      } else {
        transcript += "X"; // Mismatch
      }
    }
  }

  return transcript;
}

// NEW FUNCTION: Count operations from transcript
function countOperations(transcript) {
  const counts = {
    matches: 0,
    mismatches: 0,
    insertions: 0,
    deletions: 0,
    skips: 0,
  };

  for (let i = 0; i < transcript.length; i++) {
    switch (transcript[i]) {
      case "M":
        counts.matches++;
        break;
      case "X":
        counts.mismatches++;
        break;
      case "I":
        counts.insertions++;
        break;
      case "D":
        counts.deletions++;
        break;
      case "S":
        counts.skips++;
        break;
    }
  }

  // Calculate total operations and penalty
  counts.total =
    counts.matches +
    counts.mismatches +
    counts.insertions +
    counts.deletions +
    counts.skips;
  counts.penalty = counts.mismatches + counts.insertions + counts.deletions; // skips and matches are free

  return counts;
}

module.exports = { skipAwareAlignment };
