export interface ReferenceItem {
  id: number
  slug: string
  label: string
}

export interface ReferenceData {
  areas: ReferenceItem[]
  interests: ReferenceItem[]
  languages: ReferenceItem[]
}

export interface ReferenceService {
  get(): Promise<ReferenceData>
}
