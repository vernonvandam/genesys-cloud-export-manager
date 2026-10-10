import { createContext } from 'react'

import type {
  GenesysConfig,
  GenesysUser,
} from '../types/app'

export type AuthContextValue = {
  config: GenesysConfig
  user: GenesysUser | null
  status: string
  error: string
  isBusy: boolean
  login: () => Promise<void>
}

export const AuthContext =
  createContext<AuthContextValue | null>(null)