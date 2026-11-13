import type { AccountStatus, Area, Gender, PositiveTag, Role, VerificationStatus } from '../../types'

export interface SeedPerson {
  id: string
  firstName: string
  lastName: string
  gender: Gender
  birthYear: number
  area: Area
  joinedDaysAgo: number
  role: Role
  status: AccountStatus
  verification: VerificationStatus
  /** How likely this person is to turn up to something they committed to. */
  showsUp: number
  /** The tags other people tend to give them. */
  knownFor: PositiveTag[]
  workplace?: string
}

type Row = [
  id: string,
  firstName: string,
  lastName: string,
  gender: 'w' | 'm',
  birthYear: number,
  area: Area,
  joinedDaysAgo: number,
  knownFor: PositiveTag[],
  overrides?: Partial<Pick<SeedPerson, 'role' | 'status' | 'verification' | 'showsUp' | 'workplace'>>,
]

const G: PositiveTag = 'Great conversation'
const P: PositiveTag = 'Punctual'
const W: PositiveTag = 'Welcoming'
const F: PositiveTag = 'Fun energy'
const R: PositiveTag = 'Respectful'
const L: PositiveTag = 'Good listener'

const ROWS: Row[] = [
  ['u01', 'Meera', 'Iyer', 'w', 1990, 'Indiranagar', 520, [W, R, P], { role: 'admin', showsUp: 1 }],
  ['u02', 'Ananya', 'Rao', 'w', 1997, 'Indiranagar', 310, [G, W, L], { showsUp: 0.93, workplace: 'Product designer' }],
  ['u03', 'Arjun', 'Menon', 'm', 1993, 'Koramangala', 480, [W, F, P], { role: 'host', showsUp: 1 }],
  ['u04', 'Priya', 'Nair', 'w', 1994, 'HSR Layout', 450, [W, G, R], { role: 'host', showsUp: 0.97 }],
  ['u05', 'Karthik', 'Reddy', 'm', 1991, 'Jayanagar', 430, [P, R, L], { role: 'host', showsUp: 1 }],
  ['u06', 'Sneha', 'Kulkarni', 'w', 1995, 'Indiranagar', 400, [F, W, G], { role: 'host', showsUp: 0.95 }],
  ['u07', 'Rahul', 'Sharma', 'm', 1992, 'Whitefield', 390, [F, G, W], { role: 'host', showsUp: 0.92 }],
  ['u08', 'Divya', 'Pillai', 'w', 1996, 'JP Nagar', 220, [L, R, W]],
  ['u09', 'Nikhil', 'Joshi', 'm', 1994, 'Malleshwaram', 200, [G, F, P]],
  ['u10', 'Rohit', 'Verma', 'm', 1990, 'Koramangala', 350, [F, P, G], { showsUp: 0.85 }],
  ['u11', 'Varun', 'Malhotra', 'm', 1989, 'Bellandur', 260, [F, P, G], { status: 'on_hold', showsUp: 0.8 }],
  ['u12', 'Tanvi', 'Deshpande', 'w', 1998, 'HSR Layout', 300, [G, F, R]],
  ['u13', 'Sameer', 'Khan', 'm', 1993, 'Frazer Town', 280, [P, F, G], { showsUp: 0.82 }],
  ['u14', 'Kiran', 'Gowda', 'm', 1995, 'Basavanagudi', 150, [F, W, G], { verification: 'unverified' }],
  ['u15', 'Lokesh', 'Hegde', 'm', 1996, 'Basavanagudi', 150, [F, W, G], { verification: 'unverified' }],
  ['u16', 'Manoj', 'Shetty', 'm', 1994, 'Jayanagar', 148, [F, W, G], { verification: 'unverified' }],
  ['u17', 'Aditi', 'Banerjee', 'w', 1997, 'Koramangala', 330, [G, L, W], { showsUp: 0.98 }],
  ['u18', 'Ishaan', 'Kapoor', 'm', 1998, 'Indiranagar', 290, [F, G, W], { showsUp: 0.94 }],
  ['u19', 'Lakshmi', 'Subramanian', 'w', 1992, 'Malleshwaram', 410, [P, R, L], { showsUp: 1 }],
  ['u20', 'Farah', 'Ahmed', 'w', 1996, 'Frazer Town', 90, [W, L, R], { verification: 'pending' }],
  ['u21', 'Dev', 'Patel', 'm', 1999, 'Whitefield', 80, [F, G, P], { verification: 'pending' }],
  ['u22', 'Nandini', 'Murthy', 'w', 1995, 'Jayanagar', 370, [L, G, R], { showsUp: 0.96 }],
  ['u23', 'Vikram', 'Singh', 'm', 1988, 'Hebbal', 440, [P, R, G], { showsUp: 0.9 }],
  ['u24', 'Pooja', 'Agarwal', 'w', 1997, 'Bellandur', 250, [W, F, L]],
  ['u25', 'Siddharth', 'Bhat', 'm', 1993, 'JP Nagar', 320, [L, P, R], { showsUp: 0.97 }],
  ['u26', 'Riya', 'Thomas', 'w', 1999, 'Koramangala', 180, [F, W, G]],
  ['u27', 'Aman', 'Gupta', 'm', 1996, 'HSR Layout', 210, [F, G, W], { showsUp: 0.68 }],
  ['u28', 'Shreya', 'Chatterjee', 'w', 1994, 'Indiranagar', 340, [G, W, F], { showsUp: 0.95 }],
  ['u29', 'Naveen', 'Kumar', 'm', 1991, 'Malleshwaram', 360, [R, P, L], { showsUp: 0.9 }],
  ['u30', 'Anjali', 'Mathew', 'w', 1998, 'Church Street', 120, [W, G, F], { verification: 'unverified' }],
  ['u31', 'Harish', 'Rao', 'm', 1990, 'Jayanagar', 130, [P, L, R], { verification: 'unverified' }],
  ['u32', 'Zoya', 'Sheikh', 'w', 1997, 'Frazer Town', 110, [F, G, W]],
  ['u33', 'Tejas', 'Naik', 'm', 1999, 'Whitefield', 100, [F, P, G], { verification: 'unverified' }],
  ['u34', 'Mira', 'D’Souza', 'w', 1995, 'Indiranagar', 95, [L, W, R]],
  ['u35', 'Gaurav', 'Saxena', 'm', 1992, 'Bellandur', 240, [F, G, P], { status: 'suspended', showsUp: 0.6 }],
  ['u36', 'Keerthi', 'Prasad', 'w', 2000, 'HSR Layout', 9, [], { verification: 'pending' }],
  ['u37', 'Abhinav', 'Mishra', 'm', 1998, 'Koramangala', 7, [], { verification: 'unverified' }],
  ['u38', 'Sana', 'Qureshi', 'w', 2001, 'Indiranagar', 5, [], { verification: 'verified' }],
  ['u39', 'Yash', 'Jain', 'm', 1997, 'JP Nagar', 4, [], { verification: 'unverified' }],
  ['u40', 'Lavanya', 'Krishnan', 'w', 1996, 'Jayanagar', 2, [], { verification: 'unverified' }],
]

