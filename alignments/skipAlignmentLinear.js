// Linear-space skip-aware global alignment with optional band.
// Costs: match=0, mismatch=1, insertion=1, deletion=1, skip over '-' in reference=0.

function skipAwareScoreLinear(ref, qry, opts = {}) {
  const m = ref.length,
    n = qry.length;
  const band = opts.band ?? null;
  const INF = 1e15;

  let Mprev = new Float64Array(n + 1).fill(INF);
  let Iprev = new Float64Array(n + 1).fill(INF);
  let Dprev = new Float64Array(n + 1).fill(INF);
  let Sprev = new Float64Array(n + 1).fill(INF);

  Mprev[0] = 0;
  Iprev[0] = 0;
  Dprev[0] = 0;
  Sprev[0] = 0;
  for (let j = 1; j <= n; j++) {
    Iprev[j] = j;
    Mprev[j] = Number.POSITIVE_INFINITY;
    Dprev[j] = Number.POSITIVE_INFINITY;
    Sprev[j] = Number.POSITIVE_INFINITY;
  }

  const zeros = () => new Float64Array(n + 1).fill(INF);

  for (let i = 1; i <= m; i++) {
    let Mcur = zeros(),
      Icur = zeros(),
      Dcur = zeros(),
      Scur = zeros();

    let jmin = 1,
      jmax = n;
    if (band !== null) {
      jmin = Math.max(1, i - band);
      jmax = Math.min(n, i + band);
    }

    if (ref[i - 1] === "-") Scur[0] = 0;
    else Dcur[0] = i;

    for (let j = jmin; j <= jmax; j++) {
      const rc = ref[i - 1],
        qc = qry[j - 1];

      if (rc !== "-") {
        const cost = rc === qc ? 0 : 1;
        Mcur[j] =
          Math.min(Mprev[j - 1], Iprev[j - 1], Dprev[j - 1], Sprev[j - 1]) +
          cost;
      }

      Dcur[j] =
        Math.min(Mcur[j - 1], Icur[j - 1], Dcur[j - 1], Scur[j - 1]) + 1;

      if (rc !== "-") {
        Icur[j] = Math.min(Mprev[j], Iprev[j], Dprev[j], Sprev[j]) + 1;
      }

      if (rc === "-") {
        Scur[j] = Math.min(Mprev[j], Iprev[j], Dprev[j], Sprev[j]);
      }
    }

    Mprev = Mcur;
    Iprev = Icur;
    Dprev = Dcur;
    Sprev = Scur;
  }

  const score = Math.min(Mprev[n], Iprev[n], Dprev[n], Sprev[n]);
  return { score };
}

