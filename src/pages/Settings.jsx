import { Settings as SettingsIcon } from 'lucide-react'
import EmptyState from '../components/EmptyState.jsx'
import PageHeader from '../components/PageHeader.jsx'

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="设置"
        description="管理应用偏好、数据备份与识别配置。"
      />
      <EmptyState
        icon={SettingsIcon}
        title="设置项待实现"
        description="后续任务将在此提供本地数据导出与偏好设置。"
      />
    </div>
  )
}
