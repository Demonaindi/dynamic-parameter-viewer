import { useCallback, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'

type Props = {
  onFile: (file: File) => void
  busy?: boolean
  title?: string
  subtitle?: string
  tone?: 'default' | 'a' | 'b'
}

export function FileDropzone({
  onFile,
  busy = false,
  title,
  subtitle,
  tone = 'default',
}: Props) {
  const { t } = useI18n()
  const [drag, setDrag] = useState(false)

  const take = useCallback(
    (files: FileList | null) => {
      const file = files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  return (
    <label
      className={`dropzone tone-${tone} ${drag ? 'drag' : ''} ${busy ? 'busy' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        take(e.dataTransfer.files)
      }}
    >
      <input
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm"
        disabled={busy}
        onChange={(e) => take(e.target.files)}
      />
      <div>
        <strong>{title ?? t('drop.title')}</strong>
        <p>{subtitle ?? t('drop.subtitle')}</p>
      </div>
    </label>
  )
}
