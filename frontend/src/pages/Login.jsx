import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAppDispatch } from '@/app/hooks'
import { loginStart, loginSuccess, loginFailure } from '@/features/auth/authSlice'
import { addToast } from '@/features/ui/uiSlice'
import { cn } from '@/lib/utils'
import { authService } from '@/services'
import Button from '@/components/common/Button'
import { User, Lock, Eye, EyeOff, Check } from 'lucide-react'
import { motion } from 'framer-motion'

// Demo accounts for quick testing
const demoAccounts = [
  { username: 'admin', password: 'admin123', role: 'Administrator' },
  { username: 'manager', password: 'manager123', role: 'Manager' },
  { username: 'cashier', password: 'cashier123', role: 'Cashier' },
  { username: 'auditor', password: 'auditor123', role: 'Auditor' },
]

// Features list
const features = [
  'KPKT Malaysia Compliant',
  'Real-time Gold Price Tracking',
  'Comprehensive Reporting',
  'Multi-branch Support',
]

export default function Login() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)
    dispatch(loginStart())

    try {
      // Call real API - backend accepts both email and username
      const response = await authService.login(formData.username, formData.password)

      if (response.success) {
        const { user, token } = response.data

        const authData = {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            branch_id: user.branch_id,
            branch: user.branch,
          },
          role: user.role,
          permissions: user.permissions || [],
          isAuthenticated: true,
        }

        // Update Redux state
        dispatch(loginSuccess(authData))

        // Show success toast
        dispatch(addToast({
          id: Date.now(),
          type: 'success',
          title: 'Login Successful!',
          message: `Welcome back, ${user.name}!`,
        }))

        // Navigate to dashboard
        navigate('/')
      } else {
        throw new Error(response.message || 'Login failed')
      }
    } catch (error) {
      const errorMessage = error.message || 'Invalid username or password'
      
      dispatch(loginFailure(errorMessage))
      setErrors({ form: errorMessage })
      
      // Show error toast
      dispatch(addToast({
        id: Date.now(),
        type: 'error',
        title: 'Login Failed',
        message: errorMessage,
      }))
    } finally {
      setLoading(false)
    }
  }

  // Handle demo account quick login
  const handleDemoLogin = (account) => {
    setFormData({
      username: account.username,
      password: account.password,
    })
    setErrors({})
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 text-white p-12 flex-col justify-center relative overflow-hidden">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500">
              <span className="text-2xl font-bold text-zinc-900">PS</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">PawnSys</h1>
              <p className="text-amber-500 text-sm">Pajak Kedai Management</p>
            </div>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <h2 className="text-4xl font-bold leading-tight">
            Streamline Your
            <br />
            <span className="text-amber-500">Pawn Business</span>
          </h2>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-zinc-400 mb-8 max-w-md"
        >
          Complete pawn shop management system compliant with KPKT Malaysia regulations. Manage pledges, customers, inventory, and auctions effortlessly.
        </motion.p>

        {/* Features */}
        <motion.ul
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="space-y-3"
        >
          {features.map((feature, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 + i * 0.1 }}
              className="flex items-center gap-3 text-zinc-300"
            >
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Check className="w-3 h-3 text-amber-500" />
              </div>
              {feature}
            </motion.li>
          ))}
        </motion.ul>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-100">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500">
              <span className="text-xl font-bold text-zinc-900">PS</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-800">PawnSys</h1>
              <p className="text-amber-600 text-sm">Pajak Kedai Management</p>
            </div>
          </div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white rounded-2xl shadow-xl p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-zinc-800">Welcome Back</h2>
              <p className="text-zinc-500 mt-1">Sign in to your account</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Form Error */}
              {errors.form && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
                >
                  {errors.form}
                </motion.div>
              )}

              {/* Username Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Username <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={cn(
                      'block w-full pl-10 pr-3 py-2.5 border rounded-lg',
                      'bg-white text-zinc-900 placeholder-zinc-400',
                      'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500',
                      'transition-colors duration-200',
                      errors.username ? 'border-red-300' : 'border-zinc-300'
                    )}
                    placeholder="Enter your username"
                  />
                </div>
                {errors.username && (
                  <p className="mt-1 text-sm text-red-600">{errors.username}</p>
                )}
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-zinc-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={cn(
                      'block w-full pl-10 pr-10 py-2.5 border rounded-lg',
                      'bg-white text-zinc-900 placeholder-zinc-400',
                      'focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500',
                      'transition-colors duration-200',
                      errors.password ? 'border-red-300' : 'border-zinc-300'
                    )}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm text-zinc-600">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                variant="accent"
                size="lg"
                fullWidth
                loading={loading}
              >
                Sign In
              </Button>
            </form>

            {/* Demo Accounts */}
            <div className="mt-8 pt-6 border-t border-zinc-200">
              <p className="text-xs text-zinc-500 text-center mb-3">
                Demo Accounts (Click to autofill)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => handleDemoLogin(account)}
                    className={cn(
                      'px-3 py-2 rounded-lg border text-sm font-medium transition-all',
                      'border-zinc-200 hover:border-amber-300 hover:bg-amber-50',
                      formData.username === account.username && 'border-amber-400 bg-amber-50'
                    )}
                  >
                    <span className="text-zinc-700">{account.role}</span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs text-zinc-500 mt-6"
          >
            © 2025 PawnSys. KPKT Malaysia Compliant System.
          </motion.p>
        </div>
      </div>
    </div>
  )
}