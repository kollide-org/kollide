import { ServiceError } from '../types/errors'
import type { ReferenceItem, ReferenceService } from '../types/reference'

const client = () => import('./client').then((module) => module.supabase)

export const realReference: ReferenceService = {
  async get() {
    const supabase = await client()
    const load = async (table: 'areas' | 'interests' | 'languages'): Promise<ReferenceItem[]> => {
      const { data, error } = await supabase
        .from(table)
        .select('id, slug, label')
        .eq('active', true)
        .order('sort_order')
        .order('label')
      if (error) throw new ServiceError('unknown', error.message)
      return data ?? []
    }
    const [areas, interests, languages] = await Promise.all([load('areas'), load('interests'), load('languages')])
    return { areas, interests, languages }
  },
}
