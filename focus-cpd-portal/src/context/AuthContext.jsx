import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  session: undefined,
  profile: null,
  profileLoading: true,
  profileError: false,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (!s?.user) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', s.user.id).single()
    setProfileError(Boolean(error))
    if (!error) setProfile(data ?? null)
  }, [])

  // Re-fetch the profile only when the *user* changes, keyed on a derived
  // auth state ('loading' | 'anon' | <user id>). A token refresh emits a new
  // session object with the same user id, so keying on the object identity
  // (the old behaviour) needlessly re-ran this, flipped profileLoading, and
  // remounted admin routes — losing unsaved editor work.
  const authState = session === undefined ? 'loading' : session?.user?.id ?? 'anon'
  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!session?.user) {
        setProfile(null)
        setProfileError(false)
        setProfileLoading(session === undefined)
        return
      }
      setProfileLoading(true)
      setProfileError(false)
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!cancelled) {
        if (error) setProfileError(true)
        else setProfile(data ?? null)
        setProfileLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState])

  return (
    <AuthContext.Provider value={{ session, profile, profileLoading, profileError, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
