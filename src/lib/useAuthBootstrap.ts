import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { UserProfile } from '../types'

export type AppView = 'loading' | 'auth' | 'trainer' | 'client-token' | 'pending-approval' | 'reset-password' | 'demo'

export interface PendingUser {
  uid: string
  email: string
  displayName: string
}

export function useAuthBootstrap() {
  const [view, setView] = useState<AppView>('loading')
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [clientToken, setClientToken] = useState<string | null>(null)
  const loggingOutRef = useRef(false)

  const loadProfile = async (uid: string, email: string) => {
    const { data } = await supabase
      .from('nutricionistas')
      .select('display_name, approved, role')
      .eq('uid', uid)
      .maybeSingle()

    if (!data) { await supabase.auth.signOut(); setView('auth'); return }

    if (data.approved === false) {
      setPendingUser({ uid, email, displayName: data.display_name || email.split('@')[0] })
      setView('pending-approval')
      return
    }

    setUserProfile({
      uid, email,
      displayName: data.display_name || email.split('@')[0],
      role: data.role === 'super_admin' ? 'super_admin' : 'trainer',
      approved: true,
      createdAt: Date.now(),
    })
    setView('trainer')
  }

  const logout = async () => {
    loggingOutRef.current = true
    setView('auth')
    setUserProfile(null)
    setPendingUser(null)
    setTimeout(() => { loggingOutRef.current = false }, 5000)
    await supabase.auth.signOut()
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('c')
    if (token) { setClientToken(token); setView('client-token'); return }
    if (params.get('demo') === '1') { setView('demo'); return }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadProfile(data.session.user.id, data.session.user.email || '')
      else setView('auth')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (loggingOutRef.current) {
        if (event === 'SIGNED_OUT') loggingOutRef.current = false
        return
      }
      if (event === 'PASSWORD_RECOVERY') { setView('reset-password'); return }
      if (session?.user) loadProfile(session.user.id, session.user.email || '')
      else { setView('auth'); setUserProfile(null) }
    })
    return () => subscription.unsubscribe()
  }, [])

  return { view, userProfile, pendingUser, clientToken, logout, setView }
}
