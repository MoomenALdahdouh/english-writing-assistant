import type { DiffToken } from '../diff/tokenDiff';
import { buildHistoryDiffTokens } from '../diff/tokenDiff';
import type { HistoryItem } from '../storage/settings';

export function HistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ul className="history">
      {items.map((item) => (
        <li key={item.id}>
          <HistoryEntry item={item} />
        </li>
      ))}
    </ul>
  );
}

function HistoryEntry({ item }: { item: HistoryItem }) {
  const same = item.original === item.corrected;
  if (same) {
    return (
      <article className="hist-entry hist-same">
        <p className="hist-text">“{displayText(item.corrected)}”</p>
        <span className="hist-badge">No changes</span>
      </article>
    );
  }

  const tokens = buildHistoryDiffTokens(item.original, item.corrected);
  const editCount = countEdits(tokens);

  return (
    <article className="hist-entry">
      <p className="hist-text" aria-label={`Corrected: ${item.corrected}. Original: ${item.original}`}>
        “
        {tokens.map((token, i) => (
          <DiffMark key={`${i}-${token.type}-${token.value}`} token={token} />
        ))}
        ”
      </p>
      <div className="hist-meta">
        <span className="hist-badge edits">
          {editCount} {editCount === 1 ? 'edit' : 'edits'}
        </span>
        <span className="hist-was" title={item.original}>
          Was: “{displayText(item.original, 48)}”
        </span>
      </div>
    </article>
  );
}

function DiffMark({ token }: { token: DiffToken }) {
  if (token.type === 'equal') {
    return <span>{token.value}</span>;
  }
  if (token.type === 'delete') {
    return (
      <span className={`hist-mark wrong ${token.changeType ?? 'spelling'}`} title="Removed">
        {token.value}
      </span>
    );
  }
  // insert / replace → show the fix
  return (
    <span className={`hist-mark fix ${token.changeType ?? 'wording'}`} title="Corrected">
      {token.value}
    </span>
  );
}

function countEdits(tokens: DiffToken[]): number {
  let n = 0;
  for (const t of tokens) {
    if (t.type === 'equal') continue;
    n += 1;
  }
  return Math.max(1, n);
}

function displayText(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
