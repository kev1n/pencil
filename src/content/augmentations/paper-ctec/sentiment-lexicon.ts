// Word and phrase tables for the CTEC comment tone scorer (`sentiment.ts`).
//
// Everything here is general course-evaluation vocabulary. Nothing names a
// course, a professor or a subject: an entry that only helps one class's
// comments does not belong. To check a change, score it against labeled
// comments from several courses, not one.

// Words grouped by strength. Positive numbers are praise, negative are
// complaints; 3 is strong ("amazing", "useless"), 1 is mild ("decent",
// "slow").
//
// Deliberately absent, because in course evaluations they describe a class
// rather than judge it: hard, difficult, challenging, demanding, tough, easy.
// "Challenging but rewarding" is praise and "easy A" is not a complaint, so
// difficulty words only count inside a phrase below ("too easy", "hard to
// follow").
const WORD_GROUPS: ReadonlyArray<readonly [number, string]> = [
  [
    3,
    `
      adore adored amazing awesome best blast brilliant captivating coolest delightful
      excellent exceptional fantastic fascinating favorite favourite funniest gem goat
      goated greatest incredible inspirational inspiring joy kindest legend masterful
      nicest outstanding perfect phenomenal stellar superb sweetest wonderful
    `
  ],
  [
    2,
    `
      accessible accommodating approachable attentive beneficial benefited cared cares
      caring charismatic chill clear compelling confident cool dedicated digestible
      doable effective encouraging energetic engaging enjoy enjoyable enjoyed enjoying
      enjoys enlightening entertaining enthusiastic exceeded excited exciting fair
      fascinated flexible forgiving fun funny generous good grateful great happier happy
      helpful hilarious humorous impressed impressive informative insightful inspired
      interesting intriguing intuitive kind knowledgeable laidback lively love loved
      lovely loves manageable memorable organized passionate patient pleasant pleasure
      positive reasonable reassuring recommend recommended responsive rewarding satisfied
      satisfying saved smart smartest stimulating straightforward successful supportive
      sweet thank thanks thoughtful understandable useful valuable welcoming
      wellorganized wellpaced wellprepared wellrun wellstructured wholesome witty
      worthwhile
    `
  ],
  [
    1,
    `
      appreciate appreciated available benefit comfortable decent dynamic easiest energy
      engaged friendly glad helped helping helps humor improved invested learned lenient
      like liked nice practical prepared relaxed relevant rigorous solid steady strong
      structured succeed success thankful thorough thoroughly understanding unique
      willing worth
    `
  ],
  [
    0.5,
    `
      fine
    `
  ],
  [
    -0.5,
    `
      complicated steep tricky
    `
  ],
  [
    -1,
    `
      wish wished
      absent clearer complain complaint complaints confused confusion downside downsides
      drawback dry dull failing flaw flaws insane intimidating issue issues lacking lost
      lostness meh missing mistake monotonous outdated overly picky questionable
      repetitive rough shaky slow stress struggle struggled tangents unable unnecessary
      weak
    `
  ],
  [
    -2,
    `
      mindless mindlessly robotic robotically unforgiving unrealistic unreasonably
      absurd aggravating ambiguous annoyed annoying anxiety anxious arbitrary avoid bad
      biased bland blowoff bored boring brutal bs bummer busywork chaotic chore clunky
      confusing convoluted cried crying cryptic died disappointed disappointing
      discouraged discouraging dislike disliked dislikes dismissive downfall drag dragged
      drained dread dreaded dumb dying excessive exhausting flawed frustrated frustrating
      harsh harshly impossible impractical inadequate inconsistent inconvenient
      ineffective insufficient irrelevant irritated irritating joke lackluster lame lazy
      mediocre mess messy monotone needlessly neglected nitpicky nonsense nonsensical
      overkill overrated overwhelmed overwhelming painful pointless poor poorly
      problematic punishing rambled rambles rambling redundant regret regretted
      ridiculous rushed scattered scrap slog sloppy stressed stressful subpar suck sucked
      sucks sucky suffer suffered suffering tedious ugh unapproachable unavailable
      unclear underwhelming unengaging unenjoyable unfair unfairly unfocused unhelpful
      unhelpfully uninspiring uninteresting unintuitive unmotivated unnecessarily
      unpleasant unprepared unreasonable unresponsive unsatisfying unstructured
      unsupported unsupportive upset vague waste wasted wasting worse worsened yikes
    `
  ],
  [
    -3,
    `
      arrogant atrocious awful belittled belittling bullshit condescending crap crappy
      demoralizing disaster disorganised disorganized disrespectful dreadful garbage hate
      hated hates hell horrible incompetent incomprehensible infuriating joyless
      maddening meaningless miserable nightmare obnoxious patronizing purposeless rude
      stupid terrible torture toxic trash unintelligible unorganised unorganized
      unprofessional unqualified useless worst worthless
    `
  ]
];

