# 🏆 PawnSys - Pawn Shop Management System

A modern, full-featured pawn shop management system built for **KPKT Malaysia** compliance.

![React](https://img.shields.io/badge/React-19.2.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8)
![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-2.5-purple)
![Vite](https://img.shields.io/badge/Vite-7.3.0-646CFF)

## ✨ Features

### 🎨 UI/UX
- **Charcoal & Amber Theme** - Professional executive look
- **Responsive Design** - Works on desktop and mobile
- **Collapsible Sidebar** - More screen space when needed
- **Real-time Gold Price Widget** - Live market rates display

### 📦 Core Modules

| Module | Features |
|--------|----------|
| **Dashboard** | Stats, alerts, gold price, quick actions |
| **Customers** | CRUD, IC lookup, history, risk assessment |
| **New Pledge** | 5-step wizard (Customer→Items→Valuation→Payout→Signature) |
| **Renewals** | Interest calculation, payment processing |
| **Redemptions** | Full & partial redemption, signature capture |
| **Inventory** | Stock management, barcode scanning |
| **Reconciliation** | Day-end stock verification |
| **Auctions** | KPKT-compliant auction management |
| **Reports** | PDF/Excel export, date filters |

### 👥 Role-Based Access
- **Administrator** - Full system access
- **Manager** - Branch operations
- **Cashier** - Transactions only
- **Auditor** - View & reports only

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm 9+

### Installation

```bash
# Navigate to project
cd pawnsys

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Demo Accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Manager | `manager` | `manager123` |
| Cashier | `cashier` | `cashier123` |
| Auditor | `auditor` | `auditor123` |

## 📁 Project Structure

```
pawnsys/
├── src/
│   ├── app/                    # Redux store configuration
│   ├── features/               # Redux slices by domain
│   ├── components/
│   │   ├── common/             # Reusable UI components
│   │   ├── layout/             # Layout components
│   │   └── forms/              # Form components
│   ├── pages/                  # Page components
│   ├── data/                   # Mock data
│   ├── utils/                  # Utility functions
│   ├── lib/utils.js            # Tailwind merge utility
│   ├── routes.jsx              # React Router config
│   └── index.css               # Tailwind + theme
├── vite.config.js
└── package.json
```

## 🎨 Theme Colors

### Charcoal (Primary): `#27272a`
### Amber (Accent): `#f59e0b`

## 📝 Mock Data & localStorage

Data persists in localStorage. Clear to reset.

---

Built with ❤️ for Malaysian Pawn Shops
