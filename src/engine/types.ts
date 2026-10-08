export type Card = {
  id: string;            // "blanket"
  word: string;          // "Blanket"
  emoji: string;         // "🛏️"  (one or two emoji; composite rendered by UI)
  tags: string[];        // ["soft", "warm", "bedtime"]
  modifiers: string[];   // words this card contributes when it modifies another:
                         // blanket -> ["Snuggle", "Cozy", "Snuggly"]
  nounForms?: string[];  // optional alt nouns: daddy -> ["Daddy", "Dad"]
  flavor?: string;       // one-liner shown on the card
  base: boolean;         // starting card vs discovered
};

export type Recipe = {
  inputs: [string, string];   // card ids, order-independent
  result: { word: string; emoji: string; flavor: string; tags?: string[]; modifiers?: string[] };
};
