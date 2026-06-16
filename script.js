// Squeegee Squad LA — Public Form submitter.
// Posts the form as multipart/form-data so file uploads + text fields
// land in the n8n webhook the way the workflow expects.

const WEBHOOK_URL = "https://hu6j4d9e.rcld.app/webhook/0dc30588-9b5e-401e-b2c2-062d8c14831a"

const form = document.getElementById("estimate-form")
const submitBtn = document.getElementById("submit-btn")
const result = document.getElementById("result")

form.addEventListener("submit", async (event) => {
  event.preventDefault()
  result.classList.add("hidden")
  result.className = "result hidden"

  if (!form.reportValidity()) return

  submitBtn.disabled = true
  submitBtn.textContent = "Calculating…"

  const formData = new FormData(form)

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      body: formData,
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Workflow returned a non-JSON response (HTTP ${response.status}). Raw: ${text.slice(0, 300)}`)
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `Workflow returned HTTP ${response.status}`)
    }

    showSuccess(data)
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = "Get my estimate"
  }
})

function showSuccess(data) {
  result.className = "result success"
  const low = data?.range?.low
  const high = data?.range?.high
  const rangeHtml =
    typeof low === "number" && typeof high === "number"
      ? `<p class="range">$${low.toLocaleString()} – $${high.toLocaleString()}</p>`
      : ""

  result.innerHTML = `
    <h2>Your preliminary estimate</h2>
    ${rangeHtml}
    <p>${escapeHtml(data?.estimate || "We'll be in touch shortly.")}</p>
    <p class="meta">Lead ID: ${escapeHtml(data?.leadId || "")}${data?.confidence ? ` · Confidence: ${escapeHtml(data.confidence)}` : ""}${data?.ai_used ? " · AI photo analysis used" : ""}</p>
  `
  result.classList.remove("hidden")
  result.scrollIntoView({ behavior: "smooth", block: "start" })
}

function showError(message) {
  result.className = "result error"
  result.innerHTML = `
    <h2>Something went wrong</h2>
    <p>${escapeHtml(message)}</p>
    <p class="meta">If this keeps happening, please call us directly.</p>
  `
  result.classList.remove("hidden")
  result.scrollIntoView({ behavior: "smooth", block: "start" })
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}