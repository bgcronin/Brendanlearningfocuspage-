import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({
  session: undefined,
  profile: null,
  profileLoading: true,
  refreshProfile: async () => {},
})

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

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
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).single()
    setProfile(data ?? null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!session?.user) {
        setProfile(null)
        setProfileLoading(session === undefined)
        return
      }
      setProfileLoading(true)
      const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
      if (!cancelled) {
        setProfile(data ?? null)
        setProfileLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [session?.user?.id, session])

  return (
    <AuthContext.Provider value={{ session, profile, profileLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
