import type { PersistenceSettings, Settings } from '../bridge/messages'

export interface NumberField {
  key: keyof PersistenceSettings
  label: string
  unit?: string
  hint: string
  min: number
  max: number
}

export type NumberTexts = Partial<Record<keyof PersistenceSettings, string>>

const INTEGER_PATTERN = /^\d+$/

export const NUMBER_FIELDS: NumberField[] = [
  { key: 'textIntervalSeconds', label: 'Sauvegarde du texte', unit: 's', hint: 'Intervalle entre deux écritures du texte des terminaux.', min: 5, max: 600 },
  { key: 'linesPerPane', label: 'Lignes par pane', hint: 'Historique xterm.js ; s’applique aux terminaux lancés après l’enregistrement.', min: 500, max: 100000 },
  { key: 'maxTextMebibytes', label: 'Historique maximal', unit: 'Mio', hint: 'Au-delà, les panes les plus récents ne sont plus sauvegardés.', min: 16, max: 2048 },
]

export const numberFieldId = (key: keyof PersistenceSettings): string => `settings-${key}`

export const valueWithin = (text: string, field: NumberField): number | null => {
  const value = INTEGER_PATTERN.test(text) ? Number.parseInt(text, 10) : Number.NaN
  return value >= field.min && value <= field.max ? value : null
}

export const numberTextOf = (settings: Settings, texts: NumberTexts, field: NumberField): string => texts[field.key] ?? String(settings.persistence[field.key])
