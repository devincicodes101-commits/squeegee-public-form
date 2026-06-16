// Vercel serverless function: proxies the public form's multipart/form-data
// POST to the n8n webhook server-side. Same-origin from the browser's
// point of view, so no CORS preflight is required.
//
// Why this exists: the browser was either silently rejecting the cross-
// origin POST to rcld.app OR rcld.app was responding in a way the browser
// could not consume — either way, n8n was never receiving an execution.
// Forwarding from a server bypasses both problems and gives us logs.

export const config = {
  api: { bodyParser: false },
}

const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://hu6j4d9e.rcld.app/webhook/0dc30588-9b5e-401e-b2c2-062d8c14831a"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" })
  }

  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const rawBody = Buffer.concat(chunks)

    // Forward the multipart payload as-is. Critical: preserve the original
    // Content-Type header — it contains the multipart boundary that n8n
    // needs to parse the form fields and any uploaded files.
    const headers = { "Content-Type": req.headers["content-type"] || "application/octet-stream" }
    const userAgent = req.headers["user-agent"]
    if (userAgent) headers["User-Agent"] = userAgent

    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "manual",
    })

    const upstreamText = await upstream.text()
    const contentType = upstream.headers.get("content-type") || "application/json"

    console.log("[proxy] forwarded to n8n", {
      url: N8N_WEBHOOK_URL,
      requestBytes: rawBody.length,
      contentType: req.headers["content-type"],
      upstreamStatus: upstream.status,
      upstreamBodyPreview: upstreamText.slice(0, 500),
    })

    res.status(upstream.status)
    res.setHeader("Content-Type", contentType)
    res.send(upstreamText)
  } catch (err) {
    console.error("[proxy] failed to forward", err)
    res.status(502).json({
      ok: false,
      error: "Proxy failed to reach n8n webhook",
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}