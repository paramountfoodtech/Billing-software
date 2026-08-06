/**
 * Hook to manage table loading state with Suspense integration
 * Usage: const { isLoading } = useTableLoading()
 * 
 * Example:
 * ```tsx
 * const { isLoading } = useTableLoading()
 * return <ClientsTable clients={clients} isLoading={isLoading} />
 * ```
 */

import { useTransition } from 'react'

export function useTableLoading() {
  const [isPending, startTransition] = useTransition()
  
  return {
    isLoading: isPending,
    startTransition
  }
}
