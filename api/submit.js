// Vercel serverless function: proxies the public form's submission to
// the n8n webhook. The form sends JSON; we forward JSON. Same-origin
// from the browser so no CORS preflight headaches.

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
    // Read the incoming body as raw text. Whether it's JSON, multipart,
    // or anything else, we forward the bytes untouched to n8n.
    const chunks = []
    for await (const chunk of req) {
      chunks.push(chunk)
    }
    const rawBody = Buffer.concat(chunks)
    const contentType = req.headers["content-type"] || "application/json"

    // Log what we received so we can see the exact JSON in Vercel logs.
    let parsedPreview = null
    if (contentType.includes("application/json")) {
      try {
        parsedPreview = JSON.parse(rawBody.toString("utf8"))
      } catch {
        /* leave null */
      }
    }

    console.log("[proxy] received from browser", {
      contentType,
      bytes: rawBody.length,
      payload: parsedPreview,
    })

    const upstream = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: rawBody,
      redirect: "manual",
    })

    const upstreamText = await upstream.text()
    const upstreamContentType = upstream.headers.get("content-type") || "application/json"

    console.log("[proxy] forwarded to n8n", {
      url: N8N_WEBHOOK_URL,
      upstreamStatus: upstream.status,
      upstreamBodyPreview: upstreamText.slice(0, 500),
    })

    res.status(upstream.status)
    res.setHeader("Content-Type", upstreamContentType)
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