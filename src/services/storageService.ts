import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { AppSettings, DEFAULT_SETTINGS } from '../types';

async function ensureDir(): Promise<void> {
  try {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // already exists
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    await ensureDir();
    const raw = await readTextFile('settings.json', { baseDir: BaseDirectory.AppData });
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    // Merge with defaults so new fields always have values
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      paneNoteIds:
        Array.isArray(parsed.paneNoteIds) && parsed.paneNoteIds.length >= 4
          ? parsed.paneNoteIds
          : [...DEFAULT_SETTINGS.paneNoteIds],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await ensureDir();
  await writeTextFile('settings.json', JSON.stringify(settings, null, 2), {
    baseDir: BaseDirectory.AppData,
  });
}

export async function readSourceFile(path: string): Promise<string> {
  return readTextFile(path);
}

export async function writeSourceFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}
