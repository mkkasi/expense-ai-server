const OpenAI = require('openai');

let openaiClient;
const getOpenAIClient = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

const provider = () => (process.env.AI_PROVIDER || 'openai').toLowerCase();

// ---------- Text completion ----------

const callOpenAIText = async (messages, { temperature = 0.3, jsonMode = false } = {}) => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
    temperature,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  });
  return response.choices[0]?.message?.content || '';
};

const callGeminiText = async (messages, { temperature = 0.3 } = {}) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Gemini has no "system" role; fold it into the first user turn.
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const systemMsg = messages.find((m) => m.role === 'system');
  if (systemMsg && contents[0]) {
    contents[0].parts[0].text = `${systemMsg.content}\n\n${contents[0].parts[0].text}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature } }),
  });

  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
};

/**
 * Single entry point for text-only completions. Every AI feature (chat,
 * categorization, suggestions, prediction narrative) goes through this.
 */
const generateCompletion = async (messages, options = {}) => {
  return provider() === 'gemini' ? callGeminiText(messages, options) : callOpenAIText(messages, options);
};

// ---------- Vision (receipt OCR) ----------

const callOpenAIVision = async (base64Image, mimeType, prompt) => {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
  });
  return response.choices[0]?.message?.content || '';
};

const callGeminiVision = async (base64Image, mimeType, prompt) => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Image } }] }],
      generationConfig: { temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
};

/**
 * Vision completion for receipt scanning. Returns raw text (expected to be
 * JSON) - callers should parse defensively via utils/parseJsonSafely.
 */
const generateVisionCompletion = async (base64Image, mimeType, prompt) => {
  return provider() === 'gemini'
    ? callGeminiVision(base64Image, mimeType, prompt)
    : callOpenAIVision(base64Image, mimeType, prompt);
};

module.exports = { generateCompletion, generateVisionCompletion, provider };