export const LEXICON: ReadonlyMap<string, number> = new Map(
  WORD_GROUPS.flatMap(([score, words]) =>
    words
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => [word, score] as const)
  )
);

// A phrase either carries a score of its own, softens the next scored word
// ("kind of annoying"), or is dropped so its words are not scored one by one
// ("a lot of work" is description, and "not too bad" is faint praise that
// readers label neutral).
export const SOFTEN = "soften";
export const IGNORE = "ignore";
export type PhraseEffect = number | typeof SOFTEN | typeof IGNORE;

// Matched against a lowercased sentence with apostrophes removed, before the
// sentence is split into words. A matched phrase becomes a single scored
// unit, so negation and "but" still apply to it ("would not recommend this").
export const PHRASES: ReadonlyArray<readonly [RegExp, PhraseEffect]> = [
  [/\b(?:teach|teaching|taught|learn|learning|learned) (?:it |everything |the material |the content |most of it )?(?:yourself|myself|ourselves|on (?:my|your) own)\b/g, -2],
  [/\bself (?:taught|teach|teaching|study|studying|learn|learning)\b/g, -2],
  [/\b(?:reads?|reading|recit\w+) (?:directly |straight |word for word )?(?:off|from|off of) (?:of )?(?:the |his |her |their )?(?:slides?|notes?|powerpoints?|handouts?|textbook|script)\b/g, -2],
  [/\b(?:could|should|needs? to) (?:have |be |have been )?(?:been )?(?:better|improved|more|clearer|reworked|changed|restructured)\b/g, -1.5],
  [/\b(?:would |highly |definitely |strongly |totally |100 )*recommend(?:ed)? (?:this|the|it|him|her|them|taking|prof|professor|that|anyone|everyone|to anyone|to everyone|for)\b/g, 3],
  [/\b(?:learn(?:ed|t)?|taught (?:me|us)|teaches you|gained?|got|get) (?:so much|a lot|a ton|a great deal|tons|lots)\b/g, 2.5],
  [/\b(?:definitely |must |should |please |highly |just )+take (?:this|it|the|his|her|him)\b/g, 3],
  [/\b(?:take|taking) (?:this|it) (?:class|course)?\s?(?:with|if you can|if you get|if you have the chance)\b/g, 3],
  [/\bone of (?:the|my) (?:best|favorite|favourite|most)\b/g, 3],
  [/\b(?:is|was|hes|shes) (?:a|an|the|literally a|truly a) (?:god|king|queen|legend|goat|gem|saint|angel)\b/g, 3],
  [/\blaid back\b/g, 2],
  [/\bnot (?:a|a big|a huge|much of a) fan\b/g, -2],
  [/\bturned? me off\b/g, -2],
  [/\bbetter off\b/g, -2],
  [/\bnothing new\b/g, -2.5],
  [/\b(?:way |far |much |a bit |a little )?too (?:easy|slow|fast|much|long|many|hard|difficult|quickly|fast paced|simple|basic)\b/g, -1.5],
  [/\b(?:didnt|did not|doesnt|does not|dont|do not) (?:understand|see|know|get) (?:why|how|the point|the benefit|the significance|the purpose)\b/g, -2.5],
  [/\bwaste of (?:time|money|a|my|tuition|credit)\b/g, -3],
  [/\b(?:do not|dont|never|would not|wouldnt|should not|shouldnt) (?:take|bother)\b/g, -3],
  [/\bstay away\b/g, -3],
  [/\bplace out\b/g, -3],
  [/\bnot worth\b/g, -3],
  [/\bno (?:point|reason|idea|clue|sense|use|real world|practical|help)\b/g, -2.5],
  [/\bmakes? no sense\b/g, -2.5],
  [/\ball over the place\b/g, -2.5],
  [/\bhard to (?:follow|understand|read|hear|reach)\b/g, -2],
  [/\bdifficult to (?:follow|understand|read|hear|reach)\b/g, -2],
  [/\beasy to (?:follow|understand|talk to|reach|digest|grasp)\b/g, 2],
  [/\b(?:never|wont|not) (?:use|need) (?:it |this |any of (?:it|this) )?(?:again|ever)\b/g, -2.5],
  [/\b(?:learned|learnt|learn|taught me|got|gained) (?:nothing|very little|little|almost nothing)\b/g, -2.5],
  [/\bfell? asleep\b/g, -1],
  [/\bfall behind\b/g, IGNORE],
  [/\b(?:a lot|lots|tons|too much) of work\b/g, IGNORE],
  [/\bat (?:first|times)\b/g, SOFTEN],
  [/\b(?:kind|sort) of\b/g, SOFTEN],
  [/\bnot (?:too|that|very|so|super|particularly|terribly|all that) (?:bad|hard|difficult|challenging|tough|stressful|demanding|much)\b/g, IGNORE],
  [/\b(?:wasnt|isnt|not) (?:bad|terrible|awful|horrible)\b/g, IGNORE],
  [/\b(?:office hours|peer mentors?|tas?|pms?) (?:are|were|is|was) (?:super |very |really |so |extremely )?(?:helpful|great|amazing|good)\b/g, 2]
];