// Exact small-input traceback variant to report operation counts
function skipAwareCountsSmall(ref, qry) {
  const m = ref.length,
    n = qry.length,
    INF = 1e12;
  const M = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const I = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const D = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const S = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  M[0][0] = I[0][0] = D[0][0] = S[0][0] = 0;

  for (let j = 1; j <= n; j++) I[0][j] = j;
  for (let i = 1; i <= m; i++)
    ref[i - 1] === "-" ? (S[i][0] = 0) : (D[i][0] = i);

  // fill
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const rc = ref[i - 1],
        qc = qry[j - 1];
      if (rc !== "-") {
        const c = rc === qc ? 0 : 1;
        M[i][j] =
          Math.min(
            M[i - 1][j - 1],
            I[i - 1][j - 1],
            D[i - 1][j - 1],
            S[i - 1][j - 1]
          ) + c;
      }
      D[i][j] =
        Math.min(M[i][j - 1], I[i][j - 1], D[i][j - 1], S[i][j - 1]) + 1;
      if (rc !== "-") {
        I[i][j] =
          Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]) + 1;
      }
      if (rc === "-") {
        S[i][j] = Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]); // +0
      }
    }
  }

  // traceback (choose predecessor from (i,j), then move)
  let i = m,
    j = n;
  let matches = 0,
    mismatches = 0,
    inserts = 0,
    deletes = 0,
    skips = 0;

  const argmin4 = (a, b, c, d) => {
    let best = a,
      tag = "M";
    if (b < best) {
      best = b;
      tag = "I";
    }
    if (c < best) {
      best = c;
      tag = "D";
    }
    if (d < best) {
      best = d;
      tag = "S";
    }
    return tag;
  };

  let cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);

  while (i > 0 || j > 0) {
    if (cur === "M") {
      // predecessor at (i-1, j-1)
      const rc = i > 0 ? ref[i - 1] : "-";
      const qc = j > 0 ? qry[j - 1] : "-";
      if (i === 0 || j === 0) break; // safety
      rc === qc ? matches++ : mismatches++;
      i--;
      j--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else if (cur === "D") {
      // predecessor at (i, j-1)
      if (j === 0) break; // safety
      deletes++;
      j--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else if (cur === "I") {
      // predecessor at (i-1, j)
      if (i === 0) break; // safety
      inserts++;
      i--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else {
      // 'S'
      // predecessor at (i-1, j)
      if (i === 0) break; // safety
      skips++;
      i--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    }
  }
  const penalty = mismatches + inserts + deletes;
  return { matches, mismatches, inserts, deletes, skips, penalty };
}

function skipAwareAlignSmall(ref, qry) {
  const m = ref.length,
    n = qry.length,
    INF = 1e12;
  const M = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const I = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const D = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  const S = Array.from({ length: m + 1 }, () => Array(n + 1).fill(INF));
  M[0][0] = I[0][0] = D[0][0] = S[0][0] = 0;
  for (let j = 1; j <= n; j++) I[0][j] = j;
  for (let i = 1; i <= m; i++)
    ref[i - 1] === "-" ? (S[i][0] = 0) : (D[i][0] = i);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const rc = ref[i - 1],
        qc = qry[j - 1];
      if (rc !== "-") {
        const c = rc === qc ? 0 : 1;
        M[i][j] =
          Math.min(
            M[i - 1][j - 1],
            I[i - 1][j - 1],
            D[i - 1][j - 1],
            S[i - 1][j - 1]
          ) + c;
      }
      D[i][j] =
        Math.min(M[i][j - 1], I[i][j - 1], D[i][j - 1], S[i][j - 1]) + 1;
      if (rc !== "-") {
        I[i][j] =
          Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]) + 1;
      }
      if (rc === "-") {
        S[i][j] = Math.min(M[i - 1][j], I[i - 1][j], D[i - 1][j], S[i - 1][j]);
      }
    }
  }

  // traceback with per-position ops
  let i = m,
    j = n;
  const argmin4 = (a, b, c, d) => {
    let best = a,
      tag = "M";
    if (b < best) {
      best = b;
      tag = "I";
    }
    if (c < best) {
      best = c;
      tag = "D";
    }
    if (d < best) {
      best = d;
      tag = "S";
    }
    return tag;
  };
  let cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
  let alignedRef = "",
    alignedQry = "",
    ops = "";

  while (i > 0 || j > 0) {
    if (cur === "M") {
      if (i === 0 || j === 0) break;
      const rc = ref[i - 1],
        qc = qry[j - 1];
      alignedRef = rc + alignedRef;
      alignedQry = qc + alignedQry;
      ops = (rc === qc ? "M" : "X") + ops;
      i--;
      j--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else if (cur === "D") {
      if (j === 0) break;
      alignedRef = "-" + alignedRef;
      alignedQry = qry[j - 1] + alignedQry;
      ops = "D" + ops;
      j--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else if (cur === "I") {
      if (i === 0) break;
      alignedRef = ref[i - 1] + alignedRef;
      alignedQry = "-" + alignedQry;
      ops = "I" + ops;
      i--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    } else {
      // 'S'
      if (i === 0) break;
      alignedRef = ref[i - 1] + alignedRef; // this is a '-' in ref
      alignedQry = "-" + alignedQry;
      ops = "S" + ops;
      i--;
      cur = argmin4(M[i][j], I[i][j], D[i][j], S[i][j]);
    }
  }

  const score = Math.min(M[m][n], I[m][n], D[m][n], S[m][n]);
  return { alignedRef, alignedQry, ops, score };
}
module.exports = {
  skipAwareScoreLinear,
  skipAwareCountsSmall,
  skipAwareAlignSmall,
};
