import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import { supabase } from '../lib/supabaseClient'
import {
  SupabaseAuthContext,
  type UserProfile,
} from './supabase-auth-context'

import type { User } from '@supabase/supabase-js'


function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : String(error)
}

export function SupabaseAuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] =
    useState<Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >['data']['user']>(null)

  const [profile, setProfile] =
    useState<UserProfile | null>(null)

  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState('')

  useEffect(() => {
    let active = true

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return

        const nextUser = session?.user ?? null

        setUser(nextUser)
        setLoading(false)
        setProfileLoading(Boolean(nextUser))
      },
    )

    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active) return

        if (error) {
          setProfileError(error.message)
        }

        const nextUser = data.session?.user ?? null

        setUser(nextUser)
        setLoading(false)
        setProfileLoading(Boolean(nextUser))
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const userId = user?.id ?? null

  const loadProfile = useCallback(
    async (id: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, display_name, company_name, onboarding_completed, created_at, updated_at',
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw error

      return (data as UserProfile | null) ?? null
    },
    [],
  )

  useEffect(() => {
    let active = true

    if (!userId) {
      setProfile(null)
      setProfileError('')
      setProfileLoading(false)

      return () => {
        active = false
      }
    }

    setProfileLoading(true)
    setProfileError('')

    void loadProfile(userId)
      .then((result) => {
        if (active) setProfile(result)
      })
      .catch((error: unknown) => {
        if (active) {
          setProfile(null)
          setProfileError(errorMessage(error))
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [userId, loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!userId) return

    setProfileLoading(true)
    setProfileError('')

    try {
      const result = await loadProfile(userId)
      setProfile(result)
    } catch (error) {
      setProfileError(errorMessage(error))
      throw error
    } finally {
      setProfileLoading(false)
    }
  }, [userId, loadProfile])

  const saveProfile = useCallback(
    async (
      displayName: string,
      companyName: string,
    ) => {
      if (!userId) {
        throw new Error(
          'You must be signed in to save your profile.',
        )
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            display_name: displayName.trim(),
            company_name: companyName.trim() || null,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        )
        .select(
          'id, display_name, company_name, onboarding_completed, created_at, updated_at',
        )
        .single()

      if (error) throw error

      setProfile(data as UserProfile)
      setProfileError('')
    },
    [userId],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) throw error

    setUser(null)
    setProfile(null)
    setProfileError('')
  }, [])

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        profileError,
        refreshProfile,
        saveProfile,
        signOut,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  )
}