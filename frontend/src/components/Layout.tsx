import type { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { FloatingChatWidget } from './FloatingChatWidget'
import { SectionContextProvider } from '../lib/SectionContextProvider'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <SectionContextProvider>
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </main>
        <FloatingChatWidget />
      </div>
    </SectionContextProvider>
  )
}
