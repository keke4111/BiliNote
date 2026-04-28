import { FC } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AILogo from '@/components/Form/modelForm/Icons'
import { Switch } from '@/components/ui/switch'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import styles from './index.module.css'

export interface IProviderCardProps {
  id: string
  providerName: string
  Icon: string
  enable: number
}

const ProviderCard: FC<IProviderCardProps> = ({ providerName, Icon, id, enable }) => {
  const navigate = useNavigate()
  const { id: currentId } = useParams()
  const updateProvider = useProviderStore(state => state.updateProvider)
  const loadEnabledModels = useModelStore(state => state.loadEnabledModels)
  const isActive = currentId === id

  const handleClick = () => {
    navigate(`/settings/model/${id}`)
  }

  const handleEnable = async () => {
    await updateProvider({
      id,
      enabled: enable === 1 ? 0 : 1,
    })
    await loadEnabledModels()
  }

  return (
    <div
      onClick={handleClick}
      className={
        styles.card +
        ' flex h-14 items-center justify-between rounded border border-[#f3f3f3] p-2' +
        (isActive ? ' bg-[#F0F0F0] font-semibold text-blue-600' : '')
      }
    >
      <div className="flex items-center text-lg">
        <div className="flex h-9 w-9 items-center">
          <AILogo name={Icon} />
        </div>
        <div className="font-semibold">{providerName}</div>
      </div>

      <div>
        <Switch
          onClick={event => {
            event.preventDefault()
            handleEnable()
          }}
          checked={enable === 1}
        />
      </div>
    </div>
  )
}

export default ProviderCard
