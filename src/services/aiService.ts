import { AppSettings } from '../types';

const TIMEOUT_MS = 30_000;

function withTimeout(p: Promise<Response>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch('', { signal: controller.signal }).then(() => p).finally(() => clearTimeout(timer));
}

// Prompts matching the original WPF app
const PROMPTS = {
  spellcheck: (text: string) =>
    `Fix only the spelling errors in the following text. Return only the corrected text with no explanations:\n\n${text}`,

  polish: (text: string) =>
    `Improve the grammar, clarity, and flow of the following text while preserving its meaning. Return only the improved text:\n\n${text}`,

  rephrase: (text: string) =>
    `Rephrase the following text to make it clearer and more concise. Return only the rephrased text:\n\n${text}`,

  suggest: (text: string) =>
    `Provide improvement suggestions or continuation ideas for the following text. Return a short, helpful response:\n\n${text}`,

  fix: (text: string) =>
    `Analyze the following code for syntax and logic errors. Return the corrected code only, or describe the specific errors if they cannot be auto-fixed:\n\n${text}`,

  apply: (text: string, format: string) =>
    format === 'Auto-detect (Code)'
      ? `Format the following content as code, detect its programming language, and return the formatted code followed by exactly "Language: <detected language>" on the final line:\n\n${text}`
      : `Format the following content as ${format}. Return only the formatted result:\n\n${text}`,

  diffSummary: (a: string, b: string) =>
    `Compare these two versions of text and summarize what changed in 3 to 6 sentences:\n\nVersion A:\n${a}\n\nVersion B:\n${b}`,
};

async function callAI(prompt: string, settings: AppSettings): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
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
      if (!res.ok) throw new Error(`Claude API error ${res.status}`);
      const data = await res.json() as { content: { text: string }[] };
      return data.content[0].text;
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
      if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
      const data = await res.json() as { choices: { message: { content: string } }[] };
      return data.choices[0].message.content;
    }
  } finally {
    clearTimeout(timer);
  }
}

// Silence unused import warning
void withTimeout;

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
    const lines = raw.trimEnd().split('\n');
    const last = lines[lines.length - 1];
    const match = last.match(/^Language:\s*(.+)$/i);
    if (match) {
      return { result: lines.slice(0, -1).join('\n'), detectedLanguage: match[1].trim() };
    }
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