export const PEOPLE: SeedPerson[] = ROWS.map(
  ([id, firstName, lastName, gender, birthYear, area, joinedDaysAgo, knownFor, overrides]) => ({
    id,
    firstName,
    lastName,
    gender: gender === 'w' ? 'woman' : 'man',
    birthYear,
    area,
    joinedDaysAgo,
    knownFor,
    role: 'member',
    status: 'active',
    verification: 'verified',
    showsUp: 0.93,
    ...overrides,
  }),
)

/** The accounts the development role switcher signs in as. */
export const PERSONAS: Record<Exclude<Role, 'visitor'>, string> = {
  member: 'u02',
  host: 'u03',
  admin: 'u01',
}

export const PROMPT_BANK: { promptId: string; question: string; answers: string[] }[] = [
  {
    promptId: 'perfect-sunday',
    question: 'A perfect Sunday is…',
    answers: [
      'Filter coffee at a darshini, a slow walk through Cubbon Park, and no plans after 4 pm.',
      'A long breakfast, a longer board game, and someone else doing the dishes.',
      'Cycling to Nandi before the city wakes up, then sleeping through the afternoon.',
      'Benne dosa in Basavanagudi, a second-hand bookshop, and a film I have already seen.',
      'Cooking something ambitious for people who will be kind about how it turns out.',
      'A morning run around Ulsoor Lake and brunch that drifts into dinner.',
      'Sketching on Church Street until the light goes.',
      'Farmers’ market, a too-large bunch of flowers, and an evening of doing nothing well.',
    ],
  },
  {
    promptId: 'ask-me-about',
    question: 'Ask me about…',
    answers: [
      'The year I tried every biryani in Frazer Town and kept a spreadsheet.',
      'Why Catan ends friendships and which game to play instead.',
      'My balcony garden, which is thriving out of spite.',
      'The trek where it rained for three days and I would still go again.',
      'Learning Kannada at thirty, one autorickshaw conversation at a time.',
      'The best open mics in the city and the worst joke I have told at one.',
      'My film camera, and the roll I ruined at a wedding.',
      'How I ended up with forty houseplants and no free windowsills.',
    ],
  },
  {
    promptId: 'find-me-at',
    question: 'You’ll find me at…',
    answers: [
      'Whichever café has a free table by the window and a plug point.',
      'The front row of a small gig, pretending I knew the band first.',
      'A quiz night, confidently wrong about geography.',
      'The badminton court at 7 am, against my better judgement.',
      'Blossom Book House, on the top floor, losing track of time.',
      'A pottery wheel, making bowls that are almost round.',
      'Any place with a karaoke machine and a forgiving audience.',
      'A brewery in Koramangala, arguing about the best snack on the menu.',
    ],
  },
  {
    promptId: 'looking-for',
    question: 'I’m looking for people to…',
    answers: [
      'Try a new restaurant with, so we can order twice as much.',
      'Go to gigs with, so I stop leaving before the encore.',
      'Play long board games with and not check the time.',
      'Join a Sunday run, at a pace where we can still talk.',
      'Explore the city with. I have lived here two years and seen four streets.',
      'Swap books with and be honest about the ones we did not finish.',
      'Plan weekend treks with, and actually go.',
      'Cook with. I bring enthusiasm and a decent dal.',
    ],
  },
  {
    promptId: 'best-of-bengaluru',
    question: 'The best thing about Bengaluru is…',
    answers: [
      'The weather, and how everyone still talks about it every single day.',
      'That a stranger will give you directions and their life story.',
      'The rain trees. And the dosa. In that order, on most days.',
      'You can find a room full of people who love the exact thing you love.',
      'Evenings that are cool enough for a walk, almost all year.',
      'The bookshops that have somehow outlasted everything.',
    ],
  },
]
