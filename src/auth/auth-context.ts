import { createContext } from 'react'

import type {
  GenesysConfig,
  GenesysOrganization,
  GenesysUser,
} from '../types/app'

export type AuthMode = 'integrated' | 'standalone'

export type AuthContextValue = {
  config: GenesysConfig;
  mode: AuthMode;
  user: GenesysUser | null;
  organization: GenesysOrganization | null;
  accessToken: string | null;
  status: string;
  error: string;
  isBusy: boolean;
  disconnectGenesys: () => void;
  login: () => Promise<void>;
};

export const AuthContext =
  createContext<AuthContextValue | null>(null)