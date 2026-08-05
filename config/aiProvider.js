const OpenAI = require("openai");

let openaiClient;

const getOpenAIClient = () => {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
};

// Default provider = Gemini
const provider = () => {
  const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  console.log("AI Provider:", aiProvider);
  return aiProvider;
};

// ================= TEXT =================

async function callOpenAIText(messages, { temperature = 0.3, jsonMode = false } = {}) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5",
    messages,
    temperature,
    ...(jsonMode
      ? {
          response_format: {
            type: "json_object",
          },
        }
      : {}),
  });

  return response.choices[0]?.message?.content || "";
}

async function callGeminiText(messages, { temperature = 0.3 } = {}) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const contents = [];

  let systemPrompt = "";

  for (const m of messages) {
    if (m.role === "system") {
      systemPrompt += m.content + "\n";
      continue;
    }

    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        {
          text: systemPrompt + m.content,
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
      ?.map((p) => p.text)
      .join("") || ""
  );
}

async function generateCompletion(messages, options = {}) {
  if (provider() === "gemini") {
    return await callGeminiText(messages, options);
  }

  return await callOpenAIText(messages, options);
}

// ================= VISION =================

async function callOpenAIVision(image, mimeType, prompt) {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-5",
    temperature: 0.1,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: prompt,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${image}`,
            },
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

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
      data.error?.message || `Gemini API Error (${response.status})`
    );
  }

  return (
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text)
      .join("") || ""
  );
}

async function generateVisionCompletion(image, mimeType, prompt) {
  if (provider() === "gemini") {
    return await callGeminiVision(image, mimeType, prompt);
  }

  return await callOpenAIVision(image, mimeType, prompt);
}

module.exports = {
  generateCompletion,
  generateVisionCompletion,
  provider,
};