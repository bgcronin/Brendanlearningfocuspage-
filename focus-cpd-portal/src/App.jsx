import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { RequireAuth, RequireAdmin } from './components/Protected'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import VerifyCertificate from './pages/VerifyCertificate'
import Privacy from './pages/Privacy'
import Catalogue from './pages/Catalogue'
import CoursePage from './pages/CoursePage'
import MyCpd from './pages/MyCpd'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCourses from './pages/admin/AdminCourses'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import CourseEditor from './pages/admin/CourseEditor'
import useDocumentHead from './lib/useDocumentHead'

function NotFound() {
  useDocumentHead({ title: 'Page not found', canonical: false, robots: 'noindex' })
  return <div className="py-24 text-center text-slate-500">Page not found.</div>
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/courses" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify" element={<VerifyCertificate />} />
        <Route path="/privacy" element={<Privacy />} />

        <Route path="/courses" element={<RequireAuth><Catalogue /></RequireAuth>} />
        <Route path="/courses/:id" element={<RequireAuth><CoursePage /></RequireAuth>} />
        <Route path="/my-cpd" element={<RequireAuth><MyCpd /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

        <Route path="/admin" element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin><AdminUsers /></RequireAdmin>} />
        <Route path="/admin/analytics" element={<RequireAdmin><AdminAnalytics /></RequireAdmin>} />
        <Route path="/admin/courses" element={<RequireAdmin><AdminCourses /></RequireAdmin>} />
        <Route path="/admin/courses/new" element={<RequireAdmin><CourseEditor /></RequireAdmin>} />
        <Route path="/admin/courses/:id" element={<RequireAdmin><CourseEditor /></RequireAdmin>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}
