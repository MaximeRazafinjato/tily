import { useEffect, useRef, type PointerEvent } from 'react'
import { UpdateStatus, type UpdateInfo, type UpdateRelease } from '../bridge/updateMessages'
import { cancelUpdateDownload, closeUpdateDialog, downloadPercent, formatDate, formatMebibytes, installUpdate, openReleasePage } from '../update/updateActions'
import { keepTabInside } from './focusTrap'
import { ReleaseNote } from './ReleaseNote'
import { SETTINGS_BUTTON, SETTINGS_HINT, SETTINGS_SECONDARY } from './settingsStyles'

interface UpdateDialogProps {
  info: UpdateInfo
  release: UpdateRelease
}

const PRIMARY = `${SETTINGS_BUTTON} border-tily-green text-tily-green-deep hover:bg-tily-green-soft`

const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
  if (event.target === event.currentTarget) {
    closeUpdateDialog()
  }
}

export function UpdateDialog({ info, release }: UpdateDialogProps) {
  const primaryRef = useRef<HTMLButtonElement>(null)
  const downloading = info.status === UpdateStatus.Downloading
  const percent = downloadPercent(info)

  useEffect(() => {
    primaryRef.current?.focus()
    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeUpdateDialog()
      }
    }
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [])

  const handleOpenPage = () => openReleasePage(info)

  const renderPrimary = () => {
    if (info.blocked) {
      return (
        <button ref={primaryRef} type="button" className={PRIMARY} onClick={handleOpenPage}>
          Télécharger depuis GitHub
        </button>
      )
    }
    if (downloading) {
      return (
        <button ref={primaryRef} type="button" className={SETTINGS_SECONDARY} onClick={cancelUpdateDownload}>
          Annuler le téléchargement
        </button>
      )
    }
    return (
      <button ref={primaryRef} type="button" className={PRIMARY} data-tip="Installer la mise à jour" onClick={installUpdate}>
        {info.status === UpdateStatus.Failed ? 'Réessayer' : 'Installer et redémarrer'}
      </button>
    )
  }

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center bg-tily-paper/60 pt-[10vh]" onPointerDown={handleBackdropPointerDown}>
      <div role="dialog" aria-label={`Tily ${release.version} est disponible`} className="flex max-h-[80vh] w-[560px] max-w-[94vw] flex-col rounded-lg border border-tily-line bg-tily-panel shadow-xl" onKeyDown={keepTabInside}>
        <div className="flex items-baseline justify-between gap-3 border-b border-tily-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-tily-ink">{`Tily ${release.version} est disponible`}</h2>
          <span className={SETTINGS_HINT}>{release.publishedAt ? `Publiée le ${formatDate(release.publishedAt)} · version actuelle ${info.current}` : `Version actuelle ${info.current}`}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {release.notes.length > 0 ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[12px] text-tily-ink marker:text-tily-green">
              {release.notes.map((note) => (
                <li key={note}>
                  <ReleaseNote text={note} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={SETTINGS_HINT}>Aucune note de version : consultez la release sur GitHub.</p>
          )}
          {downloading && (
            <div className="flex flex-col gap-1">
              <div className="h-1.5 overflow-hidden rounded bg-tily-paper" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Téléchargement de la mise à jour">
                <div className="h-full bg-tily-green" style={{ width: `${percent}%` }} />
              </div>
              <span className={SETTINGS_HINT}>{`Téléchargement : ${formatMebibytes(info.received)} sur ${formatMebibytes(info.total)} (${percent} %)`}</span>
            </div>
          )}
          {info.status === UpdateStatus.Failed && info.error && <p className="rounded border border-tily-error/50 bg-tily-paper px-3 py-2 text-[12px] text-tily-error">{info.error}</p>}
          {info.blocked ? (
            <p className="text-[12px] text-tily-warning">{info.blocked}</p>
          ) : (
            <p className={SETTINGS_HINT}>{`Installeur de ${formatMebibytes(release.size)}, vérifié par son empreinte SHA-256 avant installation. Tily se ferme, installe la mise à jour puis redémarre : la session est restaurée avec de nouveaux shells, les programmes en cours sont arrêtés après confirmation. Windows peut demander une autorisation d’administrateur si Tily est installé pour tous les utilisateurs.`}</p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-tily-line px-4 py-3">
          {!info.blocked && (
            <button type="button" className={SETTINGS_SECONDARY} onClick={handleOpenPage}>
              Voir sur GitHub
            </button>
          )}
          <button type="button" className={`${SETTINGS_SECONDARY} ml-auto`} onClick={closeUpdateDialog}>
            Plus tard
          </button>
          {renderPrimary()}
        </div>
      </div>
    </div>
  )
}
