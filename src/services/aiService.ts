import { fetch } from '@tauri-apps/plugin-http';
import { AppSettings } from '../types';

const TIMEOUT_MS = 30_000;

class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

// Prompts verbatim from original WPF AiService.cs
const PROMPTS = {
  spellcheck: (text: string) =>
    `Fix only the spelling errors in the following text. Return only the corrected text with no explanations:\n\n${text}`,

  polish: (text: string) =>
    `Improve the grammar, clarity, and flow of the following text. Keep the original meaning and style. Return only the improved text:\n\n${text}`,

  rephrase: (text: string) =>
    `Rephrase the following text to be clearer and more concise while preserving the meaning. Return only the rephrased text:\n\n${text}`,

  suggest: (text: string) =>
    `The user is writing a note. Suggest improvements or a natural continuation for the following text. Return only the suggestion:\n\n${text}`,

  fix: (text: string) =>
    `Analyze the following code and:\n` +
    `1. Identify the programming language\n` +
    `2. Find any syntax errors, logic errors, runtime issues, or common bugs\n` +
    `3. Return ONLY the complete corrected code with no explanations, no markdown, no code fences\n` +
    `4. If no errors are found, respond with exactly: "No errors detected. The code appears to be valid."\n` +
    `5. If the input is not code or the language cannot be determined, respond with exactly: "Could not determine code type or not enough information provided."\n\n` +
    `Code to analyze:\n${text}`,

  apply: (text: string, format: string) =>
    format === 'Auto-detect (Code)'
      ? `You are a code formatter. Detect the programming language of the following code and format it with correct indentation, spacing, and structure.\nOn the very first line of your response write exactly: LANG:<detected language name>\nIf you cannot determine the language, write: LANG:Unknown\nOn all subsequent lines write only the formatted code with no explanations and no markdown code fences.\n\nCode:\n${text}`
      : `You are a code formatter. Format the following ${format} code with correct indentation, spacing, and syntax structure. Return only the formatted code with no explanations and no markdown code fences:\n\n${text}`,

  diffSummary: (a: string, b: string) =>
    `Compare these two notes and provide a concise plain-English summary of the key differences.\nMention what was added, removed, or changed. Be specific but brief (3-6 sentences).\n\nNote A:\n---\n${a}\n\nNote B:\n---\n${b}`,
};

async function callAI(prompt: string, settings: AppSettings): Promise<string> {
  if (!settings.aiApiKey.trim()) {
    throw new AiError('No API key configured. Go to Settings to add your key.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    console.log(`[AI] provider=${settings.aiProvider} model=${settings.aiModel} prompt_len=${prompt.length}`);
    console.log(`[AI] api_key_set=${settings.aiApiKey.length > 0}`);

    let res: Response;
    if (settings.aiProvider === 'claude') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.aiApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: settings.aiModel,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    } else {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.aiApiKey}`,
        },
        body: JSON.stringify({
          model: settings.aiModel,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
    }

    if (!res.ok) {
      if (res.status === 401) throw new AiError('Invalid API key. Please check Settings.');
      if (res.status === 429) throw new AiError('API quota exceeded or rate limited. Please wait and try again.');
      throw new AiError(`API error ${res.status}. Check your API key and quota.`);
    }

    if (settings.aiProvider === 'claude') {
      const data = await res.json() as { content: { text: string }[] };
      return data.content[0].text;
    } else {
      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AiError('Request timed out after 30 seconds.');
    }
    throw new AiError('Network error. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
}

export function getAiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unknown error occurred.';
}

export async function runAction(
  action: 'spellcheck' | 'polish' | 'rephrase' | 'suggest' | 'fix',
  text: string,
  settings: AppSettings
): Promise<string> {
  return callAI(PROMPTS[action](text), settings);
}

export async function runApply(
  text: string,
  format: string,
  settings: AppSettings
): Promise<{ result: string; detectedLanguage: string | null }> {
  const raw = await callAI(PROMPTS.apply(text, format), settings);
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

export async function runDiffSummary(
  textA: string,
  textB: string,
  settings: AppSettings
): Promise<string> {
  return callAI(PROMPTS.diffSummary(textA, textB), settings);
}
