// Tab functionality
function showTab(tabName) {
  // Hide all tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Remove active class from all buttons
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.remove("active");
  });

  // Show selected tab and mark button as active
  document.getElementById(tabName).classList.add("active");
  event.target.classList.add("active");

  // Load examples if examples tab is selected
  if (tabName === "examples") {
    loadExamples();
  }
}

// Load examples from server
async function loadExamples() {
  try {
    const response = await fetch("/api/examples");
    const data = await response.json();

    const container = document.getElementById("examples-container");
    container.innerHTML = "";

    data.examples.forEach((example) => {
      const exampleDiv = document.createElement("div");
      exampleDiv.className = "example-item";
      exampleDiv.innerHTML = `
                <div class="example-name">${example.name}</div>
                <div class="example-sequences">
                    <div><strong>Reference:</strong> ${example.reference}</div>
                    <div><strong>Query:</strong> ${example.query}</div>
                </div>
                <div class="example-trait">${example.trait}</div>
            `;

      exampleDiv.onclick = () => {
        document.getElementById("reference").value = example.reference;
        document.getElementById("query").value = example.query;
        document.getElementById("trait-info").value = example.trait;
        showTab("text-input");
      };

      container.appendChild(exampleDiv);
    });
  } catch (error) {
    console.error("Error loading examples:", error);
    document.getElementById("examples-container").innerHTML =
      "<p>Error loading examples. Please try again later.</p>";
  }
}

// Handle text alignment form
document.getElementById("text-align-form").onsubmit = async function (e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    reference: formData.get("reference"),
    query: formData.get("query"),
    traitInfo: formData.get("traitInfo"),
  };

  await performAlignment("/api/align-text", data);
};

// Handle file upload form
document.getElementById("file-align-form").onsubmit = async function (e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  await performAlignment("/api/align-files", formData, true);
};

// Perform alignment request
async function performAlignment(endpoint, data, isFile = false) {
  const loading = document.getElementById("loading");
  const results = document.getElementById("results");

  // Show loading, hide results
  loading.style.display = "block";
  results.style.display = "none";

  try {
    const options = {
      method: "POST",
    };

    if (isFile) {
      options.body = data;
    } else {
      options.headers = {
        "Content-Type": "application/json",
      };
      options.body = JSON.stringify(data);
    }

    const response = await fetch(endpoint, options);
    const result = await response.json();

    if (result.success) {
      displayResults(result.data);
    } else {
      throw new Error(result.error || "Unknown error occurred");
    }
  } catch (error) {
    console.error("Alignment error:", error);
    displayError(error.message);
  } finally {
    loading.style.display = "none";
  }
}

// Display alignment results
// ... (previous code remains the same until displayResults function)

// Display alignment results (UPDATED)
function displayResults(data) {
  const resultsContent = document.getElementById("results-content");

  resultsContent.innerHTML = `
        <div class="result-item">
            <div class="result-label">Alignment Score:</div>
            <div style="font-size: 1.5em; color: #667eea; font-weight: bold;">${
              data.alignmentScore
            }</div>
        </div>

        <!-- NEW: Operation Counts Section -->
        <div class="result-item">
            <div class="result-label">Operation Counts:</div>
            <div class="operation-counts">
                <div class="operation-item match">
                    <span class="operation-icon">✓</span>
                    <span class="operation-name">Matches:</span>
                    <span class="operation-count">${
                      data.operations.matches
                    }</span>
                    <span class="operation-cost">(Cost: 0)</span>
                </div>
                <div class="operation-item mismatch">
                    <span class="operation-icon">✗</span>
                    <span class="operation-name">Mismatches:</span>
                    <span class="operation-count">${
                      data.operations.mismatches
                    }</span>
                    <span class="operation-cost">(Cost: ${
                      data.operations.mismatches
                    })</span>
                </div>
                <div class="operation-item insertion">
                    <span class="operation-icon">+</span>
                    <span class="operation-name">Insertions:</span>
                    <span class="operation-count">${
                      data.operations.insertions
                    }</span>
                    <span class="operation-cost">(Cost: ${
                      data.operations.insertions
                    })</span>
                </div>
                <div class="operation-item deletion">
                    <span class="operation-icon">−</span>
                    <span class="operation-name">Deletions:</span>
                    <span class="operation-count">${
                      data.operations.deletions
                    }</span>
                    <span class="operation-cost">(Cost: ${
                      data.operations.deletions
                    })</span>
                </div>
                <div class="operation-item skip">
                    <span class="operation-icon">⤷</span>
                    <span class="operation-name">Skips:</span>
                    <span class="operation-count">${
                      data.operations.skips
                    }</span>
                    <span class="operation-cost">(Cost: 0)</span>
                </div>
                <div class="operation-item total">
                    <span class="operation-icon">Σ</span>
                    <span class="operation-name">Total Operations:</span>
                    <span class="operation-count">${
                      data.operations.total
                    }</span>
                    <span class="operation-cost">(Total Penalty: ${
                      data.operations.penalty
                    })</span>
                </div>
            </div>
        </div>

        <!-- NEW: Matrix Values Section -->
        <div class="result-item">
            <div class="result-label">Final Matrix Values:</div>
            <div class="matrix-values">
                <div class="matrix-item">M[m,n]: ${data.matrices.M}</div>
                <div class="matrix-item">I[m,n]: ${data.matrices.I}</div>
                <div class="matrix-item">D[m,n]: ${data.matrices.D}</div>
                <div class="matrix-item">S[m,n]: ${data.matrices.S}</div>
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Reference Sequence:</div>
            <div class="sequence">${data.reference}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Query Sequence:</div>
            <div class="sequence">${data.query}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Aligned Reference:</div>
            <div class="sequence">${
              data.alignmentResult.alignedRef || "N/A"
            }</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Aligned Query:</div>
            <div class="sequence">${
              data.alignmentResult.alignedQuery || "N/A"
            }</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Edit Transcript:</div>
            <div class="sequence">${data.editTranscript}</div>
            <div style="margin-top: 5px; font-size: 0.9em; color: #666;">
                M=Match, X=Mismatch, I=Insertion, D=Deletion, S=Skip
            </div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Trait Information:</div>
            <div>${data.traitInfo}</div>
        </div>
        
        <div class="result-item">
            <div class="result-label">Analysis Time:</div>
            <div>${data.timestamp}</div>
        </div>
    `;

  document.getElementById("results").style.display = "block";
  document.getElementById("results").scrollIntoView({ behavior: "smooth" });
}

// Display error message
function displayError(message) {
  const resultsContent = document.getElementById("results-content");
  resultsContent.innerHTML = `
        <div style="background: #ffebee; color: #c62828; padding: 15px; border-radius: 5px;">
            <strong>Error:</strong> ${message}
        </div>
    `;
  document.getElementById("results").style.display = "block";
}

// Initialize page
document.addEventListener("DOMContentLoaded", function () {
  console.log("🌾 Agricultural Genomics Tool loaded");
});
