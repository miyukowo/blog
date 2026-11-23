/**
 * Cloudflare Pages `_headers` scope policy (review follow-up Task 3).
 *
 * The previous marker/validator pair searched the whole file for
 * `X-Robots-Tag: noindex`, so a scoped `/cms/*` rule (or a comment) was
 * accepted as global preview protection. This module parses the actual rules
 * and answers one question: does an effective catch-all `/*` rule set noindex?
 *
 * A rule is a non-indented path pattern followed by indented `Name: value`
 * lines. `#` lines are comments. `! Name: value` is an unset/removal directive;
 * because Cloudflare merges duplicate path blocks, an unset of
 * `X-Robots-Tag` on a catch-all block is treated conservatively as breaking
 * global noindex protection rather than as harmless.
 */

/** Directives that mean "do not index this response". */
const NOINDEX_TOKENS = new Set(['noindex', 'none']);

/** True when a path pattern is the site-wide catch-all. */
export function isCatchAllHeaderPattern(pattern) {
  return pattern.trim() === '/*';
}

/**
 * Parse `_headers` text into ordered rules.
 *
 * @returns {Array<{ pattern: string, line: number, headers: Array<{ name: string, value: string, unset: boolean, line: number }> }>}
 */
export function parseHeaderRules(text) {
  const rules = [];
  let current;

  for (const [index, rawLine] of String(text).split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    if (!/^\s/.test(rawLine)) {
      current = { pattern: trimmed, line: lineNumber, headers: [] };
      rules.push(current);
      continue;
    }

    if (!current) continue;
    const match = /^\s*(!?)\s*([^:]+):\s*(.*)$/.exec(rawLine);
    if (!match) continue;
    current.headers.push({
      unset: match[1] === '!',
      name: match[2].trim().toLowerCase(),
      value: match[3].trim(),
      line: lineNumber,
    });
  }

  return rules;
}

/** Split an X-Robots-Tag value into lowercase directive tokens. */
export function robotsDirectiveTokens(value) {
  return String(value)
    .toLowerCase()
    .split(/[\s,;]+/)
    .filter((token) => token.length > 0);
}

/**
 * Interpret the X-Robots-Tag headers of one rule.
 *
 * @returns {'noindex' | 'unset' | 'index' | 'absent'}
 */
export function ruleNoindexState(rule) {
  const directives = (rule?.headers ?? []).filter((header) => header.name === 'x-robots-tag');
  if (directives.length === 0) return 'absent';
  if (directives.some((directive) => directive.unset)) return 'unset';

  const tokens = directives.flatMap((directive) => robotsDirectiveTokens(directive.value));
  if (tokens.some((token) => NOINDEX_TOKENS.has(token))) return 'noindex';
  if (tokens.includes('index')) return 'index';
  return 'absent';
}

/**
 * True only when an effective catch-all `/*` rule sets noindex and no
 * catch-all rule unsets the header. Scoped rules and comments never qualify.
 */
export function hasGlobalNoindex(text) {
  const catchAllRules = parseHeaderRules(text).filter((rule) =>
    isCatchAllHeaderPattern(rule.pattern),
  );
  if (catchAllRules.length === 0) return false;
  if (catchAllRules.some((rule) => ruleNoindexState(rule) === 'unset')) return false;
  return catchAllRules.some((rule) => ruleNoindexState(rule) === 'noindex');
}
