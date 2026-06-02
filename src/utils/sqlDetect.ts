export type SqlDialect = 'sql' | 'mysql' | 'postgresql' | 'sqlite' | 'tsql' | 'plsql';

export interface SqlDetectResult {
  dialect: SqlDialect;
  label: string;
  confidence: 'high' | 'low';
}

export function detectSqlDialect(sql: string): SqlDetectResult {
  const s = sql.toLowerCase();

  // T-SQL — SQL Server
  if (
    /\bdeclare\s+@/.test(s) ||
    /\bnvarchar\b/.test(s) ||
    /\bidentity\s*\(/.test(s) ||
    /\btop\s+\d+\b/.test(s) ||
    /\bnocount\b/.test(s) ||
    /\bgo\b/.test(s)
  ) return { dialect: 'tsql', label: 'T-SQL', confidence: 'high' };

  // PL/SQL — Oracle
  if (
    /\bbegin\b.*\bend\b/s.test(s) ||
    /\bpragma\b/.test(s) ||
    /\bdbms_\w+/.test(s) ||
    /\bsysdate\b/.test(s) ||
    /\brownum\b/.test(s) ||
    /\bexception\b/.test(s)
  ) return { dialect: 'plsql', label: 'PL/SQL', confidence: 'high' };

  // PostgreSQL
  if (
    /\bserial\b/.test(s) ||
    /\bbigserial\b/.test(s) ||
    /\breturning\b/.test(s) ||
    /\bilike\b/.test(s) ||
    /\bjsonb?\b/.test(s) ||
    /::[\w]+/.test(s) ||
    /\$\d+/.test(s)
  ) return { dialect: 'postgresql', label: 'PostgreSQL', confidence: 'high' };

  // MySQL
  if (
    /\bauto_increment\b/.test(s) ||
    /`[^`]+`/.test(s) ||
    /\blimit\s+\d+\s*,\s*\d+/.test(s) ||
    /\bengine\s*=/.test(s) ||
    /\bunsigned\b/.test(s)
  ) return { dialect: 'mysql', label: 'MySQL', confidence: 'high' };

  // SQLite
  if (
    /\bautoincrement\b/.test(s) ||
    /\bwithout\s+rowid\b/.test(s) ||
    /\bstrict\b/.test(s)
  ) return { dialect: 'sqlite', label: 'SQLite', confidence: 'high' };

  return { dialect: 'sql', label: 'SQL', confidence: 'low' };
}
