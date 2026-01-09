import { useState, useCallback } from 'react'
import { useAppSelector } from '@/app/hooks'
import { selectPasskeyVerified } from '@/features/auth/authSlice'

/**
 * Custom hook for passkey-protected actions
 * 
 * Usage:
 * const { showPasskeyModal, setShowPasskeyModal, requirePasskey, handlePasskeySuccess } = usePasskey()
 * 
 * // Wrap sensitive action
 * const handleCustomLoan = (value) => {
 *   requirePasskey(() => {
 *     setLoanPercent(value)
 *   })
 * }
 * 
 * // In JSX:
 * <PasskeyModal
 *   isOpen={showPasskeyModal}
 *   onClose={() => setShowPasskeyModal(false)}
 *   onSuccess={handlePasskeySuccess}
 * />
 */
export function usePasskey() {
  const [showPasskeyModal, setShowPasskeyModal] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [modalConfig, setModalConfig] = useState({
    title: 'Enter Passkey',
    message: 'This action requires passkey verification'
  })
  
  const isPasskeyVerified = useAppSelector(selectPasskeyVerified)

  /**
   * Require passkey verification before executing an action
   * @param {Function} action - The action to execute after verification
   * @param {Object} config - Optional config for modal title/message
   */
  const requirePasskey = useCallback((action, config = {}) => {
    // Check if already verified (within 5 min window)
    if (isPasskeyVerified) {
      action()
      return
    }

    // Set modal config
    setModalConfig({
      title: config.title || 'Enter Passkey',
      message: config.message || 'This action requires passkey verification'
    })

    // Store action and show modal
    setPendingAction(() => action)
    setShowPasskeyModal(true)
  }, [isPasskeyVerified])

  /**
   * Called when passkey is successfully verified
   */
  const handlePasskeySuccess = useCallback(() => {
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
    }
  }, [pendingAction])

  /**
   * Close modal and clear pending action
   */
  const closePasskeyModal = useCallback(() => {
    setShowPasskeyModal(false)
    setPendingAction(null)
  }, [])

  return {
    showPasskeyModal,
    setShowPasskeyModal,
    closePasskeyModal,
    requirePasskey,
    handlePasskeySuccess,
    isPasskeyVerified,
    modalConfig,
  }
}

export default usePasskey;