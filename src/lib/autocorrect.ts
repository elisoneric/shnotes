/**
 * Comprehensive client-side English autocorrect dictionary and rules
 * Handles common typos, contraction apostrophes, and basic capitalization.
 */

export const COMMON_TYPOS: Record<string, string> = {
  // Frequently swapped letters
  teh: "the",
  taht: "that",
  waht: "what",
  wiht: "with",
  thier: "their",
  tiher: "their",
  recieve: "receive",
  recieved: "received",
  recieving: "receiving",
  seperate: "separate",
  seperated: "separated",
  seperation: "separation",
  definately: "definitely",
  untill: "until",
  truely: "truly",
  wierd: "weird",
  beleive: "believe",
  beleived: "believed",
  acheive: "achieve",
  acheived: "achieved",
  goverment: "government",
  enviroment: "environment",
  occurance: "occurrence",
  calender: "calendar",
  accomodate: "accommodate",
  accross: "across",
  begining: "beginning",
  arguement: "argument",
  neccessary: "necessary",
  recommand: "recommend",
  recomended: "recommended",
  tomorrow: "tomorrow",
  tommorrow: "tomorrow",
  suprise: "surprise",
  unfortunatly: "unfortunately",

  // Word pairs & common slips
  alot: "a lot",
  alright: "all right",
  aswell: "as well",
  eachother: "each other",
  everytime: "every time",
  infront: "in front",
  nevermind: "never mind",

  // Contractions (missing apostrophes)
  dont: "don't",
  cant: "can't",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  wouldnt: "wouldn't",
  youre: "you're",
  theyre: "they're",
  weve: "we've",
  youve: "you've",
  theyve: "they've",
  im: "I'm",
  ive: "I've",
  id: "I'd",
  ill: "I'll",
  thats: "that's",
  whats: "what's",
  wheres: "where's",
  hows: "how's",
  theres: "there's",
  heres: "here's",
  lets: "let's",
  itll: "it'll",
  whoever: "whoever",
};

/**
 * Checks the last completed word before a trailing space or punctuation
 * and replaces it if a known typo exists.
 */
export function autoCorrectOnInput(text: string): { text: string; corrected: boolean } {
  // Only trigger when user just typed a separator (space, comma, period, exclamation, question mark, newline)
  const match = text.match(/^(.*?)(\b[a-zA-Z']+)([\s,.;:!?]+)$/s);
  if (!match) {
    return { text, corrected: false };
  }

  const prefix = match[1];
  const targetWord = match[2];
  const trailing = match[3];

  const lowerWord = targetWord.toLowerCase();
  let replacement: string | undefined = undefined;

  // Standalone 'i' correction
  if (targetWord === "i") {
    replacement = "I";
  } else if (COMMON_TYPOS[lowerWord]) {
    const rawReplacement = COMMON_TYPOS[lowerWord];
    // Preserve TitleCase if the user started with an uppercase letter
    if (targetWord[0] === targetWord[0].toUpperCase() && targetWord[0] !== targetWord[0].toLowerCase()) {
      replacement = rawReplacement.charAt(0).toUpperCase() + rawReplacement.slice(1);
    } else {
      replacement = rawReplacement;
    }
  }

  if (replacement && replacement !== targetWord) {
    return {
      text: prefix + replacement + trailing,
      corrected: true,
    };
  }

  return { text, corrected: false };
}

/**
 * Full rule-based clean-up of a text paragraph or title
 */
export function fixFullTextRuleBased(input: string): { corrected: string; count: number } {
  if (!input) return { corrected: input, count: 0 };

  let text = input;
  let count = 0;

  // 1. Standalone 'i' -> 'I'
  text = text.replace(/\bi\b/g, () => {
    count++;
    return "I";
  });

  // 2. Common typos replacement
  text = text.replace(/\b([a-zA-Z']+)\b/g, (match) => {
    const lower = match.toLowerCase();
    if (COMMON_TYPOS[lower]) {
      count++;
      const rep = COMMON_TYPOS[lower];
      if (match[0] === match[0].toUpperCase()) {
        return rep.charAt(0).toUpperCase() + rep.slice(1);
      }
      return rep;
    }
    return match;
  });

  // 3. Remove repeated words like "the the", "and and"
  text = text.replace(/\b(the|and|in|on|at|that|is|of)\s+\1\b/gi, (match, word) => {
    count++;
    return word;
  });

  // 4. Capitalize first letter after sentence-ending punctuation (. ! ?)
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (match, sep, char) => {
    count++;
    return sep + char.toUpperCase();
  });

  return { corrected: text, count };
}
