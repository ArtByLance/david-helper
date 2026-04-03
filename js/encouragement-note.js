const ENCOURAGEMENT_PHRASES = [
  "Today is going to\nbe a good day",
  "God is with me\ntoday",
  "I can do this\none step at a time",
  "Life is good\nbecause God is good",
  "God loves me\ntoday",
  "Im not alone today\nGod is with me",
  "Today Ill just\nenjoy life",
  "Today is\na good day",
  "I will be\nthankful today",
  "Remember\nPray for your family",
  "Rest\nTrust God today",
  "I am loved today",
  "Gods got me",
];

/**
 * Pick today's encouragement note.
 *
 * The note advances when another schedule item is behind us.
 * Once we reach the end of the list, we loop back around instead of trying to
 * get clever. A simple little wheel is plenty here.
 *
 * @param {number} passedEventCount
 * @returns {string}
 */
export function getEncouragementPhrase(passedEventCount) {
  if (!ENCOURAGEMENT_PHRASES.length) return "";

  const safeCount = Math.max(0, Math.floor(passedEventCount || 0));
  const index = safeCount % ENCOURAGEMENT_PHRASES.length;
  return ENCOURAGEMENT_PHRASES[index];
}
