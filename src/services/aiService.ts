import { invoke } from '@tauri-apps/api/core';
import { AppSettings } from '../types';

class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

// Instruction strings (without content — content is passed separately to Rust)
const INSTRUCTIONS = {
  spellcheck:
    'Fix only the spelling errors in the following text. Return only the corrected text with no explanations:',

  polish:
    'Improve the grammar, clarity, and flow of the following text. Keep the original meaning and style. Return only the improved text:',

  rephrase:
    'Rephrase the following text to be clearer and more concise while preserving the meaning. Return only the rephrased text:',

  convo:
    'Rewrite the following text in a natural, conversational tone. Make it sound like a knowledgeable person speaking casually to a colleague — clear, direct, friendly, and easy to understand. Remove overly formal language, jargon, and stiff phrasing. Keep all the key information and meaning intact. Return only the rewritten text with no explanation or commentary:',

  suggest:
    'The user is writing a note. Suggest improvements or a natural continuation for the following text. Return only the suggestion:',

  fix:
    'Analyze the following code and:\n' +
    '1. Identify the programming language\n' +
    '2. Find any syntax errors, logic errors, runtime issues, or common bugs\n' +
    '3. Return ONLY the complete corrected code with no explanations, no markdown, no code fences\n' +
    '4. If no errors are found, respond with exactly: "No errors detected. The code appears to be valid."\n' +
    '5. If the input is not code or the language cannot be determined, respond with exactly: ' +
    '"Could not determine code type or not enough information provided."\n\nCode to analyze:',
};

function applyInstruction(format: string): string {
  if (format === 'Auto-detect (Code)') {
    return (
      'You are a code formatter. Detect the programming language of the following code and format it ' +
      'with correct indentation, spacing, and structure.\n' +
      'On the very first line of your response write exactly: LANG:<detected language name>\n' +
      'If you cannot determine the language, write: LANG:Unknown\n' +
      'On all subsequent lines write only the formatted code with no explanations and no markdown code fences.\n\nCode:'
    );
  }
  if (format === 'RTF') {
    return (
      'Reformat and improve the following rich text content. Enhance structure and readability. ' +
      'Use **text** for bold, _text_ for italic, # for Heading 1, ## for Heading 2, ### for Heading 3, ' +
      '> for block quotes where appropriate. Return only the improved content with no explanations:'
    );
  }
  if (format === 'CSV') {
    return (
      'Clean and standardize the following CSV data. Fix inconsistent formatting, remove extra whitespace, ' +
      'ensure consistent delimiter usage, and align data types within columns. ' +
      'Return only the CSV content with no explanations, no markdown, no code fences:'
    );
  }
  if (format === 'XML') {
    return (
      'Reformat and clean the following XML. Ensure proper indentation (2 spaces), valid tag nesting, ' +
      'and correct attribute quoting. Return only the XML content with no explanations and no markdown code fences:'
    );
  }
  if (format === 'Plain Text (Structured Notes)') {
    return (
      'Improve the structure, clarity, and organization of the following notes. ' +
      'Fix grammar, add logical grouping, and ensure consistent formatting. ' +
      'Return only the improved text with no explanations:'
    );
  }
  return (
    `You are a code formatter. Format the following ${format} code with correct indentation, ` +
    `spacing, and syntax structure. Return only the formatted code with no explanations and no markdown code fences:`
  );
}

function getApiKey(settings: AppSettings): string {
  switch (settings.aiProvider) {
    case 'claude': return settings.claudeApiKey;
    case 'openai': return settings.openaiApiKey;
    case 'deepseek': return settings.deepseekApiKey;
    default: return '';
  }
}

async function callAI(prompt: string, content: string, settings: AppSettings): Promise<string> {
  const apiKey = getApiKey(settings);
  if (settings.aiProvider !== 'ollama' && !apiKey.trim()) {
    throw new AiError('No API key configured. Go to Settings to add your key.');
  }

  try {
    const result = await invoke<string>('call_ai', {
      provider: settings.aiProvider,
      apiKey,
      model: settings.aiModel,
      prompt,
      content,
      ollamaUrl: settings.ollamaUrl || null,
    });
    return result;
  } catch (err) {
    if (err instanceof AiError) throw err;
    const msg = typeof err === 'string' ? err : err instanceof Error ? err.message : 'An unknown error occurred.';
    throw new AiError(msg);
  }
}

export async function detectOllama(url: string): Promise<boolean> {
  try {
    return await invoke<boolean>('detect_ollama', { url });
  } catch {
    return false;
  }
}

export interface OllamaModel {
  name: string;
  size: number;
}

function describeOllamaModel(model: OllamaModel): string {
  const gb = model.size / (1024 ** 3);
  const sizeTag = gb < 2 ? 'Fastest' : gb < 5 ? 'Balanced' : 'Most capable';
  const name = model.name.toLowerCase();
  const typeTag = name.includes('coder') || name.includes('code') ? ' · Code' : '';
  return `${sizeTag}${typeTag}`;
}

export async function fetchOllamaModels(url: string): Promise<{ name: string; description: string }[]> {
  try {
    const raw = await invoke<string>('fetch_ollama_models', { url });
    const data = JSON.parse(raw);
    const models: OllamaModel[] = (data.models ?? []).map((m: { name: string; size: number }) => ({
      name: m.name,
      size: m.size ?? 0,
    }));
    models.sort((a, b) => a.size - b.size);
    return models.map((m) => ({ name: m.name, description: describeOllamaModel(m) }));
  } catch {
    return [];
  }
}

export function getAiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unknown error occurred.';
}

export async function runAction(
  action: 'spellcheck' | 'polish' | 'rephrase' | 'convo' | 'suggest' | 'fix',
  text: string,
  settings: AppSettings
): Promise<string> {
  return callAI(INSTRUCTIONS[action], text, settings);
}

export async function runApply(
  text: string,
  format: string,
  settings: AppSettings
): Promise<{ result: string; detectedLanguage: string | null }> {
  const raw = await callAI(applyInstruction(format), text, settings);
  if (format === 'Auto-detect (Code)') {
    const lines = raw.split('\n');
    const firstLine = lines[0].trim();
    const match = firstLine.match(/^LANG:\s*(.+)$/i);
    const lang = match ? match[1].trim() : null;
    const code = lines.slice(1).join('\n').replace(/^\n/, '');
    return { result: code, detectedLanguage: lang && lang !== 'Unknown' ? lang : null };
  }
  return { result: raw, detectedLanguage: null };
}

export async function runAiResultSummary(
  original: string,
  result: string,
  settings: AppSettings
): Promise<string> {
  const prompt =
    'Summarize the changes made to the text in 2-3 sentences. ' +
    'Focus on what was improved, fixed, or changed.\n\n' +
    `Original:\n---\n${original}\n\nResult:\n---\n${result}`;
  return callAI(prompt, '', settings);
}

export async function runDiffSummary(
  textA: string,
  textB: string,
  settings: AppSettings
): Promise<string> {
  const prompt =
    'Compare these two notes and provide a concise plain-English summary of the key differences.\n' +
    'Mention what was added, removed, or changed. Be specific but brief (3-6 sentences).\n\n' +
    `Note A:\n---\n${textA}\n\nNote B:\n---\n${textB}`;
  return callAI(prompt, '', settings);
}
