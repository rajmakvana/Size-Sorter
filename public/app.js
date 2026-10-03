const form = document.querySelector("#upload-form");
const input = document.querySelector("#pdf-input");
const dropZone = document.querySelector("#drop-zone");
const fileName = document.querySelector("#file-name");
const sortButton = document.querySelector("#sort-button");
const progressPanel = document.querySelector("#progress-panel");
const resultPanel = document.querySelector("#result-panel");
const errorPanel = document.querySelector("#error-panel");
const progressTitle = document.querySelector("#progress-title");
const progressMessage = document.querySelector("#progress-message");
const progressPages = document.querySelector("#progress-pages");
const progressPercent = document.querySelector("#progress-percent");
const progressFill = document.querySelector("#progress-fill");
const progressBar = document.querySelector(".progress-track");
const resultSummary = document.querySelector("#result-summary");
const downloadLink = document.querySelector("#download-link");
const errorMessage = document.querySelector("#error-message");
const tryAgain = document.querySelector("#try-again");
const sortAnother = document.querySelector("#sort-another");

let selectedFile = null;
let pollTimer = null;
let isBusy = false;
const SAVED_JOB_KEY = "meesho-sorter-job";

function setBusy(busy) {
  isBusy = busy;
  input.disabled = busy;
  dropZone.classList.toggle("is-processing", busy);
  dropZone.setAttribute("aria-disabled", String(busy));
  dropZone.tabIndex = busy ? -1 : 0;
}

function chooseFile(file) {
  if (!file || isBusy) return;
  selectedFile = file;
  fileName.textContent = `${file.name} · ${formatBytes(file.size)}`;
  fileName.hidden = false;
  dropZone.classList.add("has-file");
  sortButton.disabled = false;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showPanel(panel) {
  for (const candidate of [progressPanel, resultPanel, errorPanel]) candidate.hidden = candidate !== panel;
}

function setProgress(progress) {
  const percent = Math.max(0, Math.min(100, Math.round(progress.percent || 0)));
  progressTitle.textContent = progress.phase === "extracting" ? "Reading your PDF" : progress.phase === "detecting" ? "Finding sizes" : "Building sorted PDF";
  progressMessage.textContent = progress.message;
  progressPages.textContent = progress.total ? `${progress.current} / ${progress.total} pages` : "";
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  progressBar.setAttribute("aria-valuenow", String(percent));
}

function showError(message) {
  if (pollTimer) window.clearTimeout(pollTimer);
  errorMessage.textContent = message || "We could not sort that file.";
  showPanel(errorPanel);
  setBusy(false);
  sortButton.disabled = false;
}

function resetForAnotherFile() {
  if (pollTimer) window.clearTimeout(pollTimer);
  localStorage.removeItem(SAVED_JOB_KEY);
  setBusy(false);
  selectedFile = null;
  input.value = "";
  fileName.hidden = true;
  fileName.textContent = "";
  dropZone.classList.remove("has-file", "is-dragging");
  sortButton.disabled = true;
  showPanel(null);
  dropZone.focus();
}

async function watchJob(jobId, connectionRetries = 0) {
  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const job = await response.json();
    if (response.status === 404) {
      localStorage.removeItem(SAVED_JOB_KEY);
      resetForAnotherFile();
      return;
    }
    if (!response.ok) throw new Error(job.error || "Sorting job not found.");

    setProgress(job.progress);
    if (job.status === "failed") {
      localStorage.removeItem(SAVED_JOB_KEY);
      showError(job.error || "The server could not finish sorting this PDF.");
      return;
    }
    if (job.status === "complete") {
      resultSummary.textContent = `${job.totalPages} pages sorted · ${job.unknownPages} unknown`;
      downloadLink.href = `/api/jobs/${encodeURIComponent(job.id)}/download`;
      showPanel(resultPanel);
      setBusy(false);
      sortButton.disabled = false;
      return;
    }
    pollTimer = window.setTimeout(() => watchJob(jobId), 500);
  } catch (error) {
    if (connectionRetries < 5) {
      pollTimer = window.setTimeout(() => watchJob(jobId, connectionRetries + 1), 1000);
      return;
    }
    showError(error instanceof Error ? error.message : "The connection to the sorting service failed.");
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selectedFile) return;
  if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
    showError("Please choose a PDF file.");
    return;
  }
  if (selectedFile.size > 50 * 1024 * 1024) {
    showError("That file is larger than the 50 MB limit.");
    return;
  }

  sortButton.disabled = true;
  setBusy(true);
  showPanel(progressPanel);
  setProgress({ phase: "extracting", current: 0, total: 0, percent: 0, message: "Uploading your PDF..." });

  const request = new XMLHttpRequest();
  request.open("POST", "/api/jobs");
  request.upload.addEventListener("progress", (uploadEvent) => {
    if (!uploadEvent.lengthComputable) return;
    const percent = Math.round((uploadEvent.loaded / uploadEvent.total) * 10);
    setProgress({ phase: "extracting", current: 0, total: 0, percent, message: "Uploading your PDF..." });
  });
  request.addEventListener("load", () => {
    let body;
    try { body = JSON.parse(request.responseText); } catch { body = {}; }
    if (request.status < 200 || request.status >= 300) {
      showError(body.error || "The upload could not be processed.");
      return;
    }
    localStorage.setItem(SAVED_JOB_KEY, body.jobId);
    watchJob(body.jobId);
  });
  request.addEventListener("error", () => showError("The upload connection failed. Check your network and try again."));
  const data = new FormData();
  data.append("pdf", selectedFile);
  request.send(data);
});

input.addEventListener("change", () => chooseFile(input.files[0]));
dropZone.addEventListener("dragover", (event) => {
  if (isBusy) return;
  event.preventDefault();
  dropZone.classList.add("is-dragging");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
dropZone.addEventListener("drop", (event) => {
  if (isBusy) return;
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
  chooseFile(event.dataTransfer.files[0]);
});
dropZone.addEventListener("keydown", (event) => {
  if (isBusy) return;
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); }
});
tryAgain.addEventListener("click", resetForAnotherFile);
sortAnother.addEventListener("click", resetForAnotherFile);

const savedJobId = localStorage.getItem(SAVED_JOB_KEY);
if (savedJobId) {
  sortButton.disabled = true;
  setBusy(true);
  showPanel(progressPanel);
  setProgress({ phase: "extracting", current: 0, total: 0, percent: 0, message: "Reconnecting to your sort..." });
  watchJob(savedJobId);
}
