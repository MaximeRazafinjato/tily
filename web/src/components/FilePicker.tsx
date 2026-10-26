import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { closeFilePicker, insertProjectFilePath, openProjectFile, previewProjectFile, revealProjectFile } from '../explorer/projectFileActions'
import type { SearchItem } from '../palette/searchFilter'
import { recentKey, useFilePickerStore, type ProjectFileList } from '../store/filePickerStore'
import { SearchDialog } from './SearchDialog'

const MAX_RESULTS = 200
const LAST_SEPARATOR = /^(.*)\\([^\\]+)$/
const LOADING = 'Chargement des fichiers…'
const NO_MATCH = 'Aucun fichier ne correspond à la recherche.'
const TRUNCATED = 'Liste incomplète (plus de 20 000 fichiers, ou parcours hors dépôt arrêté après 3 secondes) : un fichier absent de la liste ne peut pas être trouvé ici.'
const FOOTER = 'Entrée : éditeur · Alt+Entrée : aperçu · Maj+Entrée : afficher dans l’arbre · Ctrl+Entrée : insérer le chemin dans le terminal'

const CHANGED_HINT = 'modifié'
const RECENT_HINT = 'récent'
const HINT_SEPARATOR = ' · '
const NO_RECENT: string[] = []

const itemOf = (relative: string, tag?: string): SearchItem => {
  const match = LAST_SEPARATOR.exec(relative)
  const folder = match?.[1]
  const hint = tag ? (folder ? `${tag}${HINT_SEPARATOR}${folder}` : tag) : folder
  return { id: relative, label: match ? match[2] : relative, hint, searchText: relative }
}

const itemsOf = (list: ProjectFileList | null, recent: string[]): SearchItem[] => {
  if (!list) {
    return []
  }
  const changed = new Set(list.changed)
  const present = new Set(list.files)
  const recentFiles = recent.filter((relative) => present.has(relative) && !changed.has(relative))
  const first = new Set([...list.changed, ...recentFiles])
  return [
    ...list.changed.map((relative) => itemOf(relative, CHANGED_HINT)),
    ...recentFiles.map((relative) => itemOf(relative, RECENT_HINT)),
    ...list.files.filter((relative) => !first.has(relative)).map((relative) => itemOf(relative)),
  ]
}

const emptyMessageOf = (list: ProjectFileList | null): string => {
  if (!list) {
    return LOADING
  }
  if (list.error) {
    return list.error
  }
  return list.files.length === 0 ? `Aucun fichier dans ${list.root}.` : NO_MATCH
}

export function FilePicker() {
  const { folder, list, recent } = useFilePickerStore(useShallow((state) => ({ folder: state.folder, list: state.list, recent: state.list ? (state.recent[recentKey(state.list.root)] ?? NO_RECENT) : NO_RECENT })))
  const items = useMemo(() => itemsOf(list, recent), [list, recent])
  if (folder === null) {
    return null
  }
  const root = list?.root ?? folder
  const handleRun = (item: SearchItem) => openProjectFile(root, item.id)
  const handleRunAlternate = (item: SearchItem) => revealProjectFile(root, item.id)
  const handleRunControl = (item: SearchItem) => insertProjectFilePath(root, item.id)
  const handleRunAlt = (item: SearchItem) => previewProjectFile(root, item.id)

  return (
    <SearchDialog
      label="Ouvrir un fichier du projet"
      placeholder={`Fichier dans ${root}…`}
      emptyMessage={emptyMessageOf(list)}
      items={items}
      maxResults={MAX_RESULTS}
      onClose={closeFilePicker}
      onRun={handleRun}
      onRunAlternate={handleRunAlternate}
      onRunControl={handleRunControl}
      onRunAlt={handleRunAlt}
      footer={FOOTER}
      notice={list?.truncated ? TRUNCATED : null}
    />
  )
}
