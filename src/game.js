export const STARTERS = {
  cat: {
    name: 'Miso',
    kind: 'Cat',
    trait: 'SELECTIVELY EMPLOYED',
    description: 'Will join your quest. On their own terms.',
    perk: 'Excellent at emotional distance.',
  },
  dog: {
    name: 'Biscuit',
    kind: 'Dog',
    trait: 'UNLICENSED OPTIMIST',
    description: 'No thoughts. Just friendship and a suspicious sock.',
    perk: 'Thinks you are doing a great job.',
  },
  hamster: {
    name: 'Tax Evasion',
    kind: 'Hamster',
    trait: 'SMALL. UNACCOUNTABLE.',
    description: 'Fits in a pocket. Has offshore interests.',
    perk: 'Carries the team. In tiny cheeks.',
  },
};
export const ENCOUNTERS = [
  {
    id: 'pigeon',
    name: 'Crumb, Lord of the Bench',
    model: 'pigeon',
    x: 7,
    z: 6,
    title: 'The park bench',
    story: 'This pigeon owns the park. The council pays him in breadcrumbs.',
    stamp: 'Park diplomat',
    moods: ['hungry', 'nervous', 'restless'],
  },
  {
    id: 'cat',
    name: 'The Homeowners’ Association',
    model: 'cat',
    x: -8,
    z: 6,
    title: 'The garden gate',
    story: 'One cat. Seventeen noise complaints. She would like to see your permit.',
    stamp: 'Garden guardian',
    moods: ['nervous', 'restless', 'hungry'],
  },
  {
    id: 'raccoon',
    name: 'Binjamin, Night Manager',
    model: 'raccoon',
    x: 8,
    z: -5,
    title: 'The recycling depot',
    story: 'The final boss has two bins and a very impressive work ethic.',
    stamp: 'Bin whisperer',
    moods: ['restless', 'hungry', 'nervous'],
  },
];
ENCOUNTERS.forEach((e) => (e.chapter = 0));
ENCOUNTERS.push(
  {
    id: 'rabbit',
    name: 'Turnip, Trail Supervisor',
    model: 'rabbit',
    x: 7,
    z: 6,
    title: 'The carrot clearing',
    story: 'Turnip has eaten the trail map. You will need to negotiate a new route.',
    stamp: 'Trail diplomat',
    moods: ['nervous', 'hungry', 'restless'],
    chapter: 1,
  },
  {
    id: 'fox',
    name: 'Maureen from Accounts',
    model: 'fox',
    x: -8,
    z: 6,
    title: 'The fern grove',
    story: 'A fox in charge of woodland finances. The numbers are mostly paw prints.',
    stamp: 'Forest accountant',
    moods: ['restless', 'nervous', 'hungry'],
    chapter: 1,
  },
  {
    id: 'tortoise',
    name: 'Sir Eventually',
    model: 'tortoise',
    x: 8,
    z: -5,
    title: 'The old crossing',
    story: 'He started crossing this path in 1987. You have caught him at a busy time.',
    stamp: 'Patience practitioner',
    moods: ['hungry', 'restless', 'nervous'],
    chapter: 1,
  },
  {
    id: 'duck',
    name: 'Admiral Puddles',
    model: 'duck',
    x: 7,
    z: 6,
    title: 'The duck marina',
    story: 'He commands three puddles and has never paid a docking fee.',
    stamp: 'Puddle admiral',
    moods: ['restless', 'hungry', 'nervous'],
    chapter: 2,
  },
  {
    id: 'sheep',
    name: 'Cloud, Unsupervised',
    model: 'sheep',
    x: -8,
    z: 6,
    title: 'The windy meadow',
    story: 'Cloud has escaped a petting zoo to pursue a career in being slightly elsewhere.',
    stamp: 'Wool ambassador',
    moods: ['nervous', 'hungry', 'restless'],
    chapter: 2,
  },
  {
    id: 'goat',
    name: 'The Harbour Commissioner',
    model: 'goat',
    x: 8,
    z: -5,
    title: 'The lighthouse hill',
    story: 'The commissioner ate the safety inspection. The harbour has never scored higher.',
    stamp: 'Harbour commissioner',
    moods: ['hungry', 'nervous', 'restless'],
    chapter: 2,
  },
  {
    id: 'champion',
    name: 'Gary’s Regional Champion',
    model: 'hamster',
    x: 0,
    z: -4,
    title: 'The grand final',
    story:
      'Gary unveils his champion: a hamster named Municipal Bond. It has never lost. It has never competed.',
    stamp: 'Ordinary Animal Master',
    moods: ['nervous', 'restless', 'hungry', 'restless', 'nervous'],
    chapter: 3,
  },
);
export const CHAPTERS = [
  {
    name: 'Little Ditch',
    subtitle: 'Every legend starts in a garage.',
    goal: 'Make three neighborhood friends',
    intro:
      'Welcome to Little Ditch. Three animals, three stamps, and absolutely no oversight. Follow the gold markers. Come back when you are locally famous.',
    color: 0x95ae69,
  },
  {
    name: 'Mildly Inconvenient Woods',
    subtitle: 'A wilderness. With public toilets.',
    goal: 'Earn the woodland stamps',
    intro:
      'The woodland league has accepted your application. I wrote “very tall” under qualifications. Meet the rabbit, fox, and tortoise. I will be at the field station, supervising a sandwich.',
    color: 0x7f9b65,
  },
  {
    name: 'Almost-on-Sea',
    subtitle: 'A seaside town. Technically a pond.',
    goal: 'Win over the harbour committee',
    intro:
      'Welcome to the coast! The duck runs the marina, the sheep runs from responsibility, and the goat runs the council. Make friends with all three. Then come back for the grand final.',
    color: 0xb4bc80,
  },
];
export const CORRECT_MOVE = { hungry: 'snack', nervous: 'reassure', restless: 'play' };
export function startEncounter(id) {
  if (!ENCOUNTERS.some((e) => e.id === id)) throw new Error('Unknown encounter');
  return { id, trust: 0, confidence: 100, turn: 0, outcome: null };
}
export function takeTurn(battle, move) {
  if (battle.outcome || !Object.values(CORRECT_MOVE).includes(move)) return battle;
  const animal = ENCOUNTERS.find((e) => e.id === battle.id);
  const mood = animal.moods[battle.turn % animal.moods.length];
  const match = CORRECT_MOVE[mood] === move;
  const final = battle.id === 'champion';
  const trust = Math.min(100, battle.trust + (match ? (final ? 20 : 28) : 9));
  const confidence = Math.max(0, battle.confidence - (match ? (final ? 13 : 12) : 24));
  return {
    ...battle,
    trust,
    confidence,
    turn: battle.turn + 1,
    match,
    outcome: trust >= 100 ? 'won' : confidence <= 0 ? 'lost' : null,
  };
}
export const SAVE_KEY = 'ordinary-animals-v1';
export function parseSave(raw) {
  try {
    const s = JSON.parse(raw);
    if (!s || !Object.hasOwn(STARTERS, s.starter)) return null;
    const stamps = [
      ...new Set(
        (Array.isArray(s.stamps) ? s.stamps : []).filter((id) =>
          ENCOUNTERS.some((e) => e.id === id),
        ),
      ),
    ];
    const unlocked =
      stamps.filter((id) => ENCOUNTERS.find((e) => e.id === id)?.chapter === 0).length === 3
        ? stamps.filter((id) => ENCOUNTERS.find((e) => e.id === id)?.chapter === 1).length === 3
          ? 2
          : 1
        : 0;
    return {
      starter: s.starter,
      stamps,
      chapter: Number.isInteger(s.chapter) ? Math.max(0, Math.min(unlocked, s.chapter)) : 0,
      completed: s.completed === true && ENCOUNTERS.every((e) => stamps.includes(e.id)),
    };
  } catch {
    return null;
  }
}
