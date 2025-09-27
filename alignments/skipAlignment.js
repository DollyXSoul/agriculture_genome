/**
 * Skip-Aware Global Alignment Implementation
 * Based on the research paper: Dynamic Programming Alignments With Skips
 */

function skipAwareAlignment(reference, query) {
  const m = reference.length;
  const n = query.length;
  const INF = Number.MAX_SAFE_INTEGER;

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

  M[0][0] = I[0][0] = D[0][0] = S[0][0] = 0;

  for (let j = 1; j <= n; j++) {
    I[0][j] = j;
    M[0][j] = D[0][j] = S[0][j] = INF;
  }

  for (let i = 1; i <= m; i++) {
    if (reference[i - 1] === "-") {
      S[i][0] = 0;
      M[i][0] = I[i][0] = D[i][0] = INF;
    } else {
      D[i][0] = i;
      M[i][0] = I[i][0] = S[i][0] = INF;
    }
  }

  // Counters for penalty types
  let matchCount = 0,
    mismatchCount = 0,
    insertionCount = 0,
    deletionCount = 0,
    skipCount = 0;

  // Fill matrices and keep track of penalties
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const refChar = reference[i - 1];
      const queryChar = query[j - 1];

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

      D[i][j] =
        Math.min(M[i][j - 1], I[i][j - 1], D[i][j - 1], S[i][j - 1]) + 1;

      if (refChar !== "-") {
        I[i][j] =
          Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]) + 1;
      }

      if (refChar === "-") {
        S[i][j] = Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]);
      }
    }
  }

  // Find final score and which matrix it came from
  const finalScore = Math.min(M[m][n], I[m][n], D[m][n], S[m][n]);

  // Traceback to identify penalty types
  let aligned = generateAlignment(reference, query, M, I, D, S);
  let transcript = generateTranscript(aligned);

  // Calculate penalty counts from transcript
  for (const t of transcript) {
    if (t === "M") matchCount++;
    else if (t === "X") mismatchCount++;
    else if (t === "I") insertionCount++;
    else if (t === "D") deletionCount++;
    else if (t === "S") skipCount++;
  }

  return {
    score: finalScore,
    alignment: aligned,
    transcript: transcript,
    penalties: {
      match: matchCount,
      mismatch: mismatchCount,
      insertion: insertionCount,
      deletion: deletionCount,
      skip: skipCount,
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

module.exports = { skipAwareAlignment };
