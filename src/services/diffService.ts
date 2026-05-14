import { DiffBlock } from '../types';

export function computeLineDiff(textA: string, textB: string): DiffBlock[] {
  const linesA = textA.split('\n');
  const linesB = textB.split('\n');
  const n = linesA.length;
  const m = linesB.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        linesA[i - 1] === linesB[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  type RawOp = { type: 'equal' | 'added' | 'deleted'; line: string; idxA: number; idxB: number };
  const ops: RawOp[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      ops.unshift({ type: 'equal', line: linesA[i - 1], idxA: i - 1, idxB: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', line: linesB[j - 1], idxA: i, idxB: j - 1 });
      j--;
    } else {
      ops.unshift({ type: 'deleted', line: linesA[i - 1], idxA: i - 1, idxB: j });
      i--;
    }
  }

  // Merge consecutive ops into blocks
  const blocks: DiffBlock[] = [];
  let k = 0;
  while (k < ops.length) {
    const op = ops[k];
    if (op.type === 'equal') {
      const startA = op.idxA;
      const startB = op.idxB;
      const linesABlock: string[] = [];
      const linesBBlock: string[] = [];
      while (k < ops.length && ops[k].type === 'equal') {
        linesABlock.push(ops[k].line);
        linesBBlock.push(ops[k].line);
        k++;
      }
      blocks.push({ type: 'equal', linesA: linesABlock, linesB: linesBBlock, startA, startB });
    } else {
      const deletedLines: string[] = [];
      const addedLines: string[] = [];
      let startA = i;
      let startB = j;
      while (k < ops.length && ops[k].type === 'deleted') {
        if (deletedLines.length === 0) startA = ops[k].idxA;
        deletedLines.push(ops[k].line);
        k++;
      }
      while (k < ops.length && ops[k].type === 'added') {
        if (addedLines.length === 0) startB = ops[k].idxB;
        addedLines.push(ops[k].line);
        k++;
      }
      if (deletedLines.length > 0 && addedLines.length > 0) {
        blocks.push({ type: 'changed', linesA: deletedLines, linesB: addedLines, startA, startB });
      } else if (deletedLines.length > 0) {
        blocks.push({ type: 'deleted', linesA: deletedLines, linesB: [], startA, startB });
      } else if (addedLines.length > 0) {
        blocks.push({ type: 'added', linesA: [], linesB: addedLines, startA, startB });
      }
    }
  }

  return blocks;
}

export function diffStats(blocks: DiffBlock[]): { added: number; deleted: number; changed: number } {
  let added = 0;
  let deleted = 0;
  let changed = 0;
  for (const b of blocks) {
    if (b.type === 'added') added += b.linesB.length;
    else if (b.type === 'deleted') deleted += b.linesA.length;
    else if (b.type === 'changed') changed += Math.max(b.linesA.length, b.linesB.length);
  }
  return { added, deleted, changed };
}
