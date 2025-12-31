/**
 * Redux Hooks
 * Typed versions of useDispatch and useSelector for use throughout the app
 */

import { useDispatch, useSelector } from 'react-redux'

// Export typed hooks
export const useAppDispatch = () => useDispatch()
export const useAppSelector = useSelector
