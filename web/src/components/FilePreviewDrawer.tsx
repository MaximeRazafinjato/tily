import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { PreviewKind, type FilePreview } from '../bridge/previewMessages'
import { focusFileTree } from '../explorer/fileExplorerActions'
import { folderName } from '../model/session'
import { closePreview, followPreviewLink, openPreviewInBrowser, openPreviewInEditor } from '../preview/previewActions'
import { overwritePreview, reloadPreviewFromDisk, savePreview, startPreviewEdit, stopPreviewEdit } from '../preview/previewEdit'
import { anchorTarget, highlightText, renderMarkdown } from '../preview/renderPreview'
import { editable, editDirty, usePreviewStore } from '../store/previewStore'
import { GitToolButton } from './GitToolButton'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { PANEL_HEADER_BUTTON } from './rightPanelStyles'

const KIND_LABELS: Record<PreviewKind, string> = {
  [PreviewKind.Markdown]: 'Markdown',
  [PreviewKind.Text]: 'Texte',
  [PreviewKind.Image]: 'Image',
  [PreviewKind.Html]: 'HTML',
}

const PAGE_SANDBOX = 'allow-scripts allow-popups'

const TextEditor = lazy(() => import('./TextEditor').then((module) => ({ default: module.TextEditor })))

const BANNER_BUTTON = 'shrink-0 cursor-pointer rounded border border-tily-line px-[8px] py-[1px] text-[12px] text-tily-ink hover:bg-tily-green-hover'


const handleClose = () => closePreview(focusFileTree)

const handleSave = () => savePreview()

const handleToggleExpanded = () => usePreviewStore.getState().toggleExpanded()

const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    event.preventDefault()
    event.stopPropagation()
    handleClose()
  }
}

const handleContentClick = (event: MouseEvent<HTMLElement>) => {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  if (link) {
    event.preventDefault()
    followPreviewLink(link.getAttribute('href') ?? '')
  }
}

const preventAuxiliaryOpen = (event: MouseEvent<HTMLElement>) => {
  if (event.target instanceof Element && event.target.closest('a[href]')) {
    event.preventDefault()
  }
}

const MARKDOWN_LANGUAGE = 'markdown'

const hasSource = (preview: FilePreview | null): boolean =>
  !preview?.error && (preview?.kind === PreviewKind.Markdown || preview?.kind === PreviewKind.Html)

const pageAddress = (preview: FilePreview | null, source: boolean, anchor: string | null): string | null => {
  if (!preview?.url || preview.error || preview.kind !== PreviewKind.Html || source) {
    return null
  }
  return anchor ? `${preview.url}#${encodeURIComponent(anchor)}` : preview.url
}

const renderedHtml = (preview: FilePreview | null, source: boolean): string | null => {
  if (!preview || preview.error || preview.kind === PreviewKind.Image || (preview.kind === PreviewKind.Html && !source)) {
    return null
  }
  if (preview.kind === PreviewKind.Markdown) {
    return source ? highlightText(preview.content, MARKDOWN_LANGUAGE) : renderMarkdown(preview.content, preview.baseUrl)
  }
  return highlightText(preview.content, preview.language)
}

