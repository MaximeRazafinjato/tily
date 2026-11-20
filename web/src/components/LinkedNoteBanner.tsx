import { bridge } from '../bridge/bridge'
import { useWindowStore } from '../store/windowStore'

interface LinkedNoteBannerProps {
  workspaceId: string
  workspaceName: string
}

const BUTTON = 'shrink-0 cursor-pointer self-end rounded border border-tily-line px-2 py-[2px] text-[11px] text-tily-ink hover:bg-tily-green-hover'

export function LinkedNoteBanner({ workspaceId, workspaceName }: LinkedNoteBannerProps) {
  const originOpen = useWindowStore((state) => state.mainWorkspaces.some((workspace) => workspace.id === workspaceId))

  const handleShowOrigin = () => bridge.send({ type: 'window.showMainNote', workspace: workspaceId })

  return (
    <div role="note" className="mb-[6px] flex flex-col gap-[6px] rounded border border-tily-line bg-tily-paper px-[10px] py-[6px] text-[11px] leading-[1.45] text-tily-muted">
      {originOpen ? (
        <p>
          <strong className="text-tily-warning">Lecture seule</strong> : cette note appartient au workspace « {workspaceName} » de la fenêtre principale, qui la tient à jour ici.
          Modifiez-la là-bas.
        </p>
      ) : (
        <p>
          <strong className="text-tily-warning">Lecture seule</strong> : le workspace « {workspaceName} » n’existe plus dans la fenêtre principale. Cette copie redeviendra modifiable
          si vous rattachez l’onglet.
        </p>
      )}
      {originOpen && (
        <button type="button" className={BUTTON} onClick={handleShowOrigin}>
          Ouvrir dans la fenêtre principale
        </button>
      )}
    </div>
  )
}
