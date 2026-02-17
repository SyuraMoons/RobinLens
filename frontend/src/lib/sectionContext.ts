import {
  createContext,
  useContext,
} from 'react'

interface SectionContextValue {
  text: string | null
  setText: (value: string | null) => void
}

const SectionContext = createContext<SectionContextValue | undefined>(undefined)

export function useSectionContext() {
  const ctx = useContext(SectionContext)
  if (!ctx) throw new Error('useSectionContext must be used within SectionContextProvider')
  return ctx
}

export { SectionContext }
