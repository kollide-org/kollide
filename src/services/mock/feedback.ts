import type { FeedbackService, FeedbackTask } from '../types/feedback'

const task: FeedbackTask = {
  eventId: 'mock-event', eventTitle: 'Sunday board games', closesAt: new Date(Date.now() + 3 * 86_400_000).toISOString(), hostId: 'mock-host',
  canRateHost: true, hostRated: false,
  people: [
    { userId: 'mock-host', firstName: 'Dev', photoKey: null, isHost: true, tagged: false, flagged: false },
    { userId: 'mock-u2', firstName: 'Kabir', photoKey: null, isHost: false, tagged: false, flagged: false },
  ],
}

export const mockFeedback: FeedbackService = {
  async tags() {
    return ['Warm', 'Great listener', 'Good humour', 'Made me feel welcome', 'Easy to talk to', 'Brought good energy', 'Thoughtful', 'Reliable'].map((label, i) => ({
      id: i + 1, slug: label.toLowerCase().replace(/ /g, '-'), label,
    }))
  },
  async tasks() {
    return [task]
  },
  async giveTags(_eventId, toUser) {
    const person = task.people.find((p) => p.userId === toUser)
    if (person) person.tagged = true
  },
  async submitPrivate(_eventId, aboutUser) {
    const person = task.people.find((p) => p.userId === aboutUser)
    if (person) person.flagged = true
  },
  async rateHost() {
    task.hostRated = true
  },
}
