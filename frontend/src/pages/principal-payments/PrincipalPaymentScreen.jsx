/**
 * Principal Payment — money paid against the loan itself.
 *
 * The counter had no way to take one. A customer who wanted to owe less could only
 * redeem goods, so reducing the debt always meant emptying part of the locker.
 *
 * Client-confirmed 2026-10-01: any amount, no minimum, as often as they like, with no
 * requirement to settle interest first, and the due date does not move. The screen says
 * all of that out loud, because "pay RM 10,000 and keep everything" is easy to mistake
 * for "pay RM 10,000 and get more time".
 */

import { useState } from "react";
import { useAppDispatch } from "@/app/hooks";
import { addToast } from "@/features/ui/uiSlice";
import { pledgeService, principalPaymentService } from "@/services";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Badge } from "@/components/common";
import {
  Search,
  Loader2,
  Wallet,
  Building2,
  CreditCard,
  CheckCircle,
  Info,
  TrendingDown,
} from "lucide-react";

export default function PrincipalPaymentScreen() {
  const dispatch = useAppDispatch();

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [pledge, setPledge] = useState(null);
  const [preview, setPreview] = useState(null);
  const [history, setHistory] = useState([]);

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashAmount, setCashAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState(null);

  const outstanding = preview?.principal?.outstanding ?? 0;
  const amountValue = parseFloat(amount) || 0;
  const remainingAfter = Math.max(0, outstanding - amountValue);
  const overpaying = amountValue > outstanding + 0.005;

  const resetForm = () => {
    setAmount("");
    setPaymentMethod("cash");
    setCashAmount("");
    setTransferAmount("");
    setReferenceNo("");
    setNotes("");
  };

  const loadPledge = async (pledgeId) => {
    const response = await principalPaymentService.calculate({
      pledge_id: pledgeId,
    });
    const data = response.data?.data || response.data;

    setPreview(data);
    setHistory(data.history || []);
    return data;
  };

  const handleSearch = async () => {
    const term = searchQuery.trim();
    if (!term) return;

    setIsSearching(true);
    setPledge(null);
    setPreview(null);
    setResult(null);
    resetForm();

    try {
      const response = await pledgeService.getByReceipt(term);
      const found = response.data?.data || response.data;

      if (!found?.id) {
        throw new Error("Pledge not found");
      }

      setPledge(found);
      await loadPledge(found.id);
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Not Found",
          message:
            error.message ||
            "No active pledge for that ticket, receipt or IC number.",
        }),
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!pledge || amountValue <= 0) return;

    // Refused rather than trimmed: an operator typing the wrong figure should see it,
    // not have it quietly rounded down to whatever was owed.
    if (overpaying) {
      dispatch(
        addToast({
          type: "error",
          title: "Too Much",
          message: `Only ${formatCurrency(outstanding)} of principal is outstanding. Interest is collected on the Interest Payments screen.`,
        }),
      );
      return;
    }

    const split = paymentMethod === "partial";
    const cash = split ? parseFloat(cashAmount) || 0 : 0;
    const transfer = split ? parseFloat(transferAmount) || 0 : 0;

    if (split && Math.abs(cash + transfer - amountValue) > 0.005) {
      dispatch(
        addToast({
          type: "error",
          title: "Split Does Not Add Up",
          message: `Cash and transfer must total ${formatCurrency(amountValue)}.`,
        }),
      );
      return;
    }

    setIsSaving(true);

    try {
      const response = await principalPaymentService.create({
        pledge_id: pledge.id,
        amount: amountValue,
        payment_method: paymentMethod,
        cash_amount: split ? cash : undefined,
        transfer_amount: split ? transfer : undefined,
        reference_no: referenceNo || undefined,
        notes: notes || undefined,
      });

      const data = response.data?.data || response.data;
      setResult(data);
      resetForm();
      await loadPledge(pledge.id);

      dispatch(
        addToast({
          type: "success",
          title: "Payment Recorded",
          message: `${formatCurrency(amountValue)} paid toward the loan.`,
        }),
      );
    } catch (error) {
      dispatch(
        addToast({
          type: "error",
          title: "Failed",
          message:
            error.response?.data?.message ||
            error.message ||
            "Could not record the payment.",
        }),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageWrapper
      title="Principal Payment"
      subtitle="Reduce the loan without releasing any items"
    >
      <div className="space-y-5 max-w-4xl">
        {/* Search */}
        <Card className="p-5">
          <div className="flex gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Enter Pledge No, Receipt No, Customer Name, IC, or scan barcode..."
              leftIcon={Search}
              className="flex-1"
            />
            <Button variant="accent" onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>
        </Card>

        {!pledge && !isSearching && (
          <Card className="p-12 text-center">
            <TrendingDown className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-zinc-800 mb-1">
              Pay Down a Loan
            </h3>
            <p className="text-zinc-500 max-w-md mx-auto">
              Search for a pledge to take a payment against its principal. The
              items stay in the locker and the due date does not change.
            </p>
          </Card>
        )}

        {preview && (
          <>
            {/* Pledge summary */}
            <Card className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-zinc-800">
                    {preview.pledge.customer?.name}
                  </h3>
                  <p className="text-sm font-medium text-zinc-600">
                    {preview.pledge.customer?.ic_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-zinc-600">Pledge No</p>
                  <p className="font-mono text-sm font-semibold">
                    {preview.pledge.pledge_no}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat
                  label="Principal Outstanding"
                  value={formatCurrency(outstanding)}
                  strong
                />
                <Stat
                  label="Due Date"
                  value={formatDate(preview.pledge.due_date)}
                />
                <Stat
                  label="Items Held"
                  value={`${preview.pledge.items_held} item(s)`}
                />
                <Stat
                  label="Status"
                  value={preview.pledge.status === "overdue" ? "Overdue" : "Active"}
                />
              </div>

              <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">
                  This reduces the loan only. The due date stays{" "}
                  <strong>{formatDate(preview.pledge.due_date)}</strong>, every
                  item stays in the locker, and interest already owed is still
                  collected on the Interest Payments screen.
                </p>
              </div>
            </Card>

            {/* Payment */}
            <Card className="p-5">
              <h4 className="font-semibold text-zinc-800 mb-4">Payment</h4>

              <label className="text-sm font-semibold text-zinc-700 mb-2 block">
                Amount toward the loan
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />

              <div className="flex flex-wrap gap-2 mt-3">
                {[0.25, 0.5, 1].map((fraction) => (
                  <button
                    key={fraction}
                    type="button"
                    onClick={() =>
                      setAmount((outstanding * fraction).toFixed(2))
                    }
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 text-zinc-600 hover:border-amber-300"
                  >
                    {fraction === 1 ? "Settle all" : `${fraction * 100}%`}
                  </button>
                ))}
              </div>

              {overpaying && (
                <p className="mt-3 text-sm text-red-600">
                  Only {formatCurrency(outstanding)} of principal is
                  outstanding.
                </p>
              )}

              {amountValue > 0 && !overpaying && (
                <div className="mt-4 p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-2">
                  <Row label="Principal now" value={formatCurrency(outstanding)} />
                  <Row label="Paying" value={`− ${formatCurrency(amountValue)}`} />
                  <div className="flex justify-between pt-2 border-t border-zinc-200 font-semibold">
                    <span className="text-zinc-800">Loan after payment</span>
                    <span className="text-amber-600">
                      {formatCurrency(remainingAfter)}
                    </span>
                  </div>
                  {remainingAfter <= 0.005 && (
                    <p className="text-sm text-emerald-700 pt-1">
                      This clears the loan. Any interest still owed must be paid
                      before the items are released.
                    </p>
                  )}
                </div>
              )}

              {/* Method */}
              <label className="text-sm font-semibold text-zinc-700 mt-5 mb-2 block">
                Payment Method
              </label>
              <div className="flex gap-2">
                {[
                  { id: "cash", label: "Cash", icon: Wallet },
                  { id: "transfer", label: "Transfer", icon: Building2 },
                  { id: "partial", label: "Split", icon: CreditCard },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors",
                      paymentMethod === method.id
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-amber-300",
                    )}
                  >
                    <method.icon className="w-4 h-4" />
                    {method.label}
                  </button>
                ))}
              </div>

              {paymentMethod === "partial" && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-1 block">
                      Cash
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-zinc-700 mb-1 block">
                      Transfer
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {paymentMethod !== "cash" && (
                <div className="mt-3">
                  <label className="text-sm font-semibold text-zinc-700 mb-1 block">
                    Reference No
                  </label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Transfer reference"
                  />
                </div>
              )}

              <div className="mt-3">
                <label className="text-sm font-semibold text-zinc-700 mb-1 block">
                  Notes (optional)
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                variant="accent"
                className="w-full mt-5"
                onClick={handleSubmit}
                disabled={isSaving || amountValue <= 0 || overpaying}
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <TrendingDown className="w-4 h-4 mr-2" />
                )}
                Record Payment
              </Button>
            </Card>

            {/* What has been paid before */}
            {history.length > 0 && (
              <Card className="p-5">
                <h4 className="font-semibold text-zinc-800 mb-3">
                  Previous principal payments
                </h4>
                <div className="divide-y divide-zinc-100">
                  {history.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between py-2.5"
                    >
                      <div>
                        <p className="font-mono text-sm text-zinc-800">
                          {row.payment_no}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {formatDate(row.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-zinc-800">
                          {formatCurrency(row.amount)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          loan became {formatCurrency(row.principal_after)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {result && (
          <Card className="p-5 border-emerald-200 bg-emerald-50">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-emerald-900 mb-1">
                  {result.payment.payment_no} recorded
                </h4>
                <p className="text-sm text-emerald-800">
                  {formatCurrency(result.payment.amount)} paid. Loan is now{" "}
                  <strong>{formatCurrency(result.principal.after)}</strong>.
                  Months already elapsed are still charged on the larger amount.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100">
      <p className="text-xs font-semibold text-zinc-600 mb-0.5">{label}</p>
      <p
        className={cn(
          "text-zinc-800",
          strong ? "text-lg font-bold" : "font-medium",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="font-medium text-zinc-600">{label}</span>
      <span className="font-medium text-zinc-700">{value}</span>
    </div>
  );
}
