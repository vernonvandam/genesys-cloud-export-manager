import { demoExports } from '../../data/demoData'
import StatusPill from './StatusPill'

type ExportTableProps = {
  compact?: boolean
}

export default function ExportTable({
  compact = false,
}: ExportTableProps) {
  const rows = compact
    ? demoExports.slice(0, 3)
    : demoExports

  return (
    <div className="table-scroll">
      <table className="export-table">
        <thead>
          <tr>
            <th scope="col">Export</th>
            <th scope="col">Export type</th>
            <th scope="col">Resources</th>
            <th scope="col">Status</th>
            <th scope="col">Last updated</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((item) => (
            <tr key={item.id}>
              <td>
                <span className="table-primary-text">
                  {item.name}
                </span>
                <span className="table-secondary-text">
                  {item.id}
                </span>
              </td>

              <td>{item.exportType}</td>
              <td>{item.resources}</td>

              <td>
                <StatusPill status={item.status} />
              </td>

              <td>{item.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}