// "X, but Y": the writer's point is Y.
export const CONTRAST_CUES: ReadonlySet<string> = new Set([
  "but", "however", "nevertheless", "nonetheless"
]);

// "Although X, Y" and "Y, although X": the writer's point is Y either way.
export const CONCESSION_CUES: ReadonlySet<string> = new Set([
  "although", "though", "while", "whereas", "despite"
]);

export const NEGATION_CUES: ReadonlySet<string> = new Set([
  "not", "no", "never", "none", "nothing", "nobody", "neither", "nor", "without",
  "lack", "lacks", "lacked", "hardly", "rarely", "barely", "zero",
  "cant", "cannot", "dont", "didnt", "doesnt", "wasnt", "werent", "isnt", "arent",
  "wont", "couldnt", "shouldnt", "wouldnt", "havent", "hasnt", "aint"
]);

// Multipliers on the next scored word.
export const MODIFIERS: ReadonlyMap<string, number> = new Map([
  ["very", 1.5], ["really", 1.4], ["extremely", 1.7], ["incredibly", 1.6],
  ["super", 1.4], ["highly", 1.4], ["totally", 1.4], ["absolutely", 1.5],
  ["completely", 1.4], ["truly", 1.3], ["quite", 1.2], ["pretty", 1.15],
  ["fairly", 1.1], ["so", 1.3], ["such", 1.2], ["definitely", 1.3],
  ["insanely", 1.6], ["genuinely", 1.3], ["most", 1.3], ["way", 1.3], ["too", 1.3],
  ["especially", 1.2], ["particularly", 1.2],
  ["slightly", 0.6], ["somewhat", 0.7], ["bit", 0.6], ["little", 0.6],
  ["kinda", 0.7], ["sorta", 0.7], ["sometimes", 0.6], ["occasionally", 0.5],
  ["times", 0.7], ["mildly", 0.6], ["relatively", 0.8], ["can", 0.8],
  ["could", 0.8], ["may", 0.8], ["might", 0.7], ["initially", 0.5], ["first", 0.7]
]);
