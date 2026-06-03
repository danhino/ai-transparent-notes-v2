import { ViewPlugin, Decoration, DecorationSet, ViewUpdate, WidgetType, EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

class InvisibleWidget extends WidgetType {
  constructor(readonly ch: string) { super(); }
  toDOM(): HTMLElement {
    const el = document.createElement('span');
    el.textContent = this.ch;
    el.className = 'cm-invisible-char';
    return el;
  }
  eq(other: InvisibleWidget): boolean { return other.ch === this.ch; }
  ignoreEvent(): boolean { return true; }
}

// Spaces → · via replace (same width as space in monospace)
const spaceWidget = Decoration.replace({ widget: new InvisibleWidget('·') });
// Tabs → → inserted before the tab so the tab retains its full visual width
const tabWidget = Decoration.widget({ widget: new InvisibleWidget('→'), side: -1 });
// Line endings → ¶ inserted before the newline character
const pilcrowWidget = Decoration.widget({ widget: new InvisibleWidget('¶'), side: -1 });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    for (let i = 0; i < text.length; i++) {
      const pos = from + i;
      const ch = text[i];
      if (ch === ' ') {
        builder.add(pos, pos + 1, spaceWidget);
      } else if (ch === '\t') {
        builder.add(pos, pos, tabWidget);
      } else if (ch === '\n') {
        builder.add(pos, pos, pilcrowWidget);
      }
    }
  }
  return builder.finish();
}

export function showInvisiblesPlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = buildDecorations(view); }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged)
          this.decorations = buildDecorations(update.view);
      }
    },
    { decorations: (v) => v.decorations }
  );
}
