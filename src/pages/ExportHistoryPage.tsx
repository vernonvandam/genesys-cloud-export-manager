import DemoTag from '../components/common/DemoTag'
import ExportTable from '../components/common/ExportTable'

export default function ExportHistoryPage() {
  return (
    <div className="workspace-view">
      <div className="page-intro">
        <div>
          <h2 className="page-title">
            Export history
          </h2>
          <p className="page-description">
            Review previous export activity and status.
          </p>
        </div>
        <DemoTag />
      </div>

      <div className="history-summary-grid">
        <div className="history-summary-card">
          <span className="metric-label">
            Sample records
          </span>
          <strong>3</strong>
        </div>

        <div className="history-summary-card">
          <span className="metric-label">
            Completed in sample
          </span>
          <strong>2</strong>
        </div>

        <div className="history-summary-card">
          <span className="metric-label">
            Planned in sample
          </span>
          <strong>1</strong>
        </div>
      </div>

      <section className="panel table-panel history-table-panel">
        <div className="panel-heading">
          <div>
            <h2 className="section-title">
              All export activity
            </h2>
            <p className="section-description">
              Sample records only — not retrieved from
              your organisation.
            </p>
          </div>
        </div>

        <ExportTable />
      </section>
    </div>
  )
}