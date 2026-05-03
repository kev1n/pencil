// Snapshot of which CAESAR career (school) catalogues each subject. Pulled
// from the CTEC search dropdowns (May 2026). When NU adds/removes a subject
// or school, paste the refreshed dropdown lists into SCHOOL_SUBJECTS — the
// inverted lookup and the priority handling pick it up automatically.
//
// CSRM (Consortium) is intentionally absent: NU never gave us a subject
// catalog for it, and in practice it mirrors host departments. Users who
// need it can pick it explicitly from the popup dropdown.

export const SCHOOL_SUBJECTS: Record<string, readonly string[]> = {
  // Undergraduate (the big one)
  UGRD: [
    "AAL", "AFST", "AF_AM_ST", "ALT_CERT", "AMER_ST", "AMES", "ANIM_ART",
    "ANTHRO", "ARABIC", "ART", "ART_HIST", "ASIAN_AM", "ASIAN_LC", "ASIAN_ST",
    "ASTRON", "BIOL_SCI", "BLK_ST", "BMD_ENG", "BUS_INST", "CAT", "CFS",
    "CHEM", "CHEM_ENG", "CHINESE", "CHRCH_MU", "CIV_ENG", "CIV_ENV",
    "CLASSICS", "CMN", "COG_SCI", "COMM_SCI", "COMM_ST", "COMP_ENG",
    "COMP_LIT", "COMP_SCI", "CONDUCT", "COOP", "CRDV", "CSD", "DANCE",
    "DATA_ENG", "DSGN", "EARTH", "ECE", "ECON", "EDIT", "EECS", "ELEC_ENG",
    "ENGLISH", "ENTREP", "ENVR_POL", "ENVR_SCI", "EPICS", "ES_APPM",
    "EUR_ST", "EUR_TH", "FRENCH", "GBL_HLTH", "GEN_CMN", "GEN_ENG", "GEN_LA",
    "GEN_MUS", "GEN_SPCH", "GEOG", "GEOL_SCI", "GERMAN", "GNDR_ST", "GREEK",
    "HDC", "HDPS", "HEBREW", "HINDI", "HIND_URD", "HISTORY", "HUM", "IDEA",
    "IEMS", "IMC", "INTG_ART", "INTG_SCI", "INTL_ST", "ISEN", "ITALIAN",
    "JAPANESE", "JAZZ_ST", "JOUR", "JWSH_ST", "KELLG_CP", "KELLG_FE",
    "KELLG_MA", "KOREAN", "LATIN", "LATINO", "LATIN_AM", "LDRSHP",
    "LEGAL_ST", "LING", "LOC", "LRN_DIS", "LRN_SCI", "MATH", "MAT_SCI",
    "MECH_ENG", "MENA", "MFG_ENG", "MMSS", "MUSIC", "MUSICOL", "MUSIC_ED",
    "MUS_COMP", "MUS_TECH", "MUS_THRY", "NEUROSCI", "NICO", "PERF_ST",
    "PERSIAN", "PHIL", "PHYSICS", "PIANO", "POLISH", "POLI_SCI", "PORT",
    "PRDV", "PSYCH", "RELIGION", "RTVF", "RUSSIAN", "SESP", "SHC", "SLAVIC",
    "SOCIOL", "SOC_POL", "SPANISH", "SPCH", "STAT", "STRINGS", "SWAHILI",
    "TEACH_ED", "THEATRE", "TRANS", "TURKISH", "URBAN_ST", "VOICE",
    "WIND_PER", "WM_ST", "WRITING", "YIDDISH"
  ],

  // The Graduate School
  TGS: [
    "AAL", "ACCT", "AFST", "AF_AM_ST", "ANIM_ART", "ANTHRO", "APP_PHYS",
    "ART", "ART_HIST", "ASIAN_LC", "ASTRON", "AUD", "BIOETHIC", "BIOL_SCI",
    "BIOSTAT", "BLK_ST", "BMD_ENG", "CFS", "CHEM", "CHEM_ENG", "CHSS", "CIS",
    "CIV_ENG", "CIV_ENV", "CLASSICS", "CLIN_PSY", "CME", "CMN", "COG_SCI",
    "COMM_SCI", "COMM_ST", "COMP_ENG", "COMP_LIT", "COMP_SCI", "CONDUCT",
    "COUN", "COUN_PSY", "CRD", "CRDV", "CSD", "CSD_INTR", "DANCE",
    "DATA_SCI", "DECS", "DGP", "DSGN", "EARTH", "ECE", "ECON", "EECS",
    "ELEC_ENG", "ENGLISH", "ENTR", "ENTREP", "ENVR_POL", "EPI_BIO",
    "ES_APPM", "FINC", "FRENCH", "GAMS", "GBL_HLTH", "GENET_CN", "GEN_ENG",
    "GEOG", "GEOL_SCI", "GERMAN", "GNDR_ST", "GREEK", "HBMI", "HDPS", "HDSP",
    "HISTORY", "HQS", "HSIP", "HSR", "HUM", "IBIS", "IDEA", "IEMS", "IGP",
    "INTL", "IPLS", "ISEN", "ITALIAN", "KPHD", "LATIN", "LATINO", "LATIN_AM",
    "LDRSHP", "LEGAL_ST", "LING", "LIT", "LOC", "LRN_DIS", "LRN_SCI", "MATH",
    "MAT_SCI", "MCW", "MDVL_ST", "MECH_ENG", "MECN", "MECS", "MEM", "MENA",
    "MGMT", "MHB", "MKTG", "MORS", "MPPA", "MSAI", "MSC", "MSCI", "MSTP",
    "MS_ED", "MS_FT", "MTS", "MUSIC", "MUSICOL", "MUSIC_ED", "MUS_COMP",
    "MUS_GRD", "MUS_TECH", "MUS_THRY", "NEUROBIO", "NEUROSCI", "NICO",
    "NUIN", "OPNS", "PBC", "PERF_ST", "PHIL", "PHYSICS", "POLI_SCI", "PORT",
    "PROF_DEV", "PROJ_MGT", "PSED", "PSYCH", "PUB_HLTH", "QSB", "RELIGION",
    "REPR_SCI", "RTVF", "SCIMEDIA", "SEEK", "SESP", "SLAVIC", "SOCIOL",
    "SOC_POL", "SPANISH", "SPANPORT", "SPCH_LNG", "STAT", "STRINGS",
    "TEACH_ED", "TGS", "TH&DRAMA", "THEATRE", "VOICE", "WIND_PER", "WM_ST",
    "WRITING"
  ],

  // SPS Undergraduate
  CNED: [
    "AAL", "ACCOUNT", "ADVT", "AFST", "AF_AM_ST", "ANTHRO", "ART",
    "ART_HIST", "ASIAN_LC", "ASTRON", "BIOL_SCI", "BUS_LAW", "CHEM",
    "CHINESE", "CIS", "CIV_ENG", "CIV_ENV", "CLASSICS", "COMM_ST",
    "COMP_LIT", "COMP_SCI", "CSD", "DANCE", "EARTH", "ECON", "ENGLISH",
    "FINANCE", "FRENCH", "GBL_HLTH", "GEOG", "GEOL_SCI", "GNDR_ST",
    "HISTORY", "INTL_ST", "JRN_WRIT", "LEGAL_ST", "LING", "MATH", "MKTG",
    "MUS_HIST", "ORG_BEH", "PERF_ST", "PERSIAN", "PHIL", "PHYSICS",
    "POLI_SCI", "PRO_HLTH", "PSYCH", "RELIGION", "RTVF", "SLAVIC", "SOCIOL",
    "SPANISH", "STAT", "THEATRE"
  ],

  // Qatar Undergraduate
  QUGR: [
    "AAL", "ANTHRO", "ARABIC", "BLK_ST", "ECON", "ENGLISH", "GEN_CMN",
    "GEN_LA", "HISTORY", "IMC", "INTERDIS", "JOUR", "LING", "LIT", "MIT",
    "PHIL", "POLI_SCI", "PSYCH", "RELIGION", "SOCIOL", "STRATCOM", "THEATRE"
  ],

  // Professional Studies Grad
  CGRD: [
    "CIS", "CLIN_RES", "ENGLISH", "HCA", "HC_COM", "HISTORY", "IPLS",
    "LEADERS", "LIT", "MCW", "MED_INF", "MHI", "MMI", "MPPA", "MSA", "MSDS",
    "MSGH", "MSHA", "MSRC", "MS_DSP", "MS_IDS", "PREDICT", "PSYCH", "QARS",
    "RTVF"
  ],

  // Professional Noncredit
  CNCR: [
    "ACE_IBS", "APPRAIS", "ART_THER", "ATHL_PRA", "BADM_IN", "BUS_ADM",
    "BUS_ALYS", "BUS_ANLY", "BUS_DM", "CASH_MGT", "CRT_FRAU", "CRT_INT",
    "CRT_TRES", "DIV_MED", "DSDV_IN", "ENVR_POL", "FN_EXTND", "FN_PLAN",
    "FOREN", "HIST_PRE", "HORT", "ISPM", "LAND_DM", "LEAD_ART", "MED_SKIL",
    "MOB_APP", "MUSEUM", "PHIL_NP", "PRED_BUS", "PROJ_PMI", "PR_PM_IN",
    "SHRM", "SUM_NEG", "TRADE"
  ],

  // Non-Degree
  NDGR: ["MUS_WKSP", "NAV_SCI", "TGS"],

  // Music Grad
  MUSG: [
    "CHRCH_MU", "CONDUCT", "JAZZ_ST", "MUSIC", "MUSICOL", "MUS_COMP",
    "MUS_TECH", "MUS_THRY", "PIANO", "STRINGS", "VOICE", "WIND_PER"
  ],

  // McCormick Engg Grad
  ENGG: [
    "BMD_ENG", "CIS", "CIV_ENG", "COMP_SCI", "CRDV", "DSGN", "EECS",
    "ENTREP", "IEMS", "INF_TECH", "ISEN", "LDRSHP", "MBIOTECH", "MECH_ENG",
    "MEM", "MLDS", "MPD", "MSAI", "MSIA", "PROJ_MGT"
  ],

  // Law
  LAW: [
    "BUSCOM", "CONPUB", "CRIM", "INTPROP", "LAWSTUDY", "LAWWRT", "LITARB",
    "PPTYTORT", "REGLAW", "TAXLAW"
  ],

  // Journalism Grad
  JRNG: ["EDIT", "IMC", "JOUR"],

  // Education Grad
  EDG: [
    "ALT_CERT", "COUN_PSY", "HDSP", "LRN_SCI", "MS_ED", "MS_FT", "MS_HE",
    "MS_LOC", "SE_POL"
  ],

  // Continuing Studies
  UC: [
    "ACCOUNT", "ADVT", "AF_AM_ST", "ANTHRO", "ART", "ART_HIST", "ASTRON",
    "BIOL_SCI", "BUS_LAW", "CHEM", "CIV_ENG", "CLASSICS", "COMM_ST",
    "COMP_LIT", "COMP_SCI", "COMP_STU", "CSD", "DANCE", "ECON", "ENGLISH",
    "EUR_TH", "FINANCE", "FRENCH", "GEOG", "GEOL_SCI", "GERMAN", "GNDR_ST",
    "HISTORY", "ITALIAN", "JRN_WRIT", "LING", "MATH", "MKTG", "MUS_HIST",
    "ORG_BEH", "PERF_ST", "PHIL", "PHYSICS", "POLI_SCI", "PSYCH", "REAL_EST",
    "RELIGION", "RTVF", "SOCIOL", "SPANISH", "STAT", "THEATRE", "WM_ST"
  ],

  // Communication Grad
  SPCG: [
    "COMM_ST", "CSD", "DANCE", "EPICS", "HLTH_COM", "MSC", "MSLCE", "RTVF",
    "SAI"
  ]
};

