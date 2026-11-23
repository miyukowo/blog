/**
 * Unit tests for the shared `_headers` scope policy (follow-up Task 3).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hasGlobalNoindex,
  isCatchAllHeaderPattern,
  parseHeaderRules,
  robotsDirectiveTokens,
  ruleNoindexState,
} from '../../scripts/header-policy.mjs';

test('a scoped /cms/* noindex rule is not global protection', () => {
  const headers = [
    '/cms/*',
    '  X-Robots-Tag: noindex',
    '',
    '/*',
    '  Cache-Control: no-store',
    '',
  ].join('\n');
  assert.equal(hasGlobalNoindex(headers), false);
});

test('a comment mentioning noindex is not protection', () => {
  assert.equal(hasGlobalNoindex('# X-Robots-Tag: noindex\n/*\n  Cache-Control: no-store\n'), false);
});

test('an unrelated catch-all header is not protection', () => {
  assert.equal(hasGlobalNoindex('/*\n  Cache-Control: public, max-age=0\n'), false);
});

test('the noindexing token is not the noindex directive', () => {
  assert.equal(hasGlobalNoindex('/*\n  X-Robots-Tag: noindexing\n'), false);
  assert.equal(hasGlobalNoindex('/*\n  X-Robots-Tag: noindex, nofollow\n'), true);
  assert.equal(hasGlobalNoindex('/*\n  X-Robots-Tag: none\n'), true);
});

test('an effective catch-all noindex rule is global protection', () => {
  const headers = [
    '/_astro/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/*',
    '  Cache-Control: public, max-age=0, must-revalidate',
    '',
    '/*',
    '  X-Robots-Tag: noindex, nofollow',
    '',
  ].join('\n');
  assert.equal(hasGlobalNoindex(headers), true);
});

test('a catch-all unset of X-Robots-Tag invalidates protection conservatively', () => {
  const headers = [
    '/*',
    '  X-Robots-Tag: noindex, nofollow',
    '',
    '/*',
    '  ! X-Robots-Tag: noindex',
    '',
  ].join('\n');
  assert.equal(hasGlobalNoindex(headers), false);
});

test('header parsing keeps ordered scopes and comments out of the rule set', () => {
  const rules = parseHeaderRules(
    ['# comment', '/cms/*', '  X-Robots-Tag: noindex', '  ! X-Robots-Tag: noindex', ''].join('\n'),
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].pattern, '/cms/*');
  assert.equal(rules[0].headers.length, 2);
  assert.equal(ruleNoindexState(rules[0]), 'unset');
  assert.equal(isCatchAllHeaderPattern(' /* '), true);
  assert.equal(isCatchAllHeaderPattern('/cms/*'), false);
});

test('robots directive tokens split on comma, whitespace and semicolons', () => {
  assert.deepEqual(robotsDirectiveTokens('noindex, nofollow; max-snippet:-1'), [
    'noindex',
    'nofollow',
    'max-snippet:-1',
  ]);
});
