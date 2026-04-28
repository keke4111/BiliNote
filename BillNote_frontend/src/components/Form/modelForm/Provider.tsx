import { useNavigate } from 'react-router-dom'
import ProviderCard from '@/components/Form/modelForm/components/providerCard.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useProviderStore } from '@/store/providerStore'

const Provider = () => {
  const providers = useProviderStore(state => state.provider)
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-2">
      <div className="search flex gap-1 py-1.5">
        <Button type="button" onClick={() => navigate('/settings/model/new')} className="w-full">
          添加模型供应商
        </Button>
      </div>
      <div className="text-sm font-light">模型供应商列表</div>
      <div className="rounded bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-500">
        开关用于控制该供应商下的模型是否出现在首页“模型选择”里，不会删除供应商配置。
      </div>
      <div>
        {providers?.map(provider => (
          <ProviderCard
            key={provider.id}
            providerName={provider.name}
            Icon={provider.logo}
            id={provider.id}
            enable={provider.enabled}
          />
        ))}
      </div>
    </div>
  )
}

export default Provider
