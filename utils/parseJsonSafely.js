/**
 * LLMs frequently wrap JSON in ```json fences or add stray prose. This
 * strips common wrappers and parses defensively, returning `fallback`
 * (default null) instead of throwing if parsing still fails.
 */
const parseJsonSafely = (text, fallback = null) => {
  if (!text || typeof text !== 'string') return fallback;

  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const start = firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start > 0) cleaned = cleaned.slice(start);

  try {
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
};

module.exports = parseJsonSafely;
