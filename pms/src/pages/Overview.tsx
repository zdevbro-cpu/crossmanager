import { useState, useEffect } from 'react'
import ExecutiveDashboard from './ExecutiveDashboard'
import OperationsDashboard from './OperationsDashboard'
import { useRole } from '../hooks/useRole'

export default function OverviewPage() {
  const { role } = useRole()
  // Default to Executive view if role is executive, otherwise Operations
  const [viewMode, setViewMode] = useState<'executive' | 'operations'>('operations')

  useEffect(() => {
    if (role === 'executive' || role === 'sysadmin') {
      setViewMode('executive')
    } else {
      setViewMode('operations')
    }
  }, [role])

  return (
    <div style={{ position: 'relative' }}>
      {viewMode === 'executive' ?
        <ExecutiveDashboard viewMode={viewMode} onViewChange={setViewMode} /> :
        <OperationsDashboard viewMode={viewMode} onViewChange={setViewMode} />
      }
    </div>
  )
}
