import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Loading() {
  return (
    <div className="flex justify-center py-24">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-pale border-t-teal" />
    </div>
  )
}

/** Requires a signed-in user. */
export function RequireAuth({ children }) {
  const { session } = useAuth()
  const location = useLocation()
  if (session === undefined) return <Loading />
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return children
}

/** Requires a signed-in admin. */
export function RequireAdmin({ children }) {
  const { session, profile, profileLoading, profileError, refreshProfile } = useAuth()
  if (session === undefined || (session && profileLoading)) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (profileError) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-navy">Couldn&apos;t load your account</h1>
        <p className="mt-2 text-sm text-slate-500">
          We couldn&apos;t check your permissions just now. Please try again.
        </p>
        <button onClick={() => refreshProfile()} className="btn-primary mt-4">Try again</button>
      </div>
    )
  }
  if (!profile?.is_admin) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold text-navy">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your account doesn&apos;t have admin permissions for the Focus Vision CPD portal.
        </p>
      </div>
    )
  }
  return children
}
