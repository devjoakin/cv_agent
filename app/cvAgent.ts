import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { createAgent, tool } from "langchain";
import type { Document } from "@langchain/core/documents";
import { z } from "zod/v4";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CV_PDF_PATH =
  process.env.CV_PDF_PATH ?? path.resolve(__dirname, "cv.pdf");

const APP_API_BASE =
  process.env.WEATHER_API_URL ?? process.env.APP_URL ?? "http://localhost:3000";

let retrieverPromise: Promise<
  Awaited<ReturnType<MemoryVectorStore["asRetriever"]>>
> | null = null;

async function getRetriever() {
  if (retrieverPromise) return retrieverPromise;
  retrieverPromise = (async () => {
    const loader = new PDFLoader(CV_PDF_PATH);
    const docs = await loader.load();
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 800,
      chunkOverlap: 100,
    });
    const splits = await splitter.splitDocuments(docs);
    const embeddings = new OpenAIEmbeddings();
    const vectorStore = await MemoryVectorStore.fromDocuments(
      splits,
      embeddings
    );
    return vectorStore.asRetriever({ k: 4 });
  })();
  return retrieverPromise;
}

const retrieveCv = tool(
  async ({ query }) => {
    const retriever = await getRetriever();
    const docs = await retriever.invoke(query);
    return docs.map((d: Document) => d.pageContent).join("\n\n---\n\n");
  },
  {
    name: "retrieve_cv",
    description:
      "Search the CV for experience, skills, education, or other details. Call with a query string.",
    schema: z.object({
      query: z.string().describe("Search query about the CV content"),
    }),
  }
);

const sendEmail = tool(
  async ({ subject, message }) => {
    try {
      const res = await fetch(`${APP_API_BASE}/api/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message }),
      });
      const data = (await res.json()) as { error?: string; id?: string };
      if (!res.ok) {
        return JSON.stringify({
          status: "error",
          content: data.error ?? `Request failed: ${res.status}`,
        });
      }
      return JSON.stringify({
        status: "success",
        content: "Email sent. The user will be notified.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        status: "error",
        content: `Could not send email. Is the app running at ${APP_API_BASE}? ${msg}`,
      });
    }
  },
  {
    name: "send_email",
    description:
      "Send an email to the user when you could not find the answer in the CV. Use this after searching the CV with retrieve_cv if the CV does not contain the requested information, so the user can be contacted for clarification or to provide the answer.",
    schema: z.object({
      subject: z.string().describe("Short subject line for the email"),
      message: z
        .string()
        .describe(
          "Body of the email: include the user's question and that the answer was not found in the CV, and ask them to provide more info if they can."
        ),
    }),
  }
);

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

export const cvAgent = createAgent({
  model,
  tools: [retrieveCv, sendEmail],
  systemPrompt: `You are a CV analyst. Answer questions about this resume by searching relevant sections first.
1. Use the retrieve_cv tool to find relevant parts of the CV.
2. If the CV contains the answer, respond using the retrieved context.
3. If the CV does NOT contain the answer (e.g. the question is not in the resume, or you could not retrieve it), use the send_email tool to notify the user: send a short email with the subject and a message that states their question and that the answer was not found in the CV, and that they can reply with more details if they have them.
Always use retrieve_cv when answering. Use send_email only when you could not find the answer in the CV. Do not make up information.`,
});
