import type {
  DemoExport,
  ResourceCategory,
} from '../types/app'

export const demoExports: DemoExport[] = [
  {
    id: 'DEMO-1042',
    name: 'Configuration backup',
    exportType: 'Full configuration',
    status: 'Completed',
    resources: '48 resources',
    date: '09 Oct 2026 · 9:15 AM',
  },
  {
    id: 'DEMO-1041',
    name: 'Configuration snapshot',
    exportType: 'Configuration export',
    status: 'Completed',
    resources: '32 resources',
    date: '08 Oct 2026 · 4:42 PM',
  },
  {
    id: 'DEMO-1040',
    name: 'Resource preview',
    exportType: 'Resource preview',
    status: 'Planned',
    resources: 'Sample only',
    date: '08 Oct 2026 · 11:20 AM',
  },
]

export const resourceCategories: ResourceCategory[] = [
  {
    title: 'Users and groups',
    description:
      'Manage user, team and group configuration exports.',
  },
  {
    title: 'Queues and routing',
    description:
      'Review queue, routing and skill configuration.',
  },
  {
    title: 'Divisions',
    description:
      'Review division information and assignments.',
  },
  {
    title: 'Data tables',
    description:
      'Manage configuration data table exports.',
  },
]