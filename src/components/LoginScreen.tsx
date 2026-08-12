import { useEffect, useState, type FormEvent } from 'react'
import { loginWithPassword } from '../lib/auth'
import { useI18n } from '../i18n/I18nContext'
import { LangSwitcher } from './LangSwitcher'

const SLIDES = [
  './login/hq-1.png',
  './login/hq-2.png',
  './login/hq-3.png',
]

type Props = {
  onSuccess: () => void
}

export function LoginScreen({ onSuccess }: Props) {
  const { t } = useI18n()
  const [index, setIndex] = useState(0)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length)
    }, 5500)
    return () => window.clearInterval(id)
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (loginWithPassword(password.trim())) {
      setError(false)
      onSuccess()
      return
    }
    setError(true)
  }

  return (
    <div className="login-screen">
      <div className="login-carousel" aria-hidden="true">
        {SLIDES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            className={i === index ? 'on' : ''}
          />
        ))}
        <div className="login-veil" />
      </div>

      <div className="login-top">
        <LangSwitcher />
      </div>

      <div className="login-card">
        <img className="login-logo" src="./texa-logo.png" alt="TEXA" />
        <h1>TEXA Parameter Viewer</h1>
        <p>{t('login.subtitle')}</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>{t('login.password')}</span>
            <input
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError(false)
              }}
            />
          </label>
          {error ? <p className="login-error">{t('login.error')}</p> : null}
          <button type="submit" className="btn primary login-submit">
            {t('login.submit')}
          </button>
        </form>
      </div>

      <div className="login-dots">
        {SLIDES.map((src, i) => (
          <button
            key={src}
            type="button"
            className={i === index ? 'on' : ''}
            aria-label={`${i + 1}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  )
}
