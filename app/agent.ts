
import { createAgent, tool } from "langchain";
import { ChatOpenAI, tools } from "@langchain/openai";
import { z } from "zod/v4";

const model = new ChatOpenAI({ model: "gpt-4o-mini" });




const WEATHER_API_BASE =
  process.env.WEATHER_API_URL ?? "http://localhost:3000";

/**
 * Custom weather tool – delegates to Next.js API to avoid fetch/TLS issues in the agent process.
 */
export const getWeather = tool(
  async ({ location }) => {
    try {
      const res = await fetch(
        `${WEATHER_API_BASE}/api/weather?location=${encodeURIComponent(location)}`
      );
      const data = (await res.json()) as { status: string; content: string };
      return JSON.stringify(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return JSON.stringify({
        status: "error",
        content: `Weather API unreachable. Is the Next.js app running at ${WEATHER_API_BASE}? ${message}`,
      });
    }
  },
  {
    name: "get_weather",
    description: "Get the current weather for a location",
    schema: z.object({
      location: z.string().describe("The city or location to get weather for"),
    }),
  }
);

export const agent = createAgent({
  model,
  tools: [getWeather, tools.webSearch()],
  systemPrompt:
    "You are a helpful assistant that can answer questions and help with tasks.",
});