export function FilePreviewDrawer() {
  const { path, preview, anchor, anchorRequest, expanded, edit } = usePreviewStore(useShallow((store) => ({ path: store.path, preview: store.preview, anchor: store.anchor, anchorRequest: store.anchorRequest, expanded: store.expanded, edit: store.edit })))
  const bodyRef = useRef<HTMLDivElement>(null)
  const [sourcePath, setSourcePath] = useState<string | null>(null)
  const showSource = hasSource(preview) && sourcePath === preview?.path
  const html = useMemo(() => renderedHtml(preview, showSource), [preview, showSource])
  const page = pageAddress(preview, showSource, anchor)
  const handleToggleSource = () => setSourcePath(showSource ? null : (preview?.path ?? null))
  const [image, setImage] = useState<{ src: string; size: string } | null>(null)
  const [actualSource, setActualSource] = useState<string | null>(null)
  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) =>
    setImage({ src: event.currentTarget.getAttribute('src') ?? '', size: `${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}` })
  const actualSize = actualSource !== null && actualSource === preview?.content
  const handleToggleActualSize = () => setActualSource(actualSize ? null : (preview?.content ?? null))
  const imageSize = image && image.src === preview?.content ? image.size : null

  useEffect(() => {
    const body = bodyRef.current
    if (!body) {
      return
    }
    const target = anchor ? anchorTarget(body, anchor) : null
    if (target) {
      target.scrollIntoView({ block: 'start' })
    } else {
      body.scrollTop = 0
    }
  }, [anchorRequest, anchor])

  if (!path) {
    return null
  }
  const name = preview?.name ?? folderName(path)
  const dirty = editDirty(edit)
  const conflict = edit !== null && edit.version !== preview?.version
  const editorLanguage = preview?.kind === PreviewKind.Markdown ? MARKDOWN_LANGUAGE : preview?.language

  return (
    <aside aria-label="Aperçu du fichier" data-preview-drawer="" className={`absolute inset-y-0 right-0 z-20 flex ${expanded ? 'w-full' : 'w-[min(920px,100%)]'} flex-col border-l border-tily-line bg-tily-panel shadow-2xl`} onKeyDown={handleKeyDown}>
      <header className="flex h-[36px] shrink-0 items-center gap-[8px] border-b border-tily-line pr-[6px] pl-[12px]">
        {preview && !preview.error && <span className="shrink-0 rounded bg-tily-paper px-[6px] py-[1px] text-[11px] text-tily-muted">{preview.kind === PreviewKind.Image && imageSize ? `${KIND_LABELS[preview.kind]} · ${imageSize}` : KIND_LABELS[preview.kind]}</span>}
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-tily-ink" data-tip={path}>
          {name}
          {dirty && <span className="ml-[8px] text-[11px] font-normal text-tily-warning">Modifié</span>}
        </span>
        {edit ? (
          <>
            <GitToolButton icon={IconName.Check} tip="Enregistrer (Ctrl+S)" label={edit.saving ? 'Enregistrement…' : 'Enregistrer'} disabled={!dirty || edit.saving} onClick={handleSave} />
            <GitToolButton icon={IconName.Pencil} tip="Quitter l’édition" pressed onClick={stopPreviewEdit} />
          </>
        ) : (
          editable(preview) && <GitToolButton icon={IconName.Pencil} tip="Éditer" pressed={false} onClick={startPreviewEdit} />
        )}
        {!edit && preview && hasSource(preview) && (
          <GitToolButton icon={IconName.File} tip={showSource ? `Revenir au rendu ${KIND_LABELS[preview.kind]}` : `Afficher le texte source du ${KIND_LABELS[preview.kind]}`} pressed={showSource} onClick={handleToggleSource} />
        )}
        {preview?.kind === PreviewKind.Html && !preview.error && <GitToolButton icon={IconName.Browser} tip="Ouvrir dans le navigateur" onClick={openPreviewInBrowser} />}
        <GitToolButton icon={IconName.Editor} tip="Ouvrir dans l’éditeur" onClick={openPreviewInEditor} />
        <GitToolButton icon={IconName.Expand} tip={expanded ? 'Réduire l’aperçu' : 'Agrandir l’aperçu'} pressed={expanded} onClick={handleToggleExpanded} />
        <button type="button" className={PANEL_HEADER_BUTTON} aria-label="Fermer" data-tip="Fermer (Échap)" onClick={handleClose}>
          <Icon name={IconName.Close} />
        </button>
      </header>
      {preview?.truncated && (preview.kind !== PreviewKind.Html || showSource) && <p className="shrink-0 border-b border-tily-line px-[16px] py-[6px] text-[12px] text-tily-warning">Fichier volumineux : seuls les 2 premiers Mo sont affichés, sans modification possible.</p>}
      {conflict && (
        <div role="status" className="flex shrink-0 items-center gap-[8px] border-b border-tily-line px-[16px] py-[6px] text-[12px] text-tily-warning">
          <span className="min-w-0 flex-1 truncate">{preview?.error ?? 'Le fichier a été modifié sur le disque.'}</span>
          <button type="button" className={BANNER_BUTTON} data-tip="Reprendre la version du disque" onClick={reloadPreviewFromDisk}>
            Recharger
          </button>
          <button type="button" className={BANNER_BUTTON} data-tip="Écraser la version du disque" onClick={overwritePreview}>
            Écraser
          </button>
        </div>
      )}
      {edit ? (
        <Suspense fallback={<p className="px-[24px] py-[18px] text-[12px] text-tily-muted">Chargement de l’éditeur…</p>}>
          <TextEditor key={edit.generation} name={name} language={editorLanguage} />
        </Suspense>
      ) : page !== null ? (
        <iframe src={page} title={`Rendu de ${name}`} sandbox={PAGE_SANDBOX} referrerPolicy="no-referrer" className="min-h-0 w-full flex-1 border-0 bg-tily-page" />
      ) : (
        <div ref={bodyRef} tabIndex={0} aria-label={`Contenu de ${name}`} className="min-h-0 flex-1 overflow-auto px-[24px] py-[18px] select-text" onClick={handleContentClick} onAuxClick={preventAuxiliaryOpen}>
          {!preview ? (
            <p className="text-[12px] text-tily-muted">Chargement de l’aperçu…</p>
          ) : preview.error ? (
            <p className="text-[12px] text-tily-error">{preview.error}</p>
          ) : preview.kind === PreviewKind.Image ? (
            <img
              src={preview.content}
              alt={name}
              data-tip={actualSize ? 'Ajuster à la place disponible' : 'Taille réelle'}
              className={`mx-auto block object-contain ${actualSize ? 'max-w-none cursor-zoom-out' : 'max-h-full max-w-full cursor-zoom-in'}`}
              onLoad={handleImageLoad}
              onClick={handleToggleActualSize}
            />
          ) : preview.kind === PreviewKind.Markdown && !showSource && html !== null ? (
            <div className="tily-markdown text-tily-ink" dangerouslySetInnerHTML={{ __html: html }} />
          ) : html !== null ? (
            <pre className="font-mono text-[12px] leading-[1.5] whitespace-pre-wrap text-tily-ink" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <pre className="font-mono text-[12px] leading-[1.5] whitespace-pre-wrap text-tily-ink">{preview.content}</pre>
          )}
        </div>
      )}
    </aside>
  )
}
