const fetch = require("node-fetch");

// Always use Gemini
const provider = () => "gemini";

// ===================== TEXT =====================

async function callGeminiText(messages, { temperature = 0.3 } = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const contents = [];
  let systemPrompt = "";

  for (const message of messages) {
    if (message.role === "system") {
      systemPrompt += message.content + "\n";
      continue;
    }

    contents.push({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: systemPrompt + message.content,
        },
      ],
    });

    systemPrompt = "";
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Gemini API Error (${response.status})`
    );
  }

  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join("") || ""
  );
}

async function generateCompletion(messages, options = {}) {
  return callGeminiText(messages, options);
}

// ===================== VISION =====================

async function callGeminiVision(image, mimeType, prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: image,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error?.message || `Gemini Vision Error (${response.status})`
    );
  }

  return (
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .join("") || ""
  );
}

async function generateVisionCompletion(image, mimeType, prompt) {
  return callGeminiVision(image, mimeType, prompt);
}

module.exports = {
  generateCompletion,
  generateVisionCompletion,
  provider,
};