/**
 * Portmanteau blending for typed words the game doesn't know.
 *
 * Implements the vowel-boundary algorithm from docs/research.md §5:
 *   head(A) = A up to the start of its last vowel group (if it has ≥ 2)
 *   tail(B) = B from its first vowel group (if head ends in a consonant),
 *             or from the first consonant after its first vowel group
 *             (if head ends in a vowel)
 * with guards for short words, vowel-less words, triple letters and
 * degenerate joins. Multi-word inputs blend A's last word with B's first.
 */

const MAX_WORDS = 3;

/** lowercase, strip diacritics, keep a-z only */
function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
}

/** Split on whitespace/hyphens, normalize each piece, drop empties. */
function words(text: string): string[] {
  return text
    .split(/[\s\-_]+/)
    .map(normalize)
    .filter((w) => w.length > 0);
}

/** `y` counts as a vowel unless it is word-initial. */
function isVowel(word: string, i: number): boolean {
  const c = word[i];
  if ('aeiou'.includes(c)) return true;
  return c === 'y' && i > 0;
}

type Group = { start: number; end: number }; // [start, end)

function vowelGroups(word: string): Group[] {
  const groups: Group[] = [];
  let i = 0;
  while (i < word.length) {
    if (isVowel(word, i)) {
      const start = i;
      while (i < word.length && isVowel(word, i)) i++;
      groups.push({ start, end: i });
    } else {
      i++;
    }
  }
  return groups;
}

function endsInVowel(word: string): boolean {
  return word.length > 0 && isVowel(word, word.length - 1);
}

/** Guard: words < 3 letters or with no vowels are used whole. */
function usedWhole(word: string): boolean {
  return word.length < 3 || vowelGroups(word).length === 0;
}

function head(a: string): string {
  if (usedWhole(a)) return a;
  let word = a;
  let groups = vowelGroups(word);
  // Silent e: consonant + e at the end, with ≥ 2 vowel groups.
  if (groups.length >= 2 && word.endsWith('e') && !isVowel(word, word.length - 2)) {
    word = word.slice(0, -1);
    groups = vowelGroups(word);
  }
  if (groups.length >= 2) return word.slice(0, groups[groups.length - 1].start);
  return word;
}

/**
 * Returns the tail of B plus a possibly-trimmed head (the "bee" case drops
 * the head's trailing vowel group).
 */
function tail(headWord: string, b: string): { head: string; tail: string } {
  if (usedWhole(b)) return { head: headWord, tail: b };
  const groups = vowelGroups(b);
  const first = groups[0];
  if (!endsInVowel(headWord)) return { head: headWord, tail: b.slice(first.start) };
  // Head ends in a vowel: take B from the first consonant after its first vowel group.
  if (first.end < b.length) return { head: headWord, tail: b.slice(first.end) };
  // No consonant after the first vowel group ("bee"): drop B's leading
  // consonant cluster and the head's trailing vowel group.
  const headGroups = vowelGroups(headWord);
  const trimmedHead = headGroups.length
    ? headWord.slice(0, headGroups[headGroups.length - 1].start)
    : headWord;
  return { head: trimmedHead, tail: b.slice(first.start) };
}

function collapseTriples(word: string): string {
  return word.replace(/(.)\1{2,}/g, '$1$1');
}

/** Blend two single normalized words. */
function blendWords(a: string, b: string): string {
  const h = head(a);
  const t = tail(h, b);
  const joined = collapseTriples(t.head + t.tail);
  if (joined.length < 4 || joined === a || joined === b) return collapseTriples(a + b);
  return joined;
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Blend two words (or phrases) into a new Title Case word. Always returns a
 * non-empty string. Order matters: `a` supplies the head.
 */
export function makePortmanteau(a: string, b: string): string {
  const aWords = words(a);
  const bWords = words(b);
  if (aWords.length === 0 && bWords.length === 0) return 'Smoosh';
  if (aWords.length === 0) return bWords.slice(0, MAX_WORDS).map(titleCase).join(' ');
  if (bWords.length === 0) return aWords.slice(0, MAX_WORDS).map(titleCase).join(' ');

  const lead = aWords.slice(0, -1);
  const trail = bWords.slice(1);
  const blend = blendWords(aWords[aWords.length - 1], bWords[0]);

  // Cap at MAX_WORDS: drop B's trailing words first, then A's leading words.
  const out = [...lead, blend, ...trail];
  while (out.length > MAX_WORDS) {
    if (out.length - 1 > lead.length) out.pop();
    else {
      out.shift();
      lead.shift();
    }
  }
  return out.map(titleCase).join(' ');
}
