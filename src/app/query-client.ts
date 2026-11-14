import { QueryClient } from '@tanstack/react-query'

/**
 * The one query cache for the app. It lives in its own module so that route
 * loaders can start fetching a page's data while its code is still loading.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
