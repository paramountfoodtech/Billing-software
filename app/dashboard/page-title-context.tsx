"use client"

import { createContext, useContext, useState, ReactNode, useEffect } from "react"

interface PageTitleContextType {
  title: string
  setTitle: (title: string) => void
}

const PageTitleContext = createContext<PageTitleContextType | undefined>(undefined)

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState("")

  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>
}

export function usePageTitle(title: string) {
  const context = useContext(PageTitleContext)
  if (!context) {
    throw new Error("usePageTitle must be used within a PageTitleProvider")
  }

  // Use useEffect to avoid state updates during render
  useEffect(() => {
    context.setTitle(title)
  }, [title, context])

  return context
}

export function usePageTitleContext() {
  const context = useContext(PageTitleContext)
  if (!context) {
    throw new Error("usePageTitleContext must be used within a PageTitleProvider")
  }
  return context
}
