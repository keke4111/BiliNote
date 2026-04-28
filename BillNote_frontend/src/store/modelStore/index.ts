import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  addModel,
  deleteModelById,
  fetchEnableModelById,
  fetchEnableModels,
  fetchModels,
} from '@/services/model'

interface IModel {
  id: string
  created: number
  object: string
  owned_by: string
  permission: string
  root: string
}

interface IModelListItem {
  id: string
  provider_id: string
  model_name: string
  created_at?: string
}

interface ModelStore {
  models: IModel[]
  modelList: IModelListItem[]
  loading: boolean
  selectedModel: string
  loadModels: (providerId: string) => Promise<void>
  loadModelsById: (providerId: string) => Promise<IModelListItem[]>
  loadEnabledModels: () => Promise<void>
  addNewModel: (providerId: string, modelId: string) => Promise<void>
  deleteModel: (modelId: number) => Promise<void>
  setSelectedModel: (modelId: string) => void
  clearModels: () => void
}

const normalizeRemoteModels = (value: any): IModel[] => {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(value?.models)
      ? value.models
      : Array.isArray(value?.models?.data)
        ? value.models.data
        : Array.isArray(value?.data)
          ? value.data
          : []

  return list
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => ({
      id: String(item.id ?? item.model_name ?? ''),
      created: Number(item.created ?? Date.now()),
      object: item.object ?? 'model',
      owned_by: item.owned_by ?? '',
      permission: item.permission ?? '',
      root: item.root ?? '',
    }))
    .filter((model: IModel) => model.id)
}

const normalizeEnabledModels = (value: any): IModelListItem[] => {
  const list = Array.isArray(value) ? value : []
  return list
    .filter((item: any) => item && typeof item === 'object')
    .map((item: any) => ({
      id: String(item.id ?? ''),
      provider_id: String(item.provider_id ?? ''),
      model_name: String(item.model_name ?? item.id ?? ''),
      created_at: item.created_at,
    }))
    .filter(model => model.id && model.model_name)
}

export const useModelStore = create<ModelStore>()(
  devtools(set => ({
    models: [],
    modelList: [],
    loading: false,
    selectedModel: '',

    loadEnabledModels: async () => {
      try {
        set({ loading: true })
        const list = await fetchEnableModels()
        set({ modelList: normalizeEnabledModels(list) })
      } catch (error) {
        set({ modelList: [] })
        console.error('加载可用模型失败', error)
      } finally {
        set({ loading: false })
      }
    },

    loadModels: async (providerId: string) => {
      try {
        set({ loading: true })
        const res = await fetchModels(providerId)
        set({ models: normalizeRemoteModels(res) })
      } catch (error) {
        set({ models: [] })
        console.error('加载模型列表失败', error)
      } finally {
        set({ loading: false })
      }
    },

    loadModelsById: async (providerId: string) => {
      try {
        const models = await fetchEnableModelById(providerId)
        return normalizeEnabledModels(models)
      } catch (error) {
        console.error('加载供应商模型失败', error)
        return []
      }
    },

    addNewModel: async (providerId: string, modelId: string) => {
      try {
        const res = await addModel({ provider_id: providerId, model_name: modelId })
        const result = res as any
        if (!result || (typeof result === 'object' && 'code' in result && result.code !== 0)) {
          console.error('新增模型失败', result?.msg)
          return
        }

        set(state => ({
          models: [
            ...state.models,
            {
              id: modelId,
              created: Date.now(),
              object: 'model',
              owned_by: '',
              permission: '',
              root: '',
            },
          ],
        }))

        const enabledList = await fetchEnableModels()
        set({ modelList: normalizeEnabledModels(enabledList) })
      } catch (error) {
        console.error('添加模型出错', error)
      }
    },

    deleteModel: async (modelId: number) => {
      try {
        await deleteModelById(modelId)
        set(state => ({
          models: state.models.filter(model => model.id !== modelId.toString()),
        }))

        const enabledList = await fetchEnableModels()
        set({ modelList: normalizeEnabledModels(enabledList) })
      } catch (error) {
        console.error('删除模型失败', error)
      }
    },

    setSelectedModel: (modelId: string) => set({ selectedModel: modelId }),

    clearModels: () => set({ models: [], selectedModel: '', modelList: [] }),
  }))
)
