import { AskScene, FindScene, MeetAgainScene, SquadScene } from './how-visuals'

/** The four steps of "How it works", each with the scene that illustrates it. */
export const HOW_STEPS = [
  {
    title: 'Find something worth leaving the house for',
    body: 'Supper clubs, game nights, gigs and house parties across Bengaluru. Filter by area, date, price or women-only.',
    Scene: FindScene,
  },
  {
    title: 'Ask to join. The host sees who you are.',
    body: 'Hosts see your verified profile and how often you turn up, then say yes. The address is shared only once you’re in.',
    Scene: AskScene,
  },
  {
    title: 'Walk in with a squad',
    body: 'Join four to six people going to the same event. Meet at a café half an hour before, and arrive together.',
    Scene: SquadScene,
  },
  {
    title: 'Meet again',
    body: 'Afterwards, say who you’d like to see again. When it’s mutual you’re connected, and one evening becomes a regular thing.',
    Scene: MeetAgainScene,
  },
]
