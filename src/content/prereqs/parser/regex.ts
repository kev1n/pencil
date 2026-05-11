// Ported regex constants. Python re.match is anchored, so we prepend `^`
// when porting; Python re.search/fullmatch translate to RegExp.test/exec
// at the call site.

export const COURSE_RE =
  /\b([A-Za-z][A-Za-z_]{1,})\s+(\d{3})(?:-([A-Za-z0-9]+))?\b/;
export const COURSE_RE_G =
  /\b([A-Za-z][A-Za-z_]{1,})\s+(\d{3})(?:-([A-Za-z0-9]+))?\b/g;
export const COURSE_RE_FULL =
  /^([A-Za-z][A-Za-z_]{1,})\s+(\d{3})(?:-([A-Za-z0-9]+))?$/;

export const NUMBER_ONLY_RE = /^\s*(\d{3})(?:-([A-Z0-9]+))?\s*$/;

export const NONE_RE = /^\s*none[\s.]*$/i;

export const STANDING_RE =
  /\b(freshman|sophomore|junior|senior|graduate|graduate[- ]level|first[- ]?year|second[- ]?year|advanced)\b(?:\s+(?:engineering|medill|kellogg|bienen|weinberg|mccormick|sesp|communication))?\s+(?:standing|status)\b/i;

export const STANDING_OR_ABOVE_RE =
  /\b(freshman|sophomore|junior|senior)\s+or\s+(above|higher)\b/i;

export const BARE_STANDING_RE =
  /^(?:reserved\s+for\s+)?(freshmen|sophomores|juniors|seniors|graduates|freshman|sophomore|junior|senior|graduate|advanced\s+students?)\s*(?:and\s+(freshmen|sophomores|juniors|seniors|graduates))?$/i;

export const LEVEL_OR_HIGHER_RE = /\b(\d)00\s*-?level\s+or\s+(?:above|higher)\b/i;

export const NUM_LIST_PREFIX_RE = /^\(\s*\d+\s*\)\s*/;

export const CONDITIONAL_RE =
  /^(non[- ])?(medill|mccormick|kellogg|bienen|weinberg|sesp|communication|isp|mmss|kaplan|wcas|engineering|graduate|undergraduate|honors)(?:\s+[A-Za-z][\w-]*){0,4}\s+students?,?\s+([^;]+)$/i;

export const GRADE_RE = /\b([A-D][+\-]?|P)\s*(?:or\s+(?:better|higher|above))\b/i;

export const EQUIV_RE = /\bor\s+equivalent\b/i;

export const CONSENT_INSTRUCTOR_RE =
  /\b(consent|permission|approval)\s+of\s+(?:the\s+)?instructor\b|\binstructor\s+(consent|permission|approval)\b/i;

export const CONSENT_DEPT_RE =
  /\b(consent|permission|approval)\s+of\s+(?:the\s+)?(?:[\w-]+\s+){0,3}(?:department|chair|director|coordinator|advisor|adviser|program)\b|\bdepartment(?:al)?\s+consent\b/i;

export const CONSENT_ADVISER_RE = /\bconsent\s+of\s+(program\s+)?advise[rn]\b/i;

export const CONSENT_FACULTY_RE = /\bfaculty\s+(permission|consent|approval)\b/i;

export const DEPT_APPROVAL_RE = /\bdepartment(?:al)?\s+(approval|permission)\b/i;

export const APPLICATION_RE =
  /\bby\s+application(?:\s+only)?\b|\bapplication\s+required\b|\bsubmission\s+of\s+(?:a\s+)?petition\b|\bby\s+invitation\b|^invitation$/i;

export const PLACEMENT_RE =
  /\bplacement\s+(?:exam|test|score|results)\b|\bqualifying\s+score\b|\bdepartment(?:al)?\s+placement(?:\s+exam)?\b|\bplacement\s+by\s+exam\b|\bbased\s+on\s+(?:test\s+)?placement\b/i;

export const AP_RE = /\bAP\s+(?:exam|score|credit)\b/i;

export const PROGRAM_ENROLL_RE =
  /\b(?:students?\s+(?:must\s+be\s+)?enrolled\s+in|enrollment\s+in|admission\s+to|admitted\s+to|reserved\s+(?:exclusively\s+)?for)\s+(?:the\s+)?(.+?)(?:\s+to\s+register|\.|$|,)/i;

export const LEVEL_WILD_RE =
  /\b(?:any\s+)?(\d)00\s*[-\s]*(?:or\s+(\d)00\s*[-\s]*)?level\b\s+(.+?)\s+(course|class)\b/i;

export const ANY_LEVEL_NO_COURSE_RE = /^any\s+(\d)00\s*-?level\s+course\s+in\s+(.+?)$/i;

export const COUNT_LEVEL_RE =
  /\b(one|two|three|four|1|2|3|4)\s+(\d)00\s*[-\s]*(?:or\s+(\d)00\s*[-\s]*)?level\b\s+(?:course|courses)\s+in\s+(.+?)(?:\.|$|,)/i;

