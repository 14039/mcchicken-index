/**
 * AI Agent — OpenAI Responses API with Web Search
 *
 * Shared module for dispatching AI web search agents.
 * Uses the Responses API with web_search_preview tool.
 *
 * Models:
 *   - gpt-4o: Fast, good for routine updates (news, current prices)
 *   - gpt-4.1: More capable, good for structured data extraction
 */

import OpenAI from "openai";

function getClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// ── Types ────────────────────────────────────────────────────────

export interface Citation {
  url: string;
  title: string;
}

export interface WebSearchResult {
  text: string;
  citations: Citation[];
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Core Dispatch Functions ──────────────────────────────────────

export async function dispatchWebSearch(
  prompt: string,
  model: string = "gpt-4o",
  instructions?: string
): Promise<WebSearchResult> {
  const params: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model,
    tools: [{ type: "web_search_preview" as const }],
    input: prompt,
  };

  if (instructions) {
    params.instructions = instructions;
  }

  const response = await getClient().responses.create(params);

  const citations: Citation[] = [];
  if (response.output && Array.isArray(response.output)) {
    for (const item of response.output) {
      if (item.type === "message" && item.content) {
        for (const contentBlock of item.content) {
          if (
            contentBlock.type === "output_text" &&
            contentBlock.annotations
          ) {
            for (const annotation of contentBlock.annotations) {
              if (annotation.type === "url_citation") {
                citations.push({
                  url: annotation.url,
                  title: annotation.title || "",
                });
              }
            }
          }
        }
      }
    }
  }

  return {
    text: response.output_text || "",
    citations,
    model,
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
      : undefined,
  };
}

/**
 * Dispatch a web search agent and attempt to extract structured JSON.
 */
export async function dispatchStructuredSearch<T>(
  prompt: string,
  model: string = "gpt-4o",
  instructions?: string
): Promise<{ data: T; citations: Citation[]; raw: string } | null> {
  const result = await dispatchWebSearch(prompt, model, instructions);

  const jsonData = extractJSON<T>(result.text);
  if (jsonData !== null) {
    return {
      data: jsonData,
      citations: result.citations,
      raw: result.text,
    };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────

export function extractJSON<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]) as T;
    } catch {
      // continue
    }
  }

  return null;
}
