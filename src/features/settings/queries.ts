import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { useAdoptSession } from '@/features/auth/hooks'
import { eventKeys } from '@/features/events/queries'
import { authService, settingsService, type Settings, type SettingsPatch } from '@/services'

export const settingsKey = ['settings'] as const

export function useSettings() {
  return useQuery({ queryKey: settingsKey, queryFn: () => settingsService.getSettings() })
}

function merge(current: Settings, patch: SettingsPatch): Settings {
  const notifications = { ...current.notifications }
  for (const [topic, channels] of Object.entries(patch.notifications ?? {})) {
    const key = topic as keyof Settings['notifications']
    notifications[key] = { ...notifications[key], ...channels }
  }
  return { privacy: { ...current.privacy, ...patch.privacy }, notifications }
}

/** Switches move at once. If the change does not save, they go back. */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: SettingsPatch) => settingsService.updateSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: settingsKey })
      const previous = queryClient.getQueryData<Settings>(settingsKey)
      if (previous) queryClient.setQueryData(settingsKey, merge(previous, patch))
      return { previous }
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(settingsKey, context.previous)
    },
    onSuccess: (saved, patch) => {
      queryClient.setQueryData(settingsKey, saved)
      // Event cards show fewer faces once someone leaves them.
      if (patch.privacy) void queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}

/** Deletes the account, forgets the session, and goes back to the landing page. */
export function useDeleteAccount() {
  const adopt = useAdoptSession()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: () => authService.deleteAccount(),
    // Leave the signed-in area first, so its guard never sends the visitor to sign-in.
    onSuccess: async () => {
      await navigate('/', { replace: true, flushSync: true })
      adopt(null)
      // Said here, not by the dialog: the settings page has already gone.
      toast.success('Your account has been deleted', { description: 'Thank you for coming to things with us.' })
    },
  })
}