export const GPA_RE =
  /\b(?:(?:a|min(?:imum)?|at\s+least)\s+)?(\d(?:\.\d{1,2})?)\s*(?:cumulative\s+)?GPA\b|\bGPA\s+(?:of\s+)?(?:at\s+least\s+)?(\d(?:\.\d{1,2})?)\b/i;

export const RECOMMENDED_RE = /\brecommended\b/i;

export const CONCURRENT_ALLOWED_RE =
  /concurrent\s+registration\s+in\s+(.+?)\s+is\s+(?:acceptable|allowed)/i;

export const CONCURRENT_REQUIRED_RE =
  /(?:must\s+be\s+taken|should\s+be\s+taken|taken|may\s+be\s+taken)\s+concurrently\s+with\s+([A-Z][A-Z_]+\s+\d{3}(?:-[A-Z0-9]+)?(?:\s*(?:,|\s+and|\s+or)\s+(?:[A-Z][A-Z_]+\s+)?\d{3}(?:-[A-Z0-9]+)?)*)/i;

export const VARY_RE = /\bvary\b/i;

export const WORD_COUNT: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4
};

export const MULTI_LEVEL_WILDCARD_RE =
  /\b(\d)00\s*-?(?:\s*or\s+(\d)00\s*-?)?\s*level\s+((?:[A-Za-z][\w-]*)(?:\s+or\s+[A-Za-z][\w-]*){1,4})\s+(?:course|class)\b/gi;

export const EQUIV_TOPIC_RE = /^equivalents?(?:\s+\w+){0,5}\.?$/i;

export const OR_ABOVE_TOPIC_RE = /^(above|higher)\.?$/i;

export const BARE_INSTRUCTOR_TOPIC_RE = /^instructor\.?$/i;

export const WHOLE_STANDING_RE =
  /^(senior|junior|sophomore|freshman|graduate(?:[- ]level)?|advanced|first[- ]?year|second[- ]?year)(?:\s+or\s+(senior|junior|sophomore|freshman|graduate|advanced|first[- ]?year|second[- ]?year))?\s+(?:standing|status)(?:\s+in\s+(?:the\s+)?(.+?))?\.?$/i;

export const GRADE_OF_RE =
  /^grade\s+of\s+(?:at\s+least\s+)?([A-D][+\-]?)(?:\s+or\s+(?:better|higher|above))?\s+in\s+(.+)$/i;

export const ONE_COURSE_FROM_RE = /^(?:1|one)\s+course\s+(?:from|in)\s+(.+)$/i;

// Wrapper patterns stripped from the start before parsing. Captured grade
// groups feed `leadingGrade` in stripProse.
export const WRAPPER_PATTERNS: RegExp[] = [
  /^students\s+must\s+have\s+completed,?\s+with\s+a\s+([A-D][+\-]?)\s*or\s+better,?\s*/i,
  /^grade\s+of\s+([A-D][+\-]?)\s*or\s+(?:better|higher|above)\s+in\s+/i,
  /^([A-D][+\-]?)\s+or\s+(?:better|higher|above)\s+in\s+/i,
  /^students?\s+must\s+have\s+completed,?\s*/i,
  /^students?\s+(?:must|should)\s+have\s+/i,
  /^prerequisites?:\s*/i,
  /^pre-requisites?:\s*/i,
  /^prereqs?:\s*/i
];

export const TRAIL_PATTERNS: RegExp[] = [
  /\s+to\s+register\s+for\s+this\s+course\.?$/i,
  /\s+to\s+enroll\s+in\s+this\s+course\.?$/i,
  /\.\s*may\s+not\s+receive\s+credit\s+for\s+both.*$/i,
  /\.\s*credit\s+not\s+given\s+for\s+both.*$/i,
  /\.\s*students?\s+who\s+have\s+taken.*$/i,
  /\.\s*should\s+not\s+take.*$/i,
  /\.\s*[^.]*may\s+be\s+repeated.*$/i,
  /\.\s*credit\s+(?:may\s+not|cannot|not\s+allowed)\s+(?:be\s+)?(?:earned|received|for\s+both).*$/i,
  /\bcredit\s+not\s+allowed\s+for\s+both.*$/i,
  /\bcredit\s+not\s+given\s+for\s+both.*$/i,
  /\.\s*prerequisites?:\s*.*$/i,
  /[\s.,;]*additional\s+prerequisites?\s+may\s+apply\.?$/i,
  /[\s.,;]*may\s+be\s+repeated.*$/i,
  /[\s.,;]*may\s+not\s+be\s+repeated.*$/i,
  /[\s.,;]+may\s+not\s+receive\s+credit\s+for\s+both.*$/i,
  /[\s.,;]+may\s+be\s+taken\s+with\s+instructor\s+approval\.?$/i,
  /[\s.,;]+carries\s+business\s+credit\.?$/i,
  /[\s.,;]+taught\s+with\s+[A-Z][A-Z_]+\s+\d{3}.*$/i,
  /\s+\d+\s+quarters?\s+before\s+registration\b/i,
  /\s+for\s+participants\s+in\s+the\s+[^.]*?\s+program(?:\s+only)?\.?$/i
];
