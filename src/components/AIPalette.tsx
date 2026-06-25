import { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles } from 'lucide-react';

type AiAction = 'fix' | 'polish' | 'rephrase' | 'convo' | 'spellcheck' | 'suggest' | 'apply';

interface Suggestion {
  id: string;
  label: string;
  action: AiAction;
}

interface Props {
  format: string;
  hasSelection: boolean;
  onAction: (action: AiAction) => void;
  onCustomPrompt: (prompt: string) => void;
  onClose: () => void;
}

const BASE_SUGGESTIONS: Suggestion[] = [
  { id: 'fix',      label: 'Fix errors',                      action: 'fix' },
  { id: 'polish',   label: 'Improve writing',                 action: 'polish' },
  { id: 'convo',    label: 'Rewrite in conversational tone',  action: 'convo' },
  { id: 'suggest',  label: 'Suggest continuation',            action: 'suggest' },
  { id: 'rephrase', label: 'Rephrase',                        action: 'rephrase' },
  { id: 'apply',    label: 'Format and clean up',             action: 'apply' },
];

const PROSE_SUGGESTIONS: Suggestion[] = [
  { id: 'improve',   label: 'Improve writing',                action: 'polish' },
  { id: 'convo',     label: 'Rewrite in conversational tone', action: 'convo' },
  { id: 'summarize', label: 'Summarize',                      action: 'suggest' },
  { id: 'bullets',   label: 'Convert to bullet points',       action: 'rephrase' },
  { id: 'fix',       label: 'Fix errors',                     action: 'fix' },
  { id: 'rephrase',  label: 'Rephrase',                       action: 'rephrase' },
];

const FORMAT_SUGGESTIONS: Record<string, Suggestion[]> = {
  sql: [
    { id: 'sql-optimize', label: 'Optimize this query',          action: 'fix' },
    { id: 'sql-explain',  label: 'Explain this SQL query',       action: 'polish' },
    { id: 'sql-rewrite',  label: 'Rewrite as a subquery',        action: 'rephrase' },
  ],
  json: [
    { id: 'json-validate', label: 'Validate and fix schema',       action: 'fix' },
    { id: 'json-explain',  label: 'Explain this JSON structure',   action: 'polish' },
  ],
  python: [
    { id: 'py-fix',      label: 'Find and fix bugs',             action: 'fix' },
    { id: 'py-refactor', label: 'Refactor this function',        action: 'rephrase' },
    { id: 'py-explain',  label: 'Explain this code',             action: 'polish' },
    { id: 'py-optimize', label: 'Optimize performance',          action: 'fix' },
  ],
  javascript: [
    { id: 'js-fix',      label: 'Find and fix bugs',             action: 'fix' },
    { id: 'js-refactor', label: 'Refactor this function',        action: 'rephrase' },
    { id: 'js-explain',  label: 'Explain this code',             action: 'polish' },
  ],
  typescript: [
    { id: 'ts-fix',      label: 'Find and fix bugs',             action: 'fix' },
    { id: 'ts-types',    label: 'Improve type definitions',      action: 'rephrase' },
    { id: 'ts-explain',  label: 'Explain this code',             action: 'polish' },
  ],
  markdown: [
    { id: 'md-summarize', label: 'Summarize',                    action: 'suggest' },
    { id: 'md-improve',   label: 'Improve writing',              action: 'polish' },
    { id: 'md-outline',   label: 'Generate outline',             action: 'suggest' },
  ],
  'plain text': PROSE_SUGGESTIONS,
  rtf:          PROSE_SUGGESTIONS,
  rust: [
    { id: 'rs-fix',      label: 'Find and fix bugs',             action: 'fix' },
    { id: 'rs-refactor', label: 'Refactor this function',        action: 'rephrase' },
    { id: 'rs-explain',  label: 'Explain this code',             action: 'polish' },
  ],
  'c#': [
    { id: 'cs-fix',      label: 'Find and fix bugs',             action: 'fix' },
    { id: 'cs-refactor', label: 'Refactor this method',          action: 'rephrase' },
    { id: 'cs-explain',  label: 'Explain this code',             action: 'polish' },
  ],
  java: [
    { id: 'java-fix',      label: 'Find and fix bugs',           action: 'fix' },
    { id: 'java-refactor', label: 'Refactor this method',        action: 'rephrase' },
    { id: 'java-explain',  label: 'Explain this code',           action: 'polish' },
  ],
  'c': [
    { id: 'c-fix',      label: 'Find and fix bugs',              action: 'fix' },
    { id: 'c-explain',  label: 'Explain this code',              action: 'polish' },
  ],
  'c++': [
    { id: 'cpp-fix',      label: 'Find and fix bugs',            action: 'fix' },
    { id: 'cpp-refactor', label: 'Refactor this function',       action: 'rephrase' },
    { id: 'cpp-explain',  label: 'Explain this code',            action: 'polish' },
  ],
  'html/css': [
    { id: 'html-fix',     label: 'Fix HTML/CSS issues',          action: 'fix' },
    { id: 'html-improve', label: 'Improve structure',            action: 'polish' },
  ],
  css: [
    { id: 'css-fix',      label: 'Fix CSS issues',               action: 'fix' },
    { id: 'css-improve',  label: 'Improve and clean up',         action: 'polish' },
  ],
  xml: [
    { id: 'xml-fix',      label: 'Validate and fix XML',         action: 'fix' },
  ],
  csv: [
    { id: 'csv-clean',    label: 'Clean and standardize',        action: 'apply' },
  ],
};

function getContextualSuggestions(format: string, hasSelection: boolean): Suggestion[] {
  const key = format.toLowerCase();
  const contextual = FORMAT_SUGGESTIONS[key] ?? BASE_SUGGESTIONS;

  if (hasSelection) {
    return [
      { id: 'explain', label: 'Explain selection', action: 'polish' },
      ...contextual,
    ];
  }

  return contextual;
}

export function AIPalette({ format, hasSelection, onAction, onCustomPrompt, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(
    () => getContextualSuggestions(format, hasSelection),
    [format, hasSelection]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return suggestions;
    const q = query.toLowerCase();
    return suggestions.filter((s) => s.label.toLowerCase().includes(q));
  }, [suggestions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (query.trim() && filtered.length === 0) {
        onCustomPrompt(query.trim());
      } else if (filtered[selectedIndex]) {
        onAction(filtered[selectedIndex].action);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="ai-palette-overlay" onMouseDown={onClose}>
      <div className="ai-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="ai-palette-header">
          <Sparkles size={14} className="ai-palette-icon" />
          <input
            ref={inputRef}
            className="ai-palette-input"
            placeholder="Ask AI or choose action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="ai-palette-list" ref={listRef}>
          {filtered.map((s, i) => (
            <button
              key={s.id}
              className={`ai-palette-item${i === selectedIndex ? ' selected' : ''}`}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => onAction(s.action)}
            >
              {s.label}
            </button>
          ))}
          {filtered.length === 0 && query.trim() && (
            <button
              className="ai-palette-item selected"
              onClick={() => onCustomPrompt(query.trim())}
            >
              Send: "{query.trim()}"
            </button>
          )}
          {!query.trim() && (
            <div className="ai-palette-hint">or type a custom instruction</div>
          )}
        </div>
      </div>
    </div>
  );
}
