# Translating Riptide RPG

You translate the game's on-screen text from English into one language. The game shows a unit wherever its English
key appears; your translation replaces it on screen. Nothing else in the game changes.

## The game
Riptide RPG is a medieval fantasy action RPG with Norse myth (Thor, Odin, Valhalla), drawn in a cartoon (chibi) style.
Heroes are Human, Dwarf, Orc or Undead; Warrior, Mage, Hunter or Priest. You level to 60, beat the bosses, then
Prestige and march the realm again. Late game you run the City through the Crown Ledger (taxes, public works, the jail,
the council, a moody King), rise through the peerage (Knight, Baron, Count, Marquess, Duke, King/Queen, Emperor/Empress),
sail with Captain Blackbeard on the Black Tide to rival ports, raid them, run a farm, and tame creatures called Tides
(turn-based duels, breeding, the Tides Guild). There is a casino (slots, blackjack, roulette, card games), fishing,
mining, a blacksmith, mounts, raids and dungeons. Gold is written with ◉, scraps with ⚙.

The English is wry, warm and a little old-fashioned (British spelling: colour, harbour). Keep that voice: clear,
natural game language a native player would expect, with the jokes and the period flavour carried over - not literal.

## The format of a unit
- `{0}`, `{1}` ... are values the game fills in (a name, an amount, another translated phrase). Keep every one, exactly
  once. You may move them to where your grammar needs them.
- `{#0}`, `{#1}` ... are numbers written in the English. Keep every one exactly once; you may reorder them.
- `<0>...</0>`, `<1>...</1>` wrap words shown in bold or colour; `<0/>` is an icon or a line break. Keep every tag with the
  same number, exactly once, around the words that mean the same thing in your sentence. Do not add tags, and do not
  add HTML.
- A slot glued straight onto a word ("close{1}", "house{2}") holds only the English plural "s" (or nothing). The game
  drops that "s" in your language, so keep the slot right after the word and write the word in the form that reads best
  with a number (usually the plural; in Russian prefer wording that does not depend on the count).
- Keep emoji and symbols (◉ ⚙ ✦ ⚔ 🔒 → · …) where they belong in the sentence.
- A key that starts with a lower-case context and a bar ("outfit|Worn", "ledger|Close") is the same word in a particular
  place: translate only the part after the bar, for that place, and leave the context out of your translation.
- Keep the capitalisation style: an ALL-CAPS label stays all caps; a Title Case button keeps the natural form of
  your language (German nouns, etc.).
- Punctuation: keep a sentence's end punctuation; a label without a full stop stays without one.

## Names
- People's names (Alarik Tidvind, Sebbe, Scarlett, Rurik Tunna, ...) stay exactly as written, in Latin letters.
- Coined place and thing names stay as written, in Latin letters: Riptide, RiptideRPG, Moonshine, Ravenholt,
  Silverfjord, Port Meridian, Kraken's Rest, Emberfall, Frostseeker, Cindervein, Briarhollow and the like - unless they
  are plain descriptions ("The Harbour", "The City", "The Farm", "Wasteland", "Cow Level"), which you translate.
- Norse gods and well-known figures take your language's usual form: Thor, Odin, Valhalla, Blackbeard.
- Tide species ("Obsidian Bear", "Moon Owl") are descriptive: translate them. Coined Tide hybrid names are not sent.
- Item, spell, talent, building and title names are translated (Heroic Strike, Fireball, The Velvet Lantern, Duke).

## Your language
| id | language | address the player |
|----|----------|--------------------|
| zh | Simplified Chinese | 你; Chinese punctuation (，。！？：) inside Chinese sentences |
| ru | Russian | вы (lower case) |
| es | Spanish (Spain) | tú |
| de | German | du (lower case) |
| it | Italian | tu |
| pt | Portuguese (Brazil) | você |

## Length
Buttons, tabs and labels sit in tight spaces: keep them as short as a natural translation allows. Sentences may grow
a little, never pad them.

## What you hand back
A JSON object mapping EVERY key you were given, exactly as given, to its translation. If a unit must stay as it is (a
name, a code like "LB" or "RS", a unit that is not really words), map it to itself. Then run
`node tools/i18n/check.cjs <your input file> <your output file>` and fix everything it reports, until it says OK.
If a unit's meaning is unclear, its `where` (file:line) shows where the game uses it - open that line for context.
