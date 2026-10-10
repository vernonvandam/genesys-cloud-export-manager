import {
  GenesysDevIcon,
  GenesysDevIcons,
} from 'genesys-dev-icons'

export default function DemoTag() {
  return (
    <span className="demo-tag">
      <GenesysDevIcon
        icon={GenesysDevIcons.AppInfoSolid}
      />
      Demo data
    </span>
  )
}