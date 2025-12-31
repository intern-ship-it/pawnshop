import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  MoreHorizontal,
} from 'lucide-react'
import Input from './Input'
import Button from './Button'

export default function DataTable({
  columns,
  data = [],
  searchable = false,
  searchPlaceholder = 'Search...',
  pagination = true,
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  className,
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  // Handle sorting
  const handleSort = (key) => {
    if (!columns.find(col => col.key === key)?.sortable) return

    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col.key]
          if (value == null) return false
          return String(value).toLowerCase().includes(query)
        })
      )
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]
        const bVal = b[sortConfig.key]
        
        if (aVal == null) return 1
        if (bVal == null) return -1
        
        const comparison = String(aVal).localeCompare(String(bVal), undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        
        return sortConfig.direction === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [data, searchQuery, sortConfig, columns])

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize)
  const paginatedData = pagination
    ? processedData.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : processedData

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ChevronsUpDown className="w-4 h-4 text-zinc-400" />
    }
    return sortConfig.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-amber-500" />
    ) : (
      <ChevronDown className="w-4 h-4 text-amber-500" />
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search */}
      {searchable && (
        <div className="max-w-sm">
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            leftIcon={Search}
            size="sm"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-zinc-600 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer hover:bg-zinc-100 select-none',
                    col.className
                  )}
                  style={{ width: col.width }}
                  onClick={() => handleSort(col.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.label}</span>
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2 text-zinc-500">
                    <div className="w-5 h-5 border-2 border-zinc-300 border-t-amber-500 rounded-full animate-spin" />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <tr
                  key={row.id || rowIndex}
                  className={cn(
                    'hover:bg-zinc-50/50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-4 py-3 text-sm text-zinc-700',
                        col.cellClassName
                      )}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {((currentPage - 1) * pageSize) + 1} to{' '}
            {Math.min(currentPage * pageSize, processedData.length)} of{' '}
            {processedData.length} results
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page
                if (totalPages <= 5) {
                  page = i + 1
                } else if (currentPage <= 3) {
                  page = i + 1
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i
                } else {
                  page = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                      currentPage === page
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-600 hover:bg-zinc-100'
                    )}
                  >
                    {page}
                  </button>
                )
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