// Short labels for progress messages ("Trying education grad…").
export const SCHOOL_LABELS: Record<string, string> = {
  UGRD: "undergraduate",
  TGS: "graduate school",
  CNED: "SPS undergraduate",
  QUGR: "Qatar undergraduate",
  CGRD: "professional studies grad",
  CNCR: "professional noncredit",
  NDGR: "non-degree",
  MUSG: "music grad",
  ENGG: "McCormick engg grad",
  LAW: "law",
  JRNG: "journalism grad",
  EDG: "education grad",
  UC: "continuing studies",
  SPCG: "communication grad",
  CSRM: "consortium"
};

// Fallback when a subject isn't in our snapshot (e.g. a brand-new subject
// NU added after this file was last refreshed). Preserves the historical
// UGRD-then-TGS behavior so unknown subjects still resolve.
const DEFAULT_FALLBACK: readonly string[] = ["UGRD", "TGS"];

// Career priority orderings. The two arrays must include every key in
// SCHOOL_SUBJECTS — defensive code below appends any missing ones.
const PRIORITY_UNDERGRAD_FIRST: readonly string[] = [
  "UGRD", "CNED", "QUGR",
  "ENGG", "EDG", "JRNG", "LAW", "MUSG", "SPCG",
  "TGS", "CGRD",
  "UC", "NDGR", "CNCR"
];

const PRIORITY_GRAD_FIRST: readonly string[] = [
  "TGS", "ENGG", "EDG", "JRNG", "LAW", "MUSG", "SPCG", "CGRD",
  "UGRD", "CNED", "QUGR",
  "UC", "NDGR", "CNCR"
];

let invertedCache: Map<string, Set<string>> | null = null;

function inverted(): Map<string, Set<string>> {
  if (invertedCache) return invertedCache;
  const m = new Map<string, Set<string>>();
  for (const [career, subjects] of Object.entries(SCHOOL_SUBJECTS)) {
    for (const s of subjects) {
      let set = m.get(s);
      if (!set) {
        set = new Set();
        m.set(s, set);
      }
      set.add(career);
    }
  }
  invertedCache = m;
  return m;
}

// Returns the careers that catalogue this subject, ordered by likelihood
// for the given catalog number. 100-399 leans undergrad-first; 400+ leans
// grad-first (NU 400-level CTECs are typically catalogued under TGS even
// when the course is open to undergrads — see project memory). Unknown
// subjects fall back to ["UGRD", "TGS"], matching the pre-fanout behavior.
export function resolveCareerCandidates(
  subject: string,
  catalogNumber: string
): string[] {
  const owners = inverted().get(subject);
  if (!owners || owners.size === 0) return [...DEFAULT_FALLBACK];

  const num = parseInt(catalogNumber, 10);
  const priority =
    Number.isFinite(num) && num >= 400
      ? PRIORITY_GRAD_FIRST
      : PRIORITY_UNDERGRAD_FIRST;

  const ordered: string[] = [];
  for (const c of priority) {
    if (owners.has(c)) ordered.push(c);
  }
  // Safety net for careers not in the priority list (shouldn't trigger
  // unless someone adds a school to SCHOOL_SUBJECTS without updating the
  // priority arrays).
  for (const c of owners) {
    if (!ordered.includes(c)) ordered.push(c);
  }
  return ordered;
}
