import { useState } from 'react'
import App from '../App'
import { isAuthenticated, isWebApp, logout } from '../lib/auth'
import { LoginScreen } from './LoginScreen'

export function AuthGate() {
  const [ok, setOk] = useState(() => isAuthenticated())

  if (!ok) {
    return <LoginScreen onSuccess={() => setOk(true)} />
  }

  return (
    <App
      onLogout={
        isWebApp()
          ? () => {
              logout()
              setOk(false)
            }
          : undefined
      }
    />
  )
}
