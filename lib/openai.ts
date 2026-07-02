/**
 * OpenAI Responses API dispatch — the survey instrument (§2) and the
 * grounded journal writer. Strict JSON-schema output on both calls so
 * parsing never depends on regex extraction.
 */

import OpenAI from "openai";
import { createHash } from "crypto";
import {
  JOURNAL_MODEL,
  JOURNAL_REASONING_EFFORT,
  SURVEY_MODEL,
  SURVEY_REASONING_EFFORT,
} from "./config";
import type { SurveyResponse } from "./types";

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 720_000, // xhigh survey runs are minutes-long
      maxRetries: 1,
    });
  }
  return _client;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

// ── Survey schema (mirrors METHODOLOGY.md §2 verbatim) ───────────

const SURVEY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "survey_date",
    "observations",
    "national_estimates",
    "regime_events",
    "quality_notes",
  ],
  properties: {
    survey_date: { type: "string" },
    observations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "metro",
          "price",
          "source_url",
          "source_type",
          "price_type",
          "page_updated",
          "as_of",
          "notes",
        ],
        properties: {
          metro: { type: "string" },
          price: { type: ["number", "null"] },
          source_url: { type: "string" },
          source_type: {
            type: "string",
            enum: ["pinned_aggregator", "aggregator", "app", "news"],
          },
          price_type: {
            type: "string",
            enum: ["standard_menu", "value_menu_listed", "promo_suspected"],
          },
          page_updated: { type: ["string", "null"] },
          as_of: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
    national_estimates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["estimate", "source_url", "as_of", "description"],
        properties: {
          estimate: { type: "number" },
          source_url: { type: "string" },
          as_of: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    regime_events: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "event", "source_url"],
        properties: {
          date: { type: "string" },
          event: { type: "string" },
          source_url: { type: "string" },
        },
      },
    },
    quality_notes: { type: "string" },
  },
} as const;

export interface SurveyDispatchResult {
  survey: SurveyResponse;
  model: string;
  promptHash: string;
  usage: Usage | null;
  responseId: string;
}

export async function dispatchSurvey(prompt: string): Promise<SurveyDispatchResult> {
  const response = await getClient().responses.create({
    model: SURVEY_MODEL,
    reasoning: { effort: SURVEY_REASONING_EFFORT as "high" },
    tools: [
      {
        type: "web_search" as never,
        user_location: { type: "approximate", country: "US" },
      } as never,
    ],
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "mcchicken_price_survey",
        strict: true,
        schema: SURVEY_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    max_output_tokens: 32000,
  });

  if (response.status !== "completed") {
    throw new Error(`survey response status ${response.status}`);
  }
  const text = response.output_text;
  if (!text) throw new Error("survey returned no output text");
  const survey = JSON.parse(text) as SurveyResponse;

  return {
    survey,
    model: response.model ?? SURVEY_MODEL,
    promptHash: promptHash(prompt),
    usage: response.usage
      ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        }
      : null,
    responseId: response.id,
  };
}

// ── Journal writer (no tools, grounded, cheap) ───────────────────

const JOURNAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "body"],
  properties: {
    title: { type: "string" },
    body: { type: "string" },
  },
} as const;

export interface JournalDraft {
  title: string;
  body: string;
}

export async function dispatchJournal(prompt: string): Promise<JournalDraft> {
  const response = await getClient().responses.create({
    model: JOURNAL_MODEL,
    reasoning: { effort: JOURNAL_REASONING_EFFORT as "low" },
    input: prompt,
    text: {
      format: {
        type: "json_schema",
        name: "mcchicken_journal_entry",
        strict: true,
        schema: JOURNAL_SCHEMA as unknown as Record<string, unknown>,
      },
    },
    max_output_tokens: 2000,
  });
  if (response.status !== "completed" || !response.output_text) {
    throw new Error(`journal response status ${response.status}`);
  }
  return JSON.parse(response.output_text) as JournalDraft;
}
