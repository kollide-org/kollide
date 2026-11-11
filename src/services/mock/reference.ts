import type { ReferenceService } from '../types/reference'

const items = (labels: string[]) =>
  labels.map((label, index) => ({ id: index + 1, slug: label.toLowerCase().replace(/\s+/g, '-'), label }))

export const mockReference: ReferenceService = {
  async get() {
    return {
      areas: items(['Indiranagar', 'Koramangala', 'HSR Layout', 'Jayanagar', 'JP Nagar', 'Whitefield']),
      interests: items(['Board games', 'Hiking', 'Running', 'Live music', 'Film', 'Books', 'Coffee', 'Street food']),
      languages: items(['Kannada', 'English', 'Hindi', 'Tamil', 'Telugu']),
      categories: items(['Food and drink', 'Outdoors', 'Music', 'Games', 'Arts and crafts', 'Books', 'Sports']),
    }
  },
}
