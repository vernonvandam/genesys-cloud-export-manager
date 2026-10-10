export type GenesysUser = {
  id?: string
  name?: string
  email?: string
}

export type GenesysConfig = {
  clientId: string
  region: string
  redirectUri: string
}

export type DemoStatus =
  | 'Completed'
  | 'In progress'
  | 'Planned'

export type DemoExport = {
  id: string
  name: string
  exportType: string
  status: DemoStatus
  resources: string
  date: string
}

export type ResourceCategory = {
  title: string
  description: string
}