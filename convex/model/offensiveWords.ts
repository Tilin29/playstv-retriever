// The words a clip title is flagged for (see model/titleFlags.ts), and the matcher.
// Pure functions without runtime imports, so the matcher can be tried out anywhere.
//
// Titles are normalized first: lowercased, accents stripped, look-alike digits, symbols
// and Cyrillic/Greek letters read as Latin letters ("n1gg@" → "nigga"), and everything
// else a space. Each letter of a form matches any run of itself, so "niiiigggeeer"
// matches "niger"; a letter written twice needs at least two, where that tells the slur
// from an ordinary word ("coon", not "con"). A space matches a space or nothing.
//
// Forms only match whole words (plus a suffix), so "spicy" and "Nigeria" don't match.
// `embedded` forms also match inside longer words, for slurs distinctive enough to find
// in run-together gamer titles ("xXniggerkillerXx"). Letters spelled apart ("n i g g e r",
// "n.i.g.g.e.r") and words split in two ("nig ger") are also read as one word.
import type { Infer } from 'convex/values'
import type { offensiveCategory } from '../schema'

export type OffensiveCategory = Infer<typeof offensiveCategory>

type OffensiveWord = {
  /** The slur itself, as the admin panel names it. */
  word: string
  category: OffensiveCategory
  forms: string[]
  /** Endings allowed after a form. Defaults to plurals. */
  suffixes?: string[]
  /** Forms that also match inside a longer word. */
  embedded?: string[]
  /** Leaves titles whose normalized text matches alone, e.g. for an idiom. */
  unless?: RegExp
}

const PLURALS = ['s', 'z']

export const OFFENSIVE_WORDS: OffensiveWord[] = [
  // Racial and ethnic
  {
    word: 'nigger',
    category: 'racial',
    forms: ['niger', 'niqer', 'nigr', 'nigur', 'nig'],
    embedded: ['nigger', 'niqqer'],
  },
  {
    word: 'nigga',
    category: 'racial',
    forms: ['niga', 'nigah', 'niqa', 'niguh', 'niba'],
    embedded: ['nigga', 'niqqa'],
  },
  { word: 'coon', category: 'racial', forms: ['coon'] },
  { word: 'jigaboo', category: 'racial', forms: ['jigabo', 'jigabu'] },
  { word: 'porch monkey', category: 'racial', forms: ['porch monkey', 'porch monky'] },
  { word: 'jungle bunny', category: 'racial', forms: ['jungle bunny', 'jungle buny'] },
  { word: 'darkie', category: 'racial', forms: ['darkie'] },
  { word: 'golliwog', category: 'racial', forms: ['goliwog', 'golywog'] },
  { word: 'wog', category: 'racial', forms: ['wog'] },
  { word: 'spic', category: 'racial', forms: ['spic', 'spik'] },
  { word: 'wetback', category: 'racial', forms: ['wetback', 'wet back'] },
  { word: 'beaner', category: 'racial', forms: ['beaner'] },
  {
    word: 'chink',
    category: 'racial',
    forms: ['chink', 'chinky'],
    unless: /chink in (?:the|his|her|their|my|your|our) armou?r/,
  },
  { word: 'ching chong', category: 'racial', forms: ['ching chong'] },
  { word: 'gook', category: 'racial', forms: ['gook'] },
  { word: 'jap', category: 'racial', forms: ['jap'] },
  { word: 'zipperhead', category: 'racial', forms: ['ziperhead', 'ziper head'] },
  { word: 'slant-eye', category: 'racial', forms: ['slant eye', 'slant eyed'] },
  { word: 'paki', category: 'racial', forms: ['paki'] },
  { word: 'raghead', category: 'racial', forms: ['raghead', 'rag head'] },
  { word: 'towelhead', category: 'racial', forms: ['towelhead', 'towel head'] },
  { word: 'sand nigger', category: 'racial', forms: ['sand niger', 'sand niga'] },
  { word: 'camel jockey', category: 'racial', forms: ['camel jockey', 'camel jocky'] },
  { word: 'redskin', category: 'racial', forms: ['redskin'] },
  { word: 'injun', category: 'racial', forms: ['injun'] },
  { word: 'squaw', category: 'racial', forms: ['squaw'] },
  { word: 'honky', category: 'racial', forms: ['honky', 'honkey'], unless: /honke?y tonk/ },
  { word: 'dago', category: 'racial', forms: ['dago'] },
  { word: 'polack', category: 'racial', forms: ['polack'] },

  // Antisemitic
  { word: 'kike', category: 'antisemitic', forms: ['kike', 'kyke'] },
  { word: 'yid', category: 'antisemitic', forms: ['yid'] },
  { word: 'heeb', category: 'antisemitic', forms: ['heeb'] },
  { word: 'oven dodger', category: 'antisemitic', forms: ['oven dodger'] },

  // Homophobic
  {
    word: 'faggot',
    category: 'homophobic',
    forms: ['fag', 'fagot', 'faget', 'fagit', 'fagat', 'fgt', 'phag', 'phagot'],
    suffixes: [...PLURALS, 'y'],
    embedded: ['fagot', 'faget'],
  },
  { word: 'dyke', category: 'homophobic', forms: ['dyke'] },
  {
    word: 'homo',
    category: 'homophobic',
    forms: ['homo'],
    unless: /homo (?:sapiens|erectus|habilis)/,
  },
  { word: 'lesbo', category: 'homophobic', forms: ['lesbo'] },
  { word: 'poofter', category: 'homophobic', forms: ['poofter'] },
  { word: 'batty boy', category: 'homophobic', forms: ['baty boy', 'baty man'] },
  { word: 'fudgepacker', category: 'homophobic', forms: ['fudge packer', 'fudgepacker'] },
  { word: 'carpet muncher', category: 'homophobic', forms: ['carpet muncher'] },
  { word: 'pillow biter', category: 'homophobic', forms: ['pilow biter'] },

  // Transphobic
  { word: 'tranny', category: 'transphobic', forms: ['trany', 'tranie'] },
  { word: 'shemale', category: 'transphobic', forms: ['she male'] },
  { word: 'troon', category: 'transphobic', forms: ['troon'] },

  // Ableist
  {
    word: 'retard',
    category: 'ableist',
    forms: ['retard', 'retart', 'tard'],
    suffixes: [...PLURALS, 'ed', 'o', 'os'],
    embedded: ['retard'],
  },
  {
    word: 'spaz',
    category: 'ableist',
    forms: ['spaz', 'spastic'],
    suffixes: [...PLURALS, 'ed', 'ing', 'tic'],
  },
  { word: 'mongoloid', category: 'ableist', forms: ['mongoloid'] },
  { word: 'window licker', category: 'ableist', forms: ['window licker'] },
]

/** Whole words that match a form but aren't the slur. */
const ALLOWED_WORDS = new Set(['niger', 'jaap'])
/** Words that contain an `embedded` form but aren't the slur. */
const ALLOWED_INSIDE = ['snigger', 'niggard', 'retardan', 'retardation']

/** Words split in two are read joined when that makes at least this many letters. */
const MIN_JOINED_LENGTH = 5

// Letters that look like Latin ones; replaced wherever they are.
const LOOKALIKE_LETTERS: Record<string, string> = {
  ß: 'ss',
  // Cyrillic
  а: 'a', в: 'b', е: 'e', ё: 'e', і: 'i', ј: 'j', к: 'k', м: 'm', н: 'h', о: 'o',
  р: 'p', с: 'c', т: 't', у: 'y', х: 'x', ѕ: 's',
  // Greek
  α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't',
  υ: 'u', χ: 'x',
}

// Digits and symbols that stand in for letters; replaced only inside a word that has
// real letters, so "2018" or "nice!" stay as they are.
const LOOKALIKE_SYMBOLS: Record<string, string> = {
  '0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't',
  '8': 'b', '9': 'g', '@': 'a', $: 's', '€': 'e', '!': 'i', '|': 'i',
}

/** The title as lowercase Latin words separated by single spaces. */
export function normalizeTitle(title: string) {
  const letters = Array.from(
    title.normalize('NFKD').replace(/\p{M}|\p{Cf}/gu, '').toLowerCase(),
    (char) => LOOKALIKE_LETTERS[char] ?? char,
  ).join('')
  return letters
    .replace(/[a-z0-9@$€!|]+/g, (run) => (/[a-z]/.test(run) ? readWord(run) : ' '))
    .replace(/[^a-z]+/g, ' ')
    .trim()
}

/** Reads look-alikes as letters. A "!" or "|" at either end is punctuation. */
function readWord(word: string) {
  const [, lead, middle, trail] = /^([!|]*)(.*?)([!|]*)$/.exec(word)!
  return lead + Array.from(middle!, (char) => LOOKALIKE_SYMBOLS[char] ?? char).join('') + trail
}

/** Each letter matches a run of itself (at least as long as written); a space is optional. */
function formPattern(form: string) {
  return form.replace(/([a-z])\1*| /g, (run) =>
    run === ' ' ? ' ?' : run.length === 1 ? `${run}+` : `${run[0]}{${run.length},}`,
  )
}

const COMPILED = OFFENSIVE_WORDS.map((entry) => {
  const forms = entry.forms.map(formPattern).join('|')
  const suffixes = (entry.suffixes ?? PLURALS).join('|')
  return {
    entry,
    whole: new RegExp(`(?<![a-z])(?:${forms})(?:${suffixes})?(?![a-z])`, 'g'),
    inside: entry.embedded && new RegExp(entry.embedded.map(formPattern).join('|')),
  }
})

export type OffensiveMatch = { word: string; category: OffensiveCategory; text: string }

/** The list's words in the title, once each, with how each was written (normalized). */
export function findOffensiveWords(title: string): OffensiveMatch[] {
  const text = normalizeTitle(title)
  if (!text) return []
  const words = text.split(' ')
  const joined = joinedWords(words)

  const matches: OffensiveMatch[] = []
  for (const { entry, whole, inside } of COMPILED) {
    if (entry.unless?.test(text)) continue
    const found =
      findWhole(whole, [text, ...joined]) ??
      (inside &&
        [...words, ...joined].find(
          (word) => inside.test(word) && !ALLOWED_INSIDE.some((allowed) => word.includes(allowed)),
        ))
    if (found) matches.push({ word: entry.word, category: entry.category, text: found })
  }
  return matches
}

function findWhole(pattern: RegExp, candidates: string[]) {
  for (const candidate of candidates) {
    for (const [match] of candidate.matchAll(pattern)) {
      if (!ALLOWED_WORDS.has(match)) return match
    }
  }
  return undefined
}

/** Runs of single letters ("n i g g e r") and each pair of neighbouring words, joined. */
function joinedWords(words: string[]) {
  const joined: string[] = []
  let letters = ''
  for (const word of [...words, '']) {
    if (word.length === 1) {
      letters += word
      continue
    }
    if (letters.length >= 3) joined.push(letters)
    letters = ''
  }
  for (let i = 1; i < words.length; i++) {
    const pair = words[i - 1]! + words[i]!
    if (pair.length >= MIN_JOINED_LENGTH) joined.push(pair)
  }
  return joined
}
