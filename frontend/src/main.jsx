import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from '@/app/store'
import App from './App'
import '@/index.css'

// Initialize mock data in localStorage
import { initializeStorage, STORAGE_KEYS } from '@/utils/localStorage'
import mockCustomers from '@/data/mockCustomers'
import mockPledges from '@/data/mockPledges'
import mockInventory from '@/data/mockInventory'
import mockGoldPrices from '@/data/mockGoldPrices'

// Initialize storage on first load
initializeStorage({
  [STORAGE_KEYS.CUSTOMERS]: mockCustomers,
  [STORAGE_KEYS.PLEDGES]: mockPledges,
  [STORAGE_KEYS.INVENTORY]: mockInventory,
  [STORAGE_KEYS.GOLD_PRICE]: mockGoldPrices,
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
)
