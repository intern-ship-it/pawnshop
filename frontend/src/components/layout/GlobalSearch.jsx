/**
 * GlobalSearch Component
 * Dropdown search for Header - searches Pledges, Customers, Inventory
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Search,
  X,
  FileText,
  User,
  Package,
  Loader2,
  ArrowRight,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pledgeService, customerService, inventoryService } from "@/services";

export default function GlobalSearch({ className }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState({
    pledges: [],
    customers: [],
    inventory: [],
  });
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("pawnsys_recent_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved).slice(0, 5));
      } catch (e) { }
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults({ pledges: [], customers: [], inventory: [] });
      return;
    }

    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Perform search across all entities
  const performSearch = async (searchQuery) => {
    setIsLoading(true);
    try {
      const [pledgesRes, customersRes, inventoryRes] = await Promise.allSettled(
        [
          pledgeService.getAll({ search: searchQuery, per_page: 5 }),
          customerService.getAll({ search: searchQuery, per_page: 5 }),
          inventoryService.getAll({ search: searchQuery, per_page: 5 }),
        ],
      );

      setResults({
        pledges:
          pledgesRes.status === "fulfilled"
            ? (
              pledgesRes.value.data?.data ||
              pledgesRes.value.data ||
              []
            ).slice(0, 3)
            : [],
        customers:
          customersRes.status === "fulfilled"
            ? (
              customersRes.value.data?.data ||
              customersRes.value.data ||
              []
            ).slice(0, 3)
            : [],
        inventory:
          inventoryRes.status === "fulfilled"
            ? (
              inventoryRes.value.data?.data ||
              inventoryRes.value.data ||
              []
            ).slice(0, 3)
            : [],
      });
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save to recent searches
  const saveRecentSearch = (searchQuery) => {
    const updated = [
      searchQuery,
      ...recentSearches.filter((s) => s !== searchQuery),
    ].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("pawnsys_recent_searches", JSON.stringify(updated));
  };

  // Handle result click
  const handleResultClick = (type, item) => {
    saveRecentSearch(query);
    setQuery("");
    setIsOpen(false);

    switch (type) {
      case "pledge":
        navigate(`/pledges/${item.id}`);
        break;
      case "customer":
        navigate(`/customers/${item.id}`);
        break;
      case "inventory":
        navigate(`/inventory?search=${item.barcode || item.id}`);
        break;
    }
  };

  // Handle recent search click
  const handleRecentClick = (searchQuery) => {
    setQuery(searchQuery);
    performSearch(searchQuery);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    const allItems = [
      ...results.pledges.map((p) => ({ type: "pledge", item: p })),
      ...results.customers.map((c) => ({ type: "customer", item: c })),
      ...results.inventory.map((i) => ({ type: "inventory", item: i })),
    ];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      const selected = allItems[selectedIndex];
      if (selected) {
        handleResultClick(selected.type, selected.item);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Check if there are any results
  const hasResults =
    results.pledges.length > 0 ||
    results.customers.length > 0 ||
    results.inventory.length > 0;
  const showDropdown =
    isOpen && (query.length >= 2 || recentSearches.length > 0);

  // Calculate flat index for keyboard navigation
  let currentIndex = -1;

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search ticket, customer..."
          className="w-full h-10 pl-10 pr-8 bg-zinc-100 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all placeholder:text-zinc-400"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-zinc-200 overflow-hidden z-50 max-h-96 overflow-y-auto min-w-[420px]">
          {/* Recent Searches (when no query) */}
          {query.length < 2 && recentSearches.length > 0 && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-zinc-400 uppercase">
                Recent Searches
              </p>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRecentClick(search)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-sm text-zinc-600 hover:bg-zinc-50 rounded-lg"
                >
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {query.length >= 2 && (
            <>
              {isLoading ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Searching...
                </div>
              ) : !hasResults ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  No results found for "{query}"
                </div>
              ) : (
                <>
                  {/* Pledges */}
                  {results.pledges.length > 0 && (
                    <div className="p-2 border-b border-zinc-100">
                      <p className="px-2 py-1 text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        Pledges
                      </p>
                      {results.pledges.map((pledge) => {
                        currentIndex++;
                        const isSelected = currentIndex === selectedIndex;
                        return (
                          <button
                            key={pledge.id}
                            onClick={() => handleResultClick("pledge", pledge)}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left",
                              isSelected ? "bg-amber-50" : "hover:bg-zinc-50",
                            )}
                          >
                            <div>
                              <p className="text-sm font-medium text-zinc-800">
                                {pledge.pledge_no || pledge.receipt_no}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {pledge.customer?.name || "Unknown"} • RM{" "}
                                {Number(pledge.loan_amount || 0).toFixed(2)}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "px-2 py-0.5 text-xs rounded-full",
                                pledge.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : pledge.status === "overdue"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-zinc-100 text-zinc-600",
                              )}
                            >
                              {pledge.status}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Customers */}
                  {results.customers.length > 0 && (
                    <div className="p-2 border-b border-zinc-100">
                      <p className="px-2 py-1 text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Customers
                      </p>
                      {results.customers.map((customer) => {
                        currentIndex++;
                        const isSelected = currentIndex === selectedIndex;
                        return (
                          <button
                            key={customer.id}
                            onClick={() =>
                              handleResultClick("customer", customer)
                            }
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left",
                              isSelected ? "bg-amber-50" : "hover:bg-zinc-50",
                            )}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-medium text-sm flex-shrink-0">
                                {customer.name?.charAt(0) || "?"}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-zinc-800">
                                  {customer.name}
                                </p>
                                <p className="text-xs text-zinc-500">
                                  {customer.ic_number}
                                  {customer.phone ? ` • ${customer.country_code || ''}${customer.phone}` : ""}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Inventory */}
                  {results.inventory.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs font-medium text-zinc-400 uppercase flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Inventory
                      </p>
                      {results.inventory.map((item) => {
                        currentIndex++;
                        const isSelected = currentIndex === selectedIndex;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleResultClick("inventory", item)}
                            className={cn(
                              "w-full flex items-center justify-between px-2 py-2 rounded-lg text-left",
                              isSelected ? "bg-amber-50" : "hover:bg-zinc-50",
                            )}
                          >
                            <div>
                              <p className="text-sm font-medium text-zinc-800">
                                {item.category?.name || "Item"} -{" "}
                                {item.purity?.code || ""}
                              </p>
                              <p className="text-xs text-zinc-500">
                                {item.barcode} • {item.net_weight}g
                              </p>
                            </div>
                            <span className="text-xs text-zinc-500">
                              {item.pledge?.pledge_no}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
