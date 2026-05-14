import { useState, useEffect, useCallback, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { interestPaymentService, settingsService, pledgeService } from "@/services";
import { formatCurrency, formatDate, formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, Badge, Modal } from "@/components/common";
import {
  Search, DollarSign, Calendar, Clock, TrendingUp, CheckCircle,
  AlertTriangle, Loader2, Banknote, Building2, CreditCard, Package,
  User, Info, X, Printer, ArrowRight,
} from "lucide-react";

export default function InterestPaymentScreen() {
  const dispatch = useAppDispatch();
  const debounceRef = useRef(null);

  // Search & pledge state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pledgeList, setPledgeList] = useState([]);
  const [pledge, setPledge] = useState(null);

  // Calculation
  const [calculation, setCalculation] = useState(null);
  const [period, setPeriod] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Interest rate
  const [interestRate, setInterestRate] = useState("");
  const [globalRate, setGlobalRate] = useState(null);
  const [rateSource, setRateSource] = useState("");
  const [monthsToPay, setMonthsToPay] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [bankId, setBankId] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [banks, setBanks] = useState([]);
  const [notes, setNotes] = useState("");

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [result, setResult] = useState(null);

  // Today's payments
  const [todayPayments, setTodayPayments] = useState([]);
  const [todaySummary, setTodaySummary] = useState(null);
  const [activeTab, setActiveTab] = useState("process"); // process | history

  // Load banks & rates on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [bankRes, rateRes] = await Promise.all([
          settingsService.getBanks(),
          settingsService.getInterestRates(),
        ]);
        setBanks(bankRes.data?.data || bankRes.data || []);
        const rates = rateRes.data?.data || rateRes.data || [];
        if (Array.isArray(rates) && rates.length > 0) {
          const std = rates.find(r => r.rate_type === 'standard' && r.is_active)
            || rates.find(r => r.rate_type === 'normal' && r.is_active)
            || rates.find(r => r.is_active);
          if (std) setGlobalRate(parseFloat(std.rate_percentage));
        }
      } catch (e) { console.error("Init error:", e); }
    };
    init();
  }, []);

  // Load today's payments
  const loadToday = async () => {
    try {
      const res = await interestPaymentService.getToday();
      const data = res.data?.data || res.data;
      setTodayPayments(data.payments || []);
      setTodaySummary(data.summary || null);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadToday(); }, []);

  // Auto-fill amount when calculation changes
  useEffect(() => {
    if (calculation?.total_payable !== undefined) {
      const total = String(calculation.total_payable);
      if (paymentMethod === "cash") setCashAmount(total);
      else if (paymentMethod === "transfer") setTransferAmount(total);
    }
  }, [calculation?.total_payable, paymentMethod]);

  // Search pledges
  const handleSearch = async (query) => {
    if (!query?.trim()) return;
    setIsSearching(true);
    setPledge(null);
    setCalculation(null);
    setPeriod(null);
    setPledgeList([]);
    try {
      const res = await interestPaymentService.getEligibleList({ search: query.trim() });
      const pledges = res.data?.data || res.data || [];
      if (pledges.length === 1) {
        selectPledge(pledges[0]);
      } else if (pledges.length > 0) {
        setPledgeList(pledges);
      } else {
        dispatch(addToast({ type: "error", title: "Not Found", message: "No eligible pledges found" }));
      }
    } catch (e) {
      dispatch(addToast({ type: "error", title: "Error", message: "Search failed" }));
    } finally { setIsSearching(false); }
  };

  const debouncedSearch = useCallback((q) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) return;
    debounceRef.current = setTimeout(() => handleSearch(q), 500);
  }, []);

  // Select a pledge and calculate
  const selectPledge = async (p) => {
    setPledge(p);
    setPledgeList([]);
    // Determine rate
    let rate = "";
    let source = "global";
    if (p.customer?.custom_interest_rate) {
      rate = String(p.customer.custom_interest_rate);
      source = globalRate !== null && Math.abs(parseFloat(p.customer.custom_interest_rate) - globalRate) > 0.001 ? "customer" : "global";
    } else if (p.interest_rate) {
      rate = String(p.interest_rate);
      source = "global";
    }
    setInterestRate(rate);
    setRateSource(source);
    setMonthsToPay(""); // Reset months
    await fetchCalculation(p.id, rate, null);
  };

  const fetchCalculation = async (pledgeId, rate, overrideMonths = null) => {
    setIsCalculating(true);
    try {
      const params = { pledge_id: pledgeId };
      if (rate !== "" && !isNaN(parseFloat(rate))) params.interest_rate = parseFloat(rate);
      if (overrideMonths !== null && overrideMonths !== "") params.months_to_pay = parseInt(overrideMonths);

      const res = await interestPaymentService.calculate(params);
      const data = res.data?.data || res.data;
      setCalculation(data.calculation);
      setPeriod(data.period);
      
      // Auto-set the months input on initial load
      if (overrideMonths === null && data.period?.months_remaining) {
        setMonthsToPay(String(data.period.months_remaining));
      }
    } catch (e) {
      dispatch(addToast({ type: "error", title: "Error", message: "Calculation failed" }));
    } finally { setIsCalculating(false); }
  };

  // Process payment
  const handleProcess = async () => {
    if (!pledge || !calculation) return;
    const totalPayable = calculation.total_payable || 0;
    let totalReceived = 0;
    if (paymentMethod === "partial") {
      totalReceived = (parseFloat(cashAmount) || 0) + (parseFloat(transferAmount) || 0);
    } else if (paymentMethod === "cash") {
      totalReceived = parseFloat(cashAmount) || 0;
    } else {
      totalReceived = parseFloat(transferAmount) || 0;
    }
    if (totalReceived < totalPayable) {
      dispatch(addToast({ type: "error", title: "Insufficient", message: `Amount must be at least ${formatCurrency(totalPayable)}` }));
      return;
    }
    setIsProcessing(true);
    try {
      const payload = {
        pledge_id: pledge.id,
        payment_method: paymentMethod,
        cash_amount: paymentMethod === "cash" ? totalReceived : paymentMethod === "partial" ? parseFloat(cashAmount) || 0 : 0,
        transfer_amount: paymentMethod === "transfer" ? totalReceived : paymentMethod === "partial" ? parseFloat(transferAmount) || 0 : 0,
        notes: notes || undefined,
      };
      if (interestRate !== "" && !isNaN(parseFloat(interestRate))) payload.interest_rate = parseFloat(interestRate);
      if (monthsToPay !== "" && !isNaN(parseInt(monthsToPay))) payload.months_to_pay = parseInt(monthsToPay);
      if ((paymentMethod === "transfer" || paymentMethod === "partial") && bankId) payload.bank_id = parseInt(bankId);
      if (referenceNo) payload.reference_no = referenceNo;
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

      const res = await interestPaymentService.create(payload);
      const data = res.data?.data || res.data;
      setResult(data);
      setShowSuccess(true);
      loadToday();
      dispatch(addToast({ type: "success", title: "Success", message: "Interest payment processed!" }));
    } catch (e) {
      dispatch(addToast({ type: "error", title: "Error", message: e.response?.data?.message || "Failed to process" }));
    } finally { setIsProcessing(false); }
  };

  const resetForm = () => {
    setPledge(null); setCalculation(null); setPeriod(null); setSearchQuery("");
    setInterestRate(""); setRateSource(""); setMonthsToPay(""); setPaymentMethod("cash");
    setCashAmount(""); setTransferAmount(""); setBankId(""); setReferenceNo("");
    setNotes(""); setShowSuccess(false); setResult(null); setPledgeList([]);
  };

  return (
    <PageWrapper title="Interest Payment" subtitle="Record interest-only payments without extending pledge term">
      <div className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button variant={activeTab === "process" ? "accent" : "ghost"} onClick={() => setActiveTab("process")}>
            <Banknote className="w-4 h-4 mr-2" /> Process Payment
          </Button>
          <Button variant={activeTab === "history" ? "accent" : "ghost"} onClick={() => setActiveTab("history")}>
            <Clock className="w-4 h-4 mr-2" /> Today's Payments {todaySummary?.count > 0 && <Badge variant="info" size="sm" className="ml-2">{todaySummary.count}</Badge>}
          </Button>
        </div>

        {activeTab === "history" && (
          <Card className="p-6">
            {todaySummary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-zinc-50 rounded-lg text-center">
                  <p className="text-xs text-zinc-600">Count</p>
                  <p className="text-lg font-bold text-zinc-800">{todaySummary.count}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-center">
                  <p className="text-xs text-emerald-600">Total</p>
                  <p className="text-lg font-bold text-emerald-800">{formatCurrency(todaySummary.total)}</p>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <p className="text-xs text-amber-600">Cash</p>
                  <p className="text-lg font-bold text-amber-800">{formatCurrency(todaySummary.cash)}</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg text-center">
                  <p className="text-xs text-purple-600">Transfer</p>
                  <p className="text-lg font-bold text-purple-800">{formatCurrency(todaySummary.transfer)}</p>
                </div>
              </div>
            )}
            {todayPayments.length === 0 ? (
              <p className="text-center text-zinc-400 py-8">No interest payments today</p>
            ) : (
              <div className="space-y-3">
                {todayPayments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-zinc-800">{p.payment_no}</p>
                      <p className="text-sm text-zinc-500">{p.pledge?.customer?.name} • {p.pledge?.pledge_no || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600">{formatCurrency(p.total_payable)}</p>
                      <Badge variant="success" size="sm">{p.payment_method}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === "process" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Search */}
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    placeholder="Enter Pledge No, Receipt No, Customer Name, or IC..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); debouncedSearch(e.target.value); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch(searchQuery)}
                    leftIcon={Search}
                  />
                </div>
                <Button variant="accent" onClick={() => handleSearch(searchQuery)} loading={isSearching}>Search</Button>
              </div>
            </Card>

            {/* Pledge List */}
            {!pledge && pledgeList.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-800">Found {pledgeList.length} Pledges</h3>
                {pledgeList.map(p => (
                  <Card key={p.id} className="p-4 cursor-pointer hover:border-emerald-500 hover:shadow-md transition-all" onClick={() => selectPledge(p)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-semibold text-zinc-800">{p.customer?.name}</h4>
                        <p className="text-sm text-zinc-500">{p.pledge_no} • {p.customer?.ic_number}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(p.loan_amount)}</p>
                        <Badge variant={p.status === "overdue" ? "error" : "success"} size="sm">{p.status}</Badge>
                      </div>
                    </div>
                    {p.last_interest_payment && (
                      <div className="mt-2 text-xs text-zinc-400">Last payment: {p.last_interest_payment.date} ({formatCurrency(p.last_interest_payment.amount)})</div>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {/* Pledge Details + Calculation + Payment */}
            <AnimatePresence>
              {pledge && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  {/* Pledge Info */}
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                          {(pledge.customer?.name || "?").charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-zinc-800">{pledge.customer?.name}</h3>
                            <Badge variant={pledge.status === "overdue" ? "error" : "success"}>
                              {pledge.status === "overdue" ? <><AlertTriangle className="w-3 h-3 mr-1" />Overdue</> : <><CheckCircle className="w-3 h-3 mr-1" />Active</>}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-500">{formatIC(pledge.customer?.ic_number)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-500">Pledge No</p>
                        <p className="font-mono font-bold text-zinc-800">{pledge.pledge_no}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-zinc-400" /><span className="text-xs text-zinc-500">Principal</span></div>
                        <p className="font-bold text-zinc-800">{formatCurrency(pledge.loan_amount)}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1"><Calendar className="w-4 h-4 text-zinc-400" /><span className="text-xs text-zinc-500">Pledge Date</span></div>
                        <p className="font-bold text-zinc-800">{formatDate(pledge.pledge_date)}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-zinc-400" /><span className="text-xs text-zinc-500">Due Date</span></div>
                        <p className="font-bold text-zinc-800">{formatDate(pledge.due_date)}</p>
                      </div>
                      <div className="p-3 bg-zinc-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-zinc-400" /><span className="text-xs text-zinc-500">Months Elapsed</span></div>
                        <p className="font-bold text-zinc-800">{period?.months_elapsed || 0}</p>
                      </div>
                    </div>
                    {period?.months_paid > 0 && (
                      <div className="mt-3 p-3 bg-zinc-100 rounded-lg flex items-center gap-2 text-zinc-700">
                        <Info className="w-4 h-4" />
                        <span className="text-sm">{period.months_paid} month(s) already paid. Paying for remaining {period.months_remaining} month(s).</span>
                      </div>
                    )}
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg flex items-center gap-2 text-amber-700">
                      <Info className="w-4 h-4" />
                      <span className="text-sm font-medium">Interest payment only — due date will NOT change</span>
                    </div>
                  </Card>

                  {/* Interest Calculation */}
                  <Card className="p-6">
                    <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-amber-500" /> Interest Calculation
                    </h4>

                    {/* Custom Interest Rate - matching Redemption pattern */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-zinc-600">
                          Interest Rate (%) <span className="text-xs text-zinc-400 font-normal">(Leave empty for default)</span>
                        </label>
                        {rateSource && (
                          <Badge variant={rateSource === 'customer' ? 'warning' : rateSource === 'manual' ? 'info' : 'success'} size="sm">
                            {rateSource === 'customer' && '👤 Customer Rate'}
                            {rateSource === 'global' && '🌐 Global Rate'}
                            {rateSource === 'manual' && '✏️ Manual Override'}
                          </Badge>
                        )}
                      </div>
                      <Input
                        type="number" step="0.01" placeholder="e.g. 0.5"
                        value={interestRate}
                        onChange={(e) => {
                          setInterestRate(e.target.value);
                          setRateSource("manual");
                          if (pledge?.id) {
                            clearTimeout(window._intPayRateTimer);
                            window._intPayRateTimer = setTimeout(() => fetchCalculation(pledge.id, e.target.value, monthsToPay), 400);
                          }
                        }}
                        leftIcon={TrendingUp}
                      />
                    </div>

                    {/* Months to Pay */}
                    <div className="mb-4">
                      <label className="text-sm text-zinc-600 mb-2 block">
                        Months to Pay
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: Math.max(6, period?.months_remaining || 1) }, (_, i) => i + 1).map((months) => (
                          <button
                            key={months}
                            onClick={() => {
                              setMonthsToPay(String(months));
                              if (pledge?.id) {
                                clearTimeout(window._intPayMonthTimer);
                                fetchCalculation(pledge.id, interestRate, String(months));
                              }
                            }}
                            className={cn(
                              "px-4 py-2 rounded-lg border font-medium transition-all min-w-[3rem]",
                              monthsToPay === String(months)
                                ? "bg-amber-500 text-white border-amber-500"
                                : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-300",
                            )}
                          >
                            {months}M
                          </button>
                        ))}
                      </div>
                    </div>

                    {isCalculating ? (
                      <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
                    ) : calculation && (
                      <>
                        {/* Breakdown */}
                        {calculation.interest_breakdown?.length > 0 && (
                          <div className="mb-4 p-4 bg-zinc-50 rounded-lg border border-zinc-100">
                            <h5 className="text-sm font-semibold text-zinc-700 mb-3">Monthly Breakdown</h5>
                            <div className="space-y-1.5">
                              {calculation.interest_breakdown.map((entry, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                  <span className="text-zinc-500">Month {entry.month} ({entry.rate}%)</span>
                                  <span className="font-medium text-zinc-700">{formatCurrency(entry.interest)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Totals */}
                        <div className="space-y-2 border-t border-zinc-200 pt-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Interest Amount</span>
                            <span className="font-medium">{formatCurrency(calculation.interest_amount)}</span>
                          </div>
                          {calculation.handling_fee > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-500">Handling Fee</span>
                              <span className="font-medium">{formatCurrency(calculation.handling_fee)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-lg font-bold border-t border-zinc-300 pt-2 mt-2">
                            <span className="text-zinc-800">Total Payable</span>
                            <span className="text-amber-600">{formatCurrency(calculation.total_payable)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </Card>

                  {/* Payment */}
                  <Card className="p-6">
                    <h4 className="font-semibold text-zinc-800 mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-500" /> Payment
                    </h4>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {["cash", "transfer", "partial"].map(m => (
                        <button key={m} onClick={() => setPaymentMethod(m)}
                          className={cn("p-3 rounded-lg border-2 text-sm font-medium transition-all capitalize",
                            paymentMethod === m ? "border-amber-500 bg-amber-50 text-amber-700" : "border-zinc-200 text-zinc-500 hover:border-zinc-300"
                          )}
                        >{m}</button>
                      ))}
                    </div>

                    {(paymentMethod === "cash" || paymentMethod === "partial") && (
                      <div className="mb-3">
                        <label className="text-sm text-zinc-600 mb-1 block">Cash Amount (RM)</label>
                        <Input type="number" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} leftIcon={DollarSign} />
                      </div>
                    )}

                    {(paymentMethod === "transfer" || paymentMethod === "partial") && (
                      <>
                        <div className="mb-3">
                          <label className="text-sm text-zinc-600 mb-1 block">Transfer Amount (RM)</label>
                          <Input type="number" step="0.01" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} leftIcon={DollarSign} />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-sm text-zinc-600 mb-1 block">Bank</label>
                            <Select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                              <option value="">Select bank...</option>
                              {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </Select>
                          </div>
                          <div>
                            <label className="text-sm text-zinc-600 mb-1 block">Reference No</label>
                            <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Transfer ref..." />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="mb-4">
                      <label className="text-sm text-zinc-600 mb-1 block">Notes (optional)</label>
                      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
                    </div>

                    <Button variant="success" className="w-full" size="lg" onClick={handleProcess} loading={isProcessing}
                      disabled={!calculation || isProcessing}>
                      <Banknote className="w-5 h-5 mr-2" /> Process Interest Payment — {formatCurrency(calculation?.total_payable || 0)}
                    </Button>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Success Modal */}
        <Modal isOpen={showSuccess} onClose={() => { setShowSuccess(false); resetForm(); }} title="Interest Payment Successful" size="md">
          <div className="text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-zinc-800 mb-2">Payment Recorded!</h3>
            {result && (
              <div className="text-left mt-4 p-4 bg-zinc-50 rounded-lg space-y-2">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Payment No</span><span className="font-mono font-bold">{result.payment_no}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Amount</span><span className="font-bold text-emerald-600">{formatCurrency(result.total_payable)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Period</span><span>{formatDate(result.period_from)} → {formatDate(result.period_to)}</span></div>
              </div>
            )}
            <p className="text-sm text-amber-600 mt-3 font-medium">Due date remains unchanged.</p>
            <div className="mt-6 flex gap-3 justify-center">
              <Button variant="ghost" onClick={() => { setShowSuccess(false); resetForm(); }}>New Payment</Button>
            </div>
          </div>
        </Modal>
      </div>
    </PageWrapper>
  );
}
