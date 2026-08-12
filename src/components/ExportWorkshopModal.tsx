import { useI18n } from '../i18n/I18nContext'
import type { WorkshopInfo } from './WorkshopForm'
import {
  clampExportWindow,
  type ExportWindow,
} from '../lib/chartOption'

type Props = {
  value: WorkshopInfo
  onChange: (next: WorkshopInfo) => void
  onConfirm: () => void
  onCancel: () => void
  busy?: boolean
  exportWindow: ExportWindow
  onExportWindow: (next: ExportWindow) => void
  startLabel: string
  endLabel: string
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
  exportWindow,
  onExportWindow,
  startLabel,
  endLabel,
}: Props) {
  const { t } = useI18n()
  const win = clampExportWindow(exportWindow)

  const setStart = (v: number) => {
    onExportWindow(
      clampExportWindow({ startPercent: v, endPercent: win.endPercent }),
    )
  }

  const setEnd = (v: number) => {
    onExportWindow(
      clampExportWindow({ startPercent: win.startPercent, endPercent: v }),
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="modal-card modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="export-modal-title">{t('modal.exportTitle')}</h2>
          <p>{t('modal.exportHint')}</p>
        </div>
        <div className="modal-body">
          <section className="export-range">
            <h3>{t('modal.rangeTitle')}</h3>
            <p className="export-range-hint">{t('modal.rangeHint')}</p>
            <div className="export-range-labels">
              <span>
                {t('modal.rangeFrom')}: <strong>{startLabel}</strong>
              </span>
              <span>
                {t('modal.rangeTo')}: <strong>{endLabel}</strong>
              </span>
            </div>
            <label className="field">
              <span>
                {t('modal.rangeStart')} ({win.startPercent.toFixed(0)}%)
              </span>
              <input
                type="range"
                min={0}
                max={99}
                step={0.5}
                value={win.startPercent}
                disabled={busy}
                onChange={(e) => setStart(Number(e.target.value))}
              />
            </label>
            <label className="field">
              <span>
                {t('modal.rangeEnd')} ({win.endPercent.toFixed(0)}%)
              </span>
              <input
                type="range"
                min={1}
                max={100}
                step={0.5}
                value={win.endPercent}
                disabled={busy}
                onChange={(e) => setEnd(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() =>
                onExportWindow({ startPercent: 0, endPercent: 100 })
              }
            >
              {t('modal.rangeFull')}
            </button>
          </section>
          <div className="form-grid">
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
