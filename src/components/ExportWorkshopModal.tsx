import { useI18n } from '../i18n/I18nContext'
import type { WorkshopInfo } from './WorkshopForm'

type Props = {
  value: WorkshopInfo
  onChange: (next: WorkshopInfo) => void
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
}

const fields: { key: keyof WorkshopInfo; labelKey: string }[] = [
  { key: 'razonSocial', labelKey: 'workshop.razonSocial' },
  { key: 'operador', labelKey: 'workshop.operador' },
  { key: 'direccion', labelKey: 'workshop.direccion' },
  { key: 'ciudad', labelKey: 'workshop.ciudad' },
  { key: 'provincia', labelKey: 'workshop.provincia' },
  { key: 'telefono', labelKey: 'workshop.telefono' },
  { key: 'email', labelKey: 'workshop.email' },
  { key: 'matricula', labelKey: 'workshop.matricula' },
  { key: 'vin', labelKey: 'workshop.vin' },
]

export function ExportWorkshopModal({
  value,
  onChange,
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  const { t } = useI18n()

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="export-modal-title">{t('modal.exportTitle')}</h2>
          <p>{t('modal.exportHint')}</p>
        </div>
        <div className="modal-body form-grid">
          {fields.map((f) => (
            <label key={f.key} className="field">
              <span>{t(f.labelKey)}</span>
              <input
                value={value[f.key]}
                onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
                placeholder={t(f.labelKey)}
                disabled={busy}
              />
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            {t('modal.cancel')}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('btn.generating') : t('modal.confirmPdf')}
          </button>
        </div>
      </div>
    </div>
  )
}
