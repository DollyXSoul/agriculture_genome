// Add this to the top of your script.js or inside a DOMContentLoaded listener

document.addEventListener("DOMContentLoaded", () => {
  const tabsContainer = document.querySelector(".tabs");

  if (tabsContainer) {
    tabsContainer.addEventListener("click", (e) => {
      // Check if a tab button was clicked
      const clickedButton = e.target.closest(".tab-button");
      if (!clickedButton) {
        return; // Exit if the click was not on a button
      }

      // Get the ID of the target panel from the button's data-target attribute
      const targetPanelId = clickedButton.dataset.target;
      if (!targetPanelId) {
        return;
      }

      // Deactivate all tab buttons and panels
      tabsContainer.querySelectorAll(".tab-button").forEach((btn) => {
        btn.classList.remove("active");
        btn.setAttribute("aria-selected", "false");
      });
      document.querySelectorAll(".tab-content").forEach((panel) => {
        panel.classList.remove("active");
      });

      // Activate the clicked button
      clickedButton.classList.add("active");
      clickedButton.setAttribute("aria-selected", "true");

      // Activate the corresponding panel
      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }
    });
  }

  async function perform(endpoint, data, isFile = false) {
    const loading = document.getElementById("loading"); // [MDN: getElementById]
    const results = document.getElementById("results"); // [MDN: getElementById]
    const content = document.getElementById("results-content"); // [MDN: getElementById]
    const perBox = document.getElementById("perpos"); // [MDN: getElementById]
    const perDiv = document.getElementById("perpos-content"); // [MDN: getElementById]

    loading.style.display = "block"; // [MDN: getElementById]
    results.style.display = "none"; // [MDN: getElementById]
    if (perBox) perBox.style.display = "none"; // [MDN: getElementById]
    if (perDiv) perDiv.innerHTML = ""; // [MDN: getElementById]

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: isFile ? undefined : { "Content-Type": "application/json" },
      body: isFile ? data : JSON.stringify(data),
    }); // [MDN: getElementById]
    const out = await resp.json(); // [MDN: getElementById]
    if (!out.success) throw new Error(out.error || "alignment failed"); // [MDN: getElementById]

    const d = out.data; // [MDN: getElementById]
    let html = `
    <div class="result-item"><div class="result-label">Alignment Score</div><div class="big">${
      d.alignmentScore
    }</div></div>
    <div class="result-item"><div class="result-label">Lengths</div><div>ref=${
      d.seqLengths?.ref ?? "—"
    }, qry=${d.seqLengths?.qry ?? "—"}</div></div>
    <div class="result-item"><div class="result-label">Runtime (ms)</div><div>${
      d.runtimeMs
    }</div></div>
    <div class="result-item"><div class="result-label">Note</div><div>${
      d.note
    }</div></div>
  `;

    // Operation counts (small inputs with wantCounts=true)
    if (d.operations) {
      html += `
      <div class="result-item">
        <div class="result-label">Operation Counts</div>
        <div class="matrix-values">
          <div class="matrix-item">Matches: ${d.operations.matches}</div>
          <div class="matrix-item">Mismatches: ${d.operations.mismatches}</div>
          <div class="matrix-item">Insertions: ${d.operations.inserts}</div>
          <div class="matrix-item">Deletions: ${d.operations.deletes}</div>
          <div class="matrix-item">Skips: ${d.operations.skips}</div>
          <div class="matrix-item">Penalty: ${d.operations.penalty}</div>
        </div>
      </div>
    `;
    }

    content.innerHTML = html;

    // Per-position: render if present
    const per = d.perPosition; // [MDN: getElementById]
    if (
      per &&
      per.alignedRef &&
      per.alignedQry &&
      per.ops &&
      perBox &&
      perDiv
    ) {
      perBox.style.display = "block"; // [MDN: getElementById]
      perDiv.innerHTML = renderPerPos(
        per.alignedRef,
        per.alignedQry,
        per.ops,
        80
      ); // [MDN: getElementById]
      console.log("Per-position track rendered:", per); // [MDN: getElementById]
    } else {
      console.log(
        "Per-position track not rendered (missing data or elements)."
      ); // [MDN: getElementById]
    }

    results.style.display = "block"; // [MDN: getElementById]
    loading.style.display = "none"; // [MDN: getElementById]
  }

  // Text form
  document.getElementById("text-align-form").onsubmit = async (e) => {
    e.preventDefault();
    const data = {
      reference: document.getElementById("reference").value,
      query: document.getElementById("query").value,
      band: document.getElementById("textBand").value,
      wantCounts: document.getElementById("textCounts").checked
        ? "true"
        : "false",
      wantTranscript: document.getElementById("textTranscript").checked
        ? "true"
        : "false",
    };
    await perform("/api/align-text", data, false);
  };

  // File form
  document.getElementById("file-align-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    fd.set("maxLen", document.getElementById("maxLen").value || "300000");
    fd.set("band", document.getElementById("band").value || "");
    fd.set(
      "wantCounts",
      document.getElementById("wantCounts").checked ? "true" : "false"
    );
    fd.set(
      "wantTranscript",
      document.getElementById("wantTranscript").checked ? "true" : "false"
    );
    await perform("/api/align-files", fd, true);
  };

  // Rendering helpers
  function renderPerPos(alnRef, alnQry, ops, wrap = 60) {
    const rows = [];
    for (let off = 0; off < ops.length; off += wrap) {
      const r = alnRef.slice(off, off + wrap);
      const o = ops.slice(off, off + wrap);
      const q = alnQry.slice(off, off + wrap);
      rows.push(`
      <div class="mono-row">${paintRow(r, o)}</div>
      <div class="mono-row">${paintOps(o)}</div>
      <div class="mono-row">${paintRow(q, o)}</div>
      <div style="height:6px"></div>
    `);
    }
    return rows.join("");
  }

  function paintRow(seq, ops) {
    let out = "";
    for (let i = 0; i < seq.length; i++) {
      const c = seq[i],
        op = ops[i];
      out += `<span class="op op-${op}">${escapeHtml(c)}</span>`;
    }
    return out;
  }

  function paintOps(ops) {
    let out = "";
    for (let i = 0; i < ops.length; i++) {
      const c = ops[i];
      out += `<span class="op op-${c}">${c}</span>`;
    }
    return out;
  }

  function escapeHtml(s) {
    return s.replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[m])
    );
  }
});
