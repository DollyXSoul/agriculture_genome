// Linear-space skip-aware global alignment with optional band.
// Costs: match=0, mismatch=1, insertion=1, deletion=1, skip over '-' in reference=0.

function createMatrix(rows, cols, fill = Infinity) {
  const m = new Array(rows);
  for (let i = 0; i < rows; i++) {
    m[i] = new Array(cols).fill(fill);
  }
  return m;
}

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

function skipAwareAlignSmall(ref, qry, options = {}) {
  const withMatrices = !!options.withMatrices;
  const m = ref.length;
  const n = qry.length;
  const INF = 1e12;

  const M = createMatrix(m + 1, n + 1, INF);
  const I = createMatrix(m + 1, n + 1, INF);
  const D = createMatrix(m + 1, n + 1, INF);
  const S = createMatrix(m + 1, n + 1, INF);
  const back = createMatrix(m + 1, n + 1, null); // store prev state + move

  // init
  M[0][0] = I[0][0] = D[0][0] = S[0][0] = 0;

  for (let j = 1; j <= n; j++) {
    // insertion in query (gap in ref)
    I[0][j] = j;
    back[0][j] = { state: "I", pi: 0, pj: j - 1 };
  }
  for (let i = 1; i <= m; i++) {
    if (ref[i - 1] === "-") {
      // free skip downwards
      S[i][0] = 0;
      back[i][0] = { state: "S", pi: i - 1, pj: 0 };
    } else {
      D[i][0] = i;
      back[i][0] = { state: "D", pi: i - 1, pj: 0 };
    }
  }

  // DP fill
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const rc = ref[i - 1];
      const qc = qry[j - 1];

      // S state: only if ref has '-'
      if (rc === "-") {
        // can come from any state above, same j, cost 0
        let best = S[i - 1][j];
        let prev = { state: "S", pi: i - 1, pj: j };

        if (M[i - 1][j] < best) {
          best = M[i - 1][j];
          prev = { state: "M", pi: i - 1, pj: j };
        }
        if (I[i - 1][j] < best) {
          best = I[i - 1][j];
          prev = { state: "I", pi: i - 1, pj: j };
        }
        if (D[i - 1][j] < best) {
          best = D[i - 1][j];
          prev = { state: "D", pi: i - 1, pj: j };
        }

        S[i][j] = best;
        back[i][j] = { state: "S", pi: prev.pi, pj: prev.pj };
        M[i][j] = I[i][j] = D[i][j] = INF;
        continue;
      }

      // otherwise: no skip at this cell
      const matchCost = rc === qc ? 0 : 1;

      // M: diagonal from any state
      {
        let best = M[i - 1][j - 1];
        let prev = { state: "M", pi: i - 1, pj: j - 1 };
        if (I[i - 1][j - 1] < best) {
          best = I[i - 1][j - 1];
          prev = { state: "I", pi: i - 1, pj: j - 1 };
        }
        if (D[i - 1][j - 1] < best) {
          best = D[i - 1][j - 1];
          prev = { state: "D", pi: i - 1, pj: j - 1 };
        }
        if (S[i - 1][j - 1] < best) {
          best = S[i - 1][j - 1];
          prev = { state: "S", pi: i - 1, pj: j - 1 };
        }

        M[i][j] = best + matchCost;
      }

      // I: insertion in ref (move left in matrix)
      {
        let best = M[i][j - 1];
        let prev = { state: "M", pi: i, pj: j - 1 };
        if (I[i][j - 1] < best) {
          best = I[i][j - 1];
          prev = { state: "I", pi: i, pj: j - 1 };
        }
        if (D[i][j - 1] < best) {
          best = D[i][j - 1];
          prev = { state: "D", pi: i, pj: j - 1 };
        }
        if (S[i][j - 1] < best) {
          best = S[i][j - 1];
          prev = { state: "S", pi: i, pj: j - 1 };
        }

        I[i][j] = best + 1;
      }

      // D: deletion in ref (move up in matrix)
      {
        let best = M[i - 1][j];
        let prev = { state: "M", pi: i - 1, pj: j };
        if (I[i - 1][j] < best) {
          best = I[i - 1][j];
          prev = { state: "I", pi: i - 1, pj: j };
        }
        if (D[i - 1][j] < best) {
          best = D[i - 1][j];
          prev = { state: "D", pi: i - 1, pj: j };
        }
        if (S[i - 1][j] < best) {
          best = S[i - 1][j];
          prev = { state: "S", pi: i - 1, pj: j };
        }

        D[i][j] = best + 1;
      }

      // choose best state at (i,j) just for traceback pointer
      let best = M[i][j],
        st = "M";
      if (I[i][j] < best) {
        best = I[i][j];
        st = "I";
      }
      if (D[i][j] < best) {
        best = D[i][j];
        st = "D";
      }
      // S[i][j] is INF here because rc !== '-'
      back[i][j] = {
        state: st,
        pi: st === "I" ? i : st === "D" ? i - 1 : i - 1,
        pj: st === "I" ? j - 1 : st === "D" ? j : j - 1,
      };
    }
  }

  // choose final state at (m,n)
  let score = M[m][n],
    state = "M";
  if (I[m][n] < score) {
    score = I[m][n];
    state = "I";
  }
  if (D[m][n] < score) {
    score = D[m][n];
    state = "D";
  }
  if (S[m][n] < score) {
    score = S[m][n];
    state = "S";
  }

  // traceback
  let i = m,
    j = n;
  const aRef = [];
  const aQry = [];
  const ops = [];

  while (i > 0 || j > 0) {
    const cell = back[i][j];
    if (!cell) break;

    const { state: st, pi, pj } = cell;

    if (st === "S") {
      // skip over ref[i-1] == '-'
      aRef.push(ref[i - 1]);
      aQry.push("-");
      ops.push("S");
    } else if (st === "M") {
      aRef.push(ref[i - 1]);
      aQry.push(qry[j - 1]);
      ops.push(ref[i - 1] === qry[j - 1] ? "M" : "X");
    } else if (st === "I") {
      aRef.push("-");
      aQry.push(qry[j - 1]);
      ops.push("I");
    } else if (st === "D") {
      aRef.push(ref[i - 1]);
      aQry.push("-");
      ops.push("D");
    }

    i = pi;
    j = pj;
  }

  aRef.reverse();
  aQry.reverse();
  ops.reverse();

  const result = {
    alignedRef: aRef.join(""),
    alignedQry: aQry.join(""),
    ops: ops.join(""),
    score,
  };

  if (withMatrices) {
    result.matrices = { M, I, D, S };
  }

  return result;
}
module.exports = {
  skipAwareScoreLinear,
  skipAwareCountsSmall,
  skipAwareAlignSmall,
};
