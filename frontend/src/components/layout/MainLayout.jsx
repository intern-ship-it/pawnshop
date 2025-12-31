import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { useAppSelector, useAppDispatch } from '@/app/hooks'
import { loginSuccess } from '@/features/auth/authSlice'
import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import Header from './Header'
import Toast from '@/components/common/Toast'

export default function MainLayout() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const { sidebarCollapsed, toasts } = useAppSelector((state) => state.ui)

  useEffect(() => {
    // Check for stored auth on mount
    const storedAuth = localStorage.getItem('pawnsys_auth')

    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth)
        if (authData.isAuthenticated) {
          dispatch(loginSuccess({
            user: authData.user,
            role: authData.role,
          }))
        }
      } catch (e) {
        console.error('Error parsing stored auth:', e)
      }
    }

    if (!isAuthenticated && !storedAuth) {
      navigate('/login')
    }
  }, [dispatch, isAuthenticated, navigate])

  return (
    <div className="min-h-screen bg-stone-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'ml-20' : 'ml-64'
        )}
      >
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="pt-16">
          <div className="p-4 lg:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
        ))}
      </div>
    </div>
  )
}
