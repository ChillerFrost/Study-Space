import "dotenv/config";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

export async function askLLM(system, userText) {
  const p = process.env.LLM_PROVIDER;

  if (p === "anthropic") {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: userText }],
    });
    return res.content[0].text;
  }

  const isSpark = p === "spark";
  const client = new OpenAI({
    apiKey: isSpark ? process.env.SPARK_API_KEY : process.env.OPENAI_API_KEY,
    baseURL: isSpark ? process.env.SPARK_BASE_URL : undefined,
  });
  const res = await client.chat.completions.create({
    model: isSpark ? process.env.SPARK_MODEL : process.env.OPENAI_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText },
    ],
  });
  return res.choices[0].message.content;
}