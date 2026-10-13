import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type UserProfile = {
  id: string
  display_name: string
  company_name: string | null
  role: 'member' | 'global_admin'
  approval_status: 'pending' | 'approved' | 'rejected'
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export type OrganizationAccess = {
  id: string
  name: string
  region: string | null
}

export type SupabaseAuthContextValue = {
  user: User | null
  profile: UserProfile | null
  organizations: OrganizationAccess[]
  activeOrganizationId: string | null
  setActiveOrganizationId: (organizationId: string) => void
  loading: boolean
  profileLoading: boolean
  profileError: string
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export function isIntegratedIdentityError(error: string) {
  return error.includes('This identity uses Genesys-integrated sign-in.')
}

export const SupabaseAuthContext =
  createContext<SupabaseAuthContextValue | null>(null)