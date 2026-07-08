import { NavLink } from 'react-router-dom'

const linkClass = ({ isActive }) =>
  `rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-navy text-white' : 'text-slate-600 hover:bg-teal-pale hover:text-navy'
  }`

/** Sub-navigation shown on every admin page. */
export default function AdminNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
      <NavLink to="/admin" end className={linkClass}>Completions</NavLink>
      <NavLink to="/admin/courses" end className={linkClass}>Courses</NavLink>
      <NavLink to="/admin/users" className={linkClass}>Users</NavLink>
      <NavLink to="/admin/analytics" className={linkClass}>Analytics</NavLink>
    </nav>
  )
}
