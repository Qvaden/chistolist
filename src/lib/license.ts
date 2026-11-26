const STORAGE_RECIPES_KEY = 'chistolist_csv_recipes'
const STORAGE_WATERMARKS_KEY = 'chistolist_pdf_watermarks'

export interface SavedCsvRecipe {
  id: string
  name: string
  trimAndCollapse: boolean
  removeEmptyRows: boolean
  deduplicate: boolean
  dedupeColumn: string
  normalizePhones: boolean
  phoneFormat: 'digits' | 'formatted'
  normalizeEmails: boolean
  splitFio: boolean
}

export interface SavedWatermarkPreset {
  id: string
  name: string
  text: string
  opacity: number
  mode: 'center' | 'tiled'
}

export function getSavedCsvRecipes(): SavedCsvRecipe[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECIPES_KEY)
    return raw ? (JSON.parse(raw) as SavedCsvRecipe[]) : []
  } catch {
    return []
  }
}

export function saveCsvRecipe(recipe: SavedCsvRecipe): SavedCsvRecipe[] {
  const existing = getSavedCsvRecipes().filter((r) => r.id !== recipe.id)
  const next = [recipe, ...existing].slice(0, 12)
  try {
    localStorage.setItem(STORAGE_RECIPES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function deleteCsvRecipe(id: string): SavedCsvRecipe[] {
  const next = getSavedCsvRecipes().filter((r) => r.id !== id)
  try {
    localStorage.setItem(STORAGE_RECIPES_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

export function getSavedWatermarkPresets(): SavedWatermarkPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_WATERMARKS_KEY)
    return raw ? (JSON.parse(raw) as SavedWatermarkPreset[]) : []
  } catch {
    return []
  }
}

export function saveWatermarkPreset(preset: SavedWatermarkPreset): SavedWatermarkPreset[] {
  const existing = getSavedWatermarkPresets().filter((p) => p.id !== preset.id)
  const next = [preset, ...existing].slice(0, 12)
  try {
    localStorage.setItem(STORAGE_WATERMARKS_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
