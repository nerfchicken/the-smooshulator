/**
 * Profanity / awkward-substring guard for generated words.
 *
 * Portmanteau blends can accidentally spell something a 9-year-old will
 * gleefully show the whole class (`dinosaur + trex -> Dinosex`), and typed
 * words leak into mash modifiers. `isBanned` is a substring check per word,
 * with a short allowlist of ordinary words that happen to contain a root
 * ("Knight", "Glass", "Cucumber") so curated content keeps working.
 */

export const BANNED_SUBSTRINGS: readonly string[] = [
  'sex', 'ass', 'tit', 'cum', 'dick', 'cock', 'fag', 'nig', 'poon', 'fuk', 'fuc',
  'shit', 'piss', 'wank', 'boob', 'anal', 'rape', 'kkk', 'nazi',
];

/** A word is safe if it *starts with* one of these (so "Grassy", "Nightly" pass). */
export const SAFE_PREFIXES: readonly string[] = [
  'night', 'knight', 'midnight', 'jurassic', 'glass', 'grass', 'class', 'pass', 'bass', 'mass',
  'sassy', 'cucumber', 'title', 'stitch', 'canal', 'compass', 'assistant', 'titan', 'cassette',
  'lasso', 'embassy', 'potassium', 'cockatoo', 'peacock', 'hancock', 'scum', 'circumference',
];

const tokens = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0);

/** True when any word of `text` contains a banned substring (allowlist aside). */
export function isBanned(text: string): boolean {
  return tokens(text).some(
    (t) => BANNED_SUBSTRINGS.some((b) => t.includes(b)) && !SAFE_PREFIXES.some((s) => t.startsWith(s)),
  );
}
