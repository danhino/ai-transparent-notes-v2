import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { AppSettings, DEFAULT_SETTINGS, DEFAULT_FORMAT_OPTIONS } from '../types';

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
    const savedFormats = Array.isArray(parsed.formatOptions) ? parsed.formatOptions : [];
    const mergedFormats = [
      ...savedFormats,
      ...DEFAULT_FORMAT_OPTIONS.filter((f) => !savedFormats.includes(f)),
    ];
    const savedActions = Array.isArray(parsed.aiToolbarActions) ? parsed.aiToolbarActions : DEFAULT_SETTINGS.aiToolbarActions;
    const migratedActions = savedActions.filter((a) => a !== 'autodetect');
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      formatOptions: mergedFormats,
      aiToolbarActions: migratedActions.length > 0 ? migratedActions : DEFAULT_SETTINGS.aiToolbarActions,
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
