function scrubWhatsAppChatText(raw) {
  return String(raw || '')
    .replace(/\+27\s?\d{2}\s?\d{3}\s?\d{4}/g, '[REDACTED_PHONE]')
    .replace(/\+27\d{9}/g, '[REDACTED_PHONE]')
    .replace(/\b0\d{2}\s?\d{3}\s?\d{4}\b/g, '[REDACTED_PHONE]')
    .replace(/\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, '[REDACTED_NAME]');
}

function fallbackStats(text) {
  const categories = {
    Electrical: /\b(power|electricity|outage|blackout)\b/gi,
    Roads: /\b(pothole|road|tar)\b/gi,
    Water: /\b(water|leak|sewer|sanitation)\b/gi,
    Environmental: /\b(refuse|waste|dump|landfill)\b/gi,
    Other: /\b(complaint|issue|problem)\b/gi,
  };
  const counts = {};
  let total = 0;
  for (const [name, pattern] of Object.entries(categories)) {
    const count = (text.match(pattern) || []).length;
    counts[name] = count;
    total += count;
  }
  return { TotalComplaints: total, CategoryCounts: counts, SummaryNote: 'Fallback parser. Set OPENAI_API_KEY to use a model.' };
}

async function analyze(raw) {
  const scrubbed = scrubWhatsAppChatText(raw);
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return { model: 'fallback-parser', statistics: fallbackStats(scrubbed) };
  const endpoint = String(process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim();
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Count service-delivery complaints. Return JSON with TotalComplaints, CategoryCounts, and SummaryNote only.' },
        { role: 'user', content: scrubbed },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Analytics request failed (${response.status}).`);
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return { model: process.env.OPENAI_MODEL || 'gpt-4o', statistics: JSON.parse(content) };
}

function webhookHandler(req, res) {
  const expected = String(process.env.WHATSAPP_IMPORT_WEBHOOK_TOKEN || '').trim();
  if (!expected) return res.status(503).json({ message: 'Webhook token is not configured.' });
  const header = String(req.headers.authorization || '');
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const { tokensEqual } = require('./security');
  if (!tokensEqual(token, expected)) {
    return res.status(401).json({ message: 'Unauthorized webhook request.' });
  }
  const raw = typeof req.body === 'string'
    ? req.body
    : String(req.body?.chatDump || req.body?.text || req.body?.content || req.body?.raw || '');
  if (!raw.trim()) return res.status(400).json({ message: 'Provide a chat export.' });
  analyze(raw)
    .then((result) => res.json({ ingestion: { popiaScrubApplied: true }, ...result }))
    .catch(() => res.status(500).json({ message: 'Unable to process the import.' }));
}

module.exports = { webhookHandler, scrubWhatsAppChatText, fallbackStats };
