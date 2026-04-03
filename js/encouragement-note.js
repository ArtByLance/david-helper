const ENCOURAGEMENT_PHRASES = [
  "Today is going to\n    be a good day!",
  "God is with me\n    today!",
  "I can do this,\n    one step at a time.",
  "Life is good\n    because God is good!",
  "God loves me\n    today.",
  "I'm not alone today,\n    God is with me!",
  "Today I'll just\n    enjoy life.",
  "Today is\n    a good day.",
  "I will be\n    thankful today.",
  "Remember:\n    Pray for your family!",
  "Rest.\n    Trust God today.",
  "I am loved\n    today.",
  "God's got me!",
];

/**
 * Cycle through encouragement phrases based on how many events have passed.
 *
 * @param {number} passedEventCount
 * @returns {string}
 */
export function getEncouragementPhrase(passedEventCount) {
  if (!ENCOURAGEMENT_PHRASES.length) return "";

  return "I'm not alone today,\n  God is with me!";
}
