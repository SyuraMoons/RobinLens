import { useCallback, useState, type ReactNode } from 'react'
import { SectionContext } from './sectionContext'

export function SectionContextProvider({ children }: { children: ReactNode }) {
  const [text, setTextState] = useState<string | null>(null)

  const setText = useCallback((value: string | null) => {
    setTextState(value)
  }, [])

  return (
    <SectionContext.Provider value={{ text, setText }}>
      {children}
    </SectionContext.Provider>
  )
}
