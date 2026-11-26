import { fetchWithTimeout } from './_fetchUtils.js';

/**
 * Optional one-line "why it moved" summaries. Active only if ANTHROPIC_API_KEY or
 * OPENAI_API_KEY is set; otherwise returns items unchanged. Never throws.
 */
export async function addSummaries(items, { max = 12, timeoutMs = 6_000 } = {}) {
  const akey = process.env.ANTHROPIC_API_KEY;
  const okey = process.env.OPENAI_API_KEY;
  if (!akey && !okey) return items;
  const top = items.slice(0, max);
  if (!top.length) return items;
  const prompt =
    'For each numbered headline, write one short sentence (max 18 words) on why it may move the related stock. ' +
    'Use only the headline; do not invent facts. Reply with a JSON array of strings, same order.\n' +
    top.map((i, n) => `${n + 1}. ${i.title} [${i.tickers.join(',')}]`).join('\n');
  try {
    let text = '';
    if (akey) {
      const r = await fetchWithTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: { 'x-api-key': akey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({
            model: process.env.NEWS_SUMMARY_MODEL || 'claude-3-5-haiku-latest',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        timeoutMs,
      );
      if (!r.ok) return items;
      text = (await r.json())?.content?.[0]?.text || '';
    } else {
      const r = await fetchWithTimeout(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${okey}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            model: process.env.NEWS_SUMMARY_MODEL || 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
          }),
        },
        timeoutMs,
      );
      if (!r.ok) return items;
      text = (await r.json())?.choices?.[0]?.message?.content || '';
    }
    const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    if (!Array.isArray(arr)) return items;
    return items.map((it, n) => (n < max && typeof arr[n] === 'string' && arr[n].trim() ? { ...it, summary: arr[n].trim() } : it));
  } catch {
    return items;
  }
}
