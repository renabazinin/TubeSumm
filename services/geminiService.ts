import { GoogleGenAI, Type, Schema } from "@google/genai";
import { VideoSummary, GeminiModel, SummaryOptions } from "../types";

const getEnvApiKey = (): string | undefined => {
  try {
    const viteEnv = (import.meta as any)?.env;
    const fromVite = viteEnv?.VITE_GEMINI_API_KEY || viteEnv?.VITE_API_KEY;
    if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim();
  } catch {
    // ignore
  }

  try {
    const env = (globalThis as any)?.process?.env;
    const fromNode = env?.GEMINI_API_KEY || env?.API_KEY;
    if (typeof fromNode === 'string' && fromNode.trim()) return fromNode.trim();
  } catch {
    // ignore
  }

  return undefined;
};

const getAIInstance = (apiKey?: string) => {
  const resolved = apiKey?.trim() || getEnvApiKey();
  if (!resolved) {
    throw new Error("Missing Gemini API key");
  }
  return new GoogleGenAI({ apiKey: resolved });
};

const summarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { 
      type: Type.STRING, 
      description: "The title of the video. If not provided, infer it from the content." 
    },
    language: { 
      type: Type.STRING, 
      enum: ["en", "he"],
      description: "The primary language of the output content."
    },
    overview: { 
      type: Type.STRING, 
      description: "A comprehensive overview/executive summary of the entire video."
    },
    chapters: {
      type: Type.ARRAY,
      description: "List of chapters with detailed summaries.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Descriptive title of the chapter." },
          timestamp: { type: Type.STRING, description: "Start timestamp of the chapter (e.g., '02:15') if available or inferable." },
          summary: { type: Type.STRING, description: "Detailed summary of the chapter's content." },
          subSummary: { type: Type.STRING, description: "A short sub-summary of this chapter (1-3 sentences)." },
          subChapters: {
            type: Type.ARRAY,
            description: "Sub-chapters inside this chapter, broken down by time steps and subjects.",
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING, description: "Timestamp for this sub-chapter (e.g., '07:42') if available or inferable." },
                subject: { type: Type.STRING, description: "The subject/topic label for this sub-chapter." },
                summary: { type: Type.STRING, description: "Detailed summary for this sub-chapter." }
              },
              required: ["subject", "summary"]
            }
          }
        },
        required: ["title", "summary"]
      }
    }
  },
  required: ["title", "language", "overview", "chapters"]
};

const getCommonPromptInstructions = (options: SummaryOptions, requestedTitle?: string) => {
  const langInstruction = options.outputLanguage === 'auto' 
    ? "Determine the language of the video and output in that same language."
    : `Output strictly in ${options.outputLanguage === 'en' ? 'English' : 'Hebrew'}.`;

  const contextInstruction = options.extraContextText 
    ? `\nAdditional Context to consider (Use this to better understand the content): "${options.extraContextText}"\n` 
    : "";
  
  const fileInstruction = options.extraContextFile
    ? `\nNote: A supplementary file (PDF/Text) has been provided. Use its content to enrich the summary and clarify technical terms or context.\n`
    : "";

  const titleInstruction = requestedTitle?.trim()
    ? `\nUser-provided title (use this EXACTLY as the JSON title field, do not translate or rewrite): "${requestedTitle.trim()}"\n`
    : "";

  return `
    ${contextInstruction}
    ${fileInstruction}
    ${titleInstruction}

    1. ${langInstruction}
    2. Segment the video into logical chapters based on time progression. 
    3. **CRITICAL**: Create fewer, longer chapters containing detailed information. Do not omit important details. Each chapter summary must be comprehensive and very detailed.
    4. Extract or infer timestamps for when each chapter begins.
    5. For EACH chapter, also provide a short \"subSummary\" and a list of \"subChapters\" (time steps + subjects) that further breaks the chapter down.
    6. Provide a detailed overall summary of the video.
    
    Output strictly in JSON format matching the schema.
  `;
};

export const generateSummaryFromUrl = async (
  url: string, 
  model: GeminiModel,
  options: SummaryOptions,
  apiKey?: string,
  requestedTitle?: string
): Promise<Omit<VideoSummary, 'id' | 'createdAt' | 'sourceType' | 'sourceValue'>> => {
  const ai = getAIInstance(apiKey);
  
  const prompt = `
    You are an expert video content analyzer. 
    Analyze the provided YouTube video.
    ${getCommonPromptInstructions(options, requestedTitle)}
  `;

  const parts: any[] = [
    { text: prompt },
    { 
        fileData: { 
            fileUri: url.trim(), 
            mimeType: 'video/mp4' 
        } 
    }
  ];

  if (options.extraContextFile) {
    parts.push({
      inlineData: {
        mimeType: options.extraContextFile.mimeType,
        data: options.extraContextFile.data
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
            role: 'user',
            parts: parts
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: summarySchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    const data = JSON.parse(text);
    
    return { ...data, sources: [] };
  } catch (error: any) {
    console.error("Gemini URL Error:", error);
    if (error.message?.includes('403') || error.message?.includes('404') || error.message?.includes('not found') || error.message?.includes('500')) {
      throw new Error("UNLISTED_VIDEO_ERROR");
    }
    throw error;
  }
};

export const generateSummaryFromTranscript = async (
  transcript: string, 
  model: GeminiModel,
  options: SummaryOptions,
  apiKey?: string,
  requestedTitle?: string
): Promise<Omit<VideoSummary, 'id' | 'createdAt' | 'sourceType' | 'sourceValue'>> => {
  const ai = getAIInstance(apiKey);

  const prompt = `
    You are an expert video content analyzer.
    Analyze the following video transcript.
    ${getCommonPromptInstructions(options, requestedTitle)}

    TRANSCRIPT:
    ${transcript.substring(0, 30000)} ... (truncated if too long)
  `;

  const parts: any[] = [{ text: prompt }];

  if (options.extraContextFile) {
    parts.push({
      inlineData: {
        mimeType: options.extraContextFile.mimeType,
        data: options.extraContextFile.data
      }
    });
  }

  const response = await ai.models.generateContent({
    model: model,
    contents: [
        {
            role: 'user',
            parts: parts
        }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: summarySchema,
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");

  return JSON.parse(text);
};