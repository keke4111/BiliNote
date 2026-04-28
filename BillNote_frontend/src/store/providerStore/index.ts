import { create } from 'zustand'
import { IProvider } from '@/types'
import {
  addProvider,
  getProviderById,
  getProviderList,
  updateProviderById,
} from '@/services/model.ts'

interface ProviderStore {
  provider: IProvider[]
  setProvider: (provider: IProvider) => void
  setAllProviders: (providers: IProvider[]) => void
  getProviderById: (id: string) => IProvider | undefined
  getProviderList: () => IProvider[]
  fetchProviderList: () => Promise<void>
  loadProviderById: (id: string) => Promise<IProvider | null>
  addNewProvider: (provider: Partial<IProvider>) => Promise<string | null>
  updateProvider: (provider: Partial<IProvider> & { id: string }) => Promise<void>
}

const normalizeProvider = (item: any): IProvider | null => {
  if (!item || typeof item !== 'object') return null

  return {
    id: String(item.id ?? ''),
    name: item.name ?? '',
    logo: item.logo ?? 'Custom',
    apiKey: item.apiKey ?? item.api_key ?? '',
    baseUrl: item.baseUrl ?? item.base_url ?? '',
    type: item.type ?? 'custom',
    enabled: Number(item.enabled ?? 0),
  }
}

const normalizeProviderList = (value: any): IProvider[] => {
  const list = Array.isArray(value) ? value : []
  return list.map(normalizeProvider).filter((item): item is IProvider => Boolean(item?.id))
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  provider: [],

  // 添加或更新一个 provider
  setProvider: newProvider =>
    set(state => {
      const exists = state.provider.find(p => p.id === newProvider.id)
      if (exists) {
        return {
          provider: state.provider.map(p => (p.id === newProvider.id ? newProvider : p)),
        }
      } else {
        return { provider: [...state.provider, newProvider] }
      }
    }),

  // 设置整个 provider 列表
  setAllProviders: providers => set({ provider: providers }),
  loadProviderById: async (id: string) => {
    try {
      const res = await getProviderById(id)
      return normalizeProvider(res)
    } catch (error) {
      console.error('Error loading provider:', error)
      return null
    }
  },
  addNewProvider: async (provider: Partial<IProvider>) => {
    const payload = {
      ...provider,
      api_key: provider.apiKey,
      base_url: provider.baseUrl,
    }
    try {
      const res: any = await addProvider(payload)
      console.log('Provider ', res)
      await get().fetchProviderList()
      return res?.id ? String(res.id) : null
    } catch (error) {
      console.error('Error fetching provider:', error)
    }
    return null
  },
  // 按 id 获取单个 provider
  getProviderById: id => get().provider.find(p => p.id === id),
  updateProvider: async (provider: Partial<IProvider> & { id: string }) => {
    try {
      const data = {
        ...provider,
        api_key: provider.apiKey,
        base_url: provider.baseUrl,
      }
      const res = await updateProviderById(data)
      console.log('Provider ', res)
      await get().fetchProviderList()
    } catch (error) {
      console.error('Error fetching provider:', error)
    }
  },
  getProviderList: () => get().provider,
  fetchProviderList: async () => {
    try {
      const res = await getProviderList()
      set({ provider: normalizeProviderList(res) })
    } catch (error) {
      console.error('Error fetching provider list:', error)
      set({ provider: [] })
    }
  },
}))
