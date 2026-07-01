import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs';
import { AppSettings, DEFAULT_SETTINGS, DEFAULT_FORMAT_OPTIONS } from '../types';

async function ensureDir(): Promise<void> {
  try {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
  } catch {
    // already exists
  }
}

type Migration = (s: AppSettings) => AppSettings;

// To add a new migration (e.g. version 1 -> 2):
// 1. Add a new function to the end of the MIGRATIONS array
// 2. CURRENT_VERSION automatically increments
// 3. The migration runs once for every user who hasn't run it yet
// 4. Never modify existing MIGRATIONS entries - only add new ones
const MIGRATIONS: Migration[] = [
  // Version 0 -> 1
  // All migrations that existed before versioning was added. These run for
  // any user whose saved settings don't have settingsVersion (i.e. all
  // existing users on first upgrade to this version).
  (s) => {
    // Remove legacy 'autodetect' entry from aiToolbarActions
    const migratedActions = s.aiToolbarActions.filter((a) => a !== 'autodetect');
    s.aiToolbarActions = migratedActions.length > 0 ? migratedActions : DEFAULT_SETTINGS.aiToolbarActions;

    // Ensure 'rename' is present in paneHeaderItems
    if (Array.isArray(s.paneHeaderItems) && !s.paneHeaderItems.includes('rename')) {
      const idx = s.paneHeaderItems.indexOf('note-select');
      s.paneHeaderItems.splice(idx >= 0 ? idx + 1 : 1, 0, 'rename');
    }

    // Ensure 'format-toolbar-toggle' is present in paneHeaderItems
    if (Array.isArray(s.paneHeaderItems) && !s.paneHeaderItems.includes('format-toolbar-toggle')) {
      const idx = s.paneHeaderItems.indexOf('format-select');
      s.paneHeaderItems.splice(idx >= 0 ? idx + 1 : s.paneHeaderItems.length, 0, 'format-toolbar-toggle');
    }

    // Migrate legacy shared aiApiKey into the per-provider field
    if (s.aiApiKey && !s.claudeApiKey && !s.openaiApiKey && !s.deepseekApiKey) {
      if (s.aiProvider === 'claude') s.claudeApiKey = s.aiApiKey;
      else if (s.aiProvider === 'openai') s.openaiApiKey = s.aiApiKey;
      else if (s.aiProvider === 'deepseek') s.deepseekApiKey = s.aiApiKey;
      s.aiApiKey = '';
    }

    return s;
  },
];

const CURRENT_VERSION = MIGRATIONS.length; // automatically tracks latest version

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
    let merged: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      formatOptions: mergedFormats,
      paneNoteIds:
        Array.isArray(parsed.paneNoteIds) && parsed.paneNoteIds.length >= 4
          ? parsed.paneNoteIds
          : [...DEFAULT_SETTINGS.paneNoteIds],
    };

    // Run any pending migrations. Missing settingsVersion means the file
    // predates versioning, so treat it as version 0 (all existing users).
    const savedVersion = typeof parsed.settingsVersion === 'number' ? parsed.settingsVersion : 0;
    for (let v = savedVersion; v < CURRENT_VERSION; v++) {
      merged = MIGRATIONS[v](merged);
    }
    merged.settingsVersion = CURRENT_VERSION;

    return merged;
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
