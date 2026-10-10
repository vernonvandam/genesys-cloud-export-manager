type ConfigRowProps = {
  label: string
  value: string
}

export default function ConfigRow({
  label,
  value,
}: ConfigRowProps) {
  return (
    <div className="config-row">
      <span className="config-label">{label}</span>
      <span className="config-value">
        {value || 'Not configured'}
      </span>
    </div>
  )
}