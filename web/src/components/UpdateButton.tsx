import { useShallow } from 'zustand/react/shallow'
import { UpdateStatus, type UpdateInfo, type UpdateRelease } from '../bridge/updateMessages'
import { useUpdateStore } from '../store/updateStore'
import { downloadPercent, showUpdateDialog } from '../update/updateActions'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { Spinner } from './Spinner'
import { UpdateDialog } from './UpdateDialog'

const labelOf = (info: UpdateInfo, release: UpdateRelease): string => {
  if (info.status === UpdateStatus.Downloading) {
    return `Téléchargement ${downloadPercent(info)} %`
  }
  return info.status === UpdateStatus.Ready ? `Installer ${release.version}` : `Mise à jour ${release.version}`
}

export function UpdateButton() {
  const { info, dialogOpen } = useUpdateStore(useShallow((state) => ({ info: state.info, dialogOpen: state.dialogOpen })))
  const release = info?.release
  if (!info || !release) {
    return null
  }
  const failed = info.status === UpdateStatus.Failed
  const tone = failed ? 'border-tily-warning text-tily-warning' : 'border-tily-green text-tily-green-deep'

  return (
    <>
      <button
        type="button"
        className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-[3px] hover:bg-tily-green-soft ${tone}`}
        data-tip={failed && info.error ? info.error : `Tily ${release.version} est disponible (version actuelle ${info.current})`}
        onClick={showUpdateDialog}
      >
        {info.status === UpdateStatus.Downloading ? <Spinner size={11} /> : <Icon name={IconName.Fetch} />}
        <span className="text-[12px]">{labelOf(info, release)}</span>
      </button>
      {dialogOpen && <UpdateDialog info={info} release={release} />}
    </>
  )
}
