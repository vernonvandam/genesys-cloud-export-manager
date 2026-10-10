import type { DemoStatus } from '../../types/app'

type StatusPillProps = {
  status: DemoStatus
}

export default function StatusPill({
  status,
}: StatusPillProps) {
  const className = status
    .toLowerCase()
    .replace(/\s+/g, '-')

  return (
    <span className={`status-pill status-${className}`}>
      {status}
    </span>
  )
}