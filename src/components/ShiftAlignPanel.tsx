import { useMemo } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { suggestAlignParams } from '../lib/chartOption'

type Props = {
  commonNames: string[]
  offsetA: number
  offsetB: number
  onOffsetA: (v: number) => void
  onOffsetB: (v: number) => void
  alignParam: string
  onAlignParam: (name: string) => void
  onAlignPeak: () => void
  onReset: () => void
  range: number
}

function formatOffset(v: number): string {
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(1)} s`
}

function ShiftRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, Number((value + delta).toFixed(1))))
    onChange(next)
  }

  return (
    <div className="shift-row">
      <div className="shift-row-head">
        <span>{label}</span>
        <strong>{formatOffset(value)}</strong>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="shift-nudge">
        <button type="button" className="btn ghost" onClick={() => step(-0.1)}>
          −0.1s
        </button>
        <button type="button" className="btn ghost" onClick={() => step(-1)}>
          −1s
        </button>
        <button type="button" className="btn ghost" onClick={() => step(1)}>
          +1s
        </button>
        <button type="button" className="btn ghost" onClick={() => step(0.1)}>
          +0.1s
        </button>
      </div>
    </div>
  )
}

export function ShiftAlignPanel({
  commonNames,
  offsetA,
  offsetB,
  onOffsetA,
  onOffsetB,
  alignParam,
  onAlignParam,
  onAlignPeak,
  onReset,
  range,
}: Props) {
  const { t } = useI18n()
  const sorted = useMemo(() => suggestAlignParams(commonNames), [commonNames])
  const min = -range
  const max = range

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{t('shift.title')}</h2>
        <button type="button" className="btn ghost" onClick={onReset}>
          {t('shift.reset')}
        </button>
      </div>
      <p className="shift-help">{t('shift.help')}</p>

      <ShiftRow
        label={t('shift.a')}
        value={offsetA}
        min={min}
        max={max}
        onChange={onOffsetA}
      />
      <ShiftRow
        label={t('shift.b')}
        value={offsetB}
        min={min}
        max={max}
        onChange={onOffsetB}
      />

      <div className="align-box">
        <label className="field">
          <span>{t('shift.alignBy')}</span>
          <select
            value={alignParam}
            onChange={(e) => onAlignParam(e.target.value)}
          >
            {sorted.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn primary align-btn"
          disabled={!alignParam}
          onClick={onAlignPeak}
        >
          {t('shift.alignPeak')}
        </button>
      </div>
    </section>
  )
}
