import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
import { useAppState } from '@/context/AppState'
import { PublicLayout } from '@/layouts/PublicLayout'
import { isSupabaseConfigured } from '@/services/backendMode'
import { signInWithPassword } from '@/services/staffAuth'

export function SignInPage() {
  const { accounts, signIn } = useAppState()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <PublicLayout>
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-2">
        <Card className="p-6">
          <h1 className="font-display text-3xl text-brand-900">Staff sign-in</h1>
          <p className="mt-2 text-sm text-muted">
            Opening this page does not grant access. The backend must authenticate the user and load an active staff
            profile.
          </p>
          {isSupabaseConfigured() ? (
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                setBusy(true)
                setError(null)
                void signInWithPassword(email, password).then((result) => {
                  setBusy(false)
                  if (!result.ok) {
                    if (result.error === 'denied') {
                      navigate('/staff/denied')
                      return
                    }
                    setError(result.error)
                    return
                  }
                  signIn(result.session)
                  navigate(result.session.role === 'admin' ? '/admin' : '/staff')
                })
              }}
            >
              <Field label="Email" htmlFor="email">
                <TextInput id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
              </Field>
              <Field label="Password" htmlFor="password">
                <TextInput
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </Field>
              {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in with Supabase'}
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-muted">Supabase Auth is not configured in this environment.</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-bold text-brand-900">Demonstration sessions</h2>
          <p className="mt-2 text-xs text-muted">
            These accounts exist only in this browser. They are labelled as demo and do not prove a live institutional login.
          </p>
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li key={account.label}>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    signIn(account)
                    if (account.role === 'citizen') navigate('/')
                    else if (!account.staffActive) navigate('/staff/denied')
                    else navigate(account.role === 'admin' ? '/admin' : '/staff')
                  }}
                >
                  {account.label}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </PublicLayout>
  )
}
