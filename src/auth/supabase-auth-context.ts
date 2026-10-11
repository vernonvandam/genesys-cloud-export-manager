import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type UserProfile = {
  id: string
  display_name: string
  company_name: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type SupabaseAuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileLoading: boolean
  profileError: string
  refreshProfile: () => Promise<void>
  saveProfile: (
    displayName: string,
    companyName: string,
  ) => Promise<void>
  signOut: () => Promise<void>
}

export const SupabaseAuthContext =
  createContext<SupabaseAuthContextValue | null>(null)