'use client'

import { usePageTitle } from '@/app/dashboard/page-title-context'

interface PageTitleSetterProps {
  title: string
}

export function PageTitleSetter({ title }: PageTitleSetterProps) {
  usePageTitle(title)
  return null
}
