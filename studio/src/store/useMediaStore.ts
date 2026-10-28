import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { MediaAsset } from '@/types/project'

interface MediaState {
  assets: MediaAsset[]
  selectedAssetId: string | null
  searchQuery: string
  filterType: 'all' | 'video' | 'audio' | 'image'

  addAsset: (asset: MediaAsset) => void
  removeAsset: (id: string) => void
  selectAsset: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilterType: (type: MediaState['filterType']) => void
  filteredAssets: () => MediaAsset[]
}

export const useMediaStore = create<MediaState>()(
  immer((set, get) => ({
    assets: [],
    selectedAssetId: null,
    searchQuery: '',
    filterType: 'all',

    addAsset: (asset) => set(s => { s.assets.unshift(asset) }),
    removeAsset: (id) => set(s => { s.assets = s.assets.filter(a => a.id !== id) }),
    selectAsset: (id) => set(s => { s.selectedAssetId = id }),
    setSearchQuery: (q) => set(s => { s.searchQuery = q }),
    setFilterType: (type) => set(s => { s.filterType = type }),

    filteredAssets: () => {
      const { assets, searchQuery, filterType } = get()
      return assets.filter(a => {
        const matchType = filterType === 'all' || a.type === filterType
        const matchSearch = !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
        return matchType && matchSearch
      })
    },
  }))
)
