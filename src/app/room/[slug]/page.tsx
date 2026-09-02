"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import type { Room, Member, Expense, ExpenseSplit } from "@/lib/supabaseClient";
import { computeBalances, computeSettlements, type Transfer } from "@/lib/settlement";
import confetti from "canvas-confetti";
import {
  Plus,
  Copy,
  Check,
  Share2,
  ArrowRightLeft,
  TrendingDown,
  TrendingUp,
  X,
  Receipt,
  ChevronDown,
  Users,
  Link2,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════════════
   Room Dashboard Page
   ══════════════════════════════════════════════════════════════════════ */

export default function RoomPage() {
  const params = useParams();
  const slug = params.slug as string;

  /* ── Core state ────────────────────────────────────────────────────── */
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [loading, setLoading] = useState(true);

  /* ── Identity ──────────────────────────────────────────────────────── */
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);

  /* ── Modal ─────────────────────────────────────────────────────────── */
  const [showAddExpense, setShowAddExpense] = useState(false);

  /* ── Clipboard toast ───────────────────────────────────────────────── */
  const [copied, setCopied] = useState(false);

  /* ═══════════════════════════════════════════════════════════════════
     Initial data load
     ═══════════════════════════════════════════════════════════════════ */
  const fetchAll = useCallback(async () => {
    if (!slug) return;
    setLoading(true);

    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!roomData) {
      setLoading(false);
      return;
    }
    setRoom(roomData);

    const { data: membersData } = await supabase
      .from("members")
      .select("*")
      .eq("room_id", roomData.id)
      .order("created_at", { ascending: true });
    setMembers(membersData ?? []);

    const { data: expensesData } = await supabase
      .from("expenses")
      .select("*")
      .eq("room_id", roomData.id)
      .order("created_at", { ascending: false });
    setExpenses(expensesData ?? []);

    if (expensesData && expensesData.length > 0) {
      const expenseIds = expensesData.map((e) => e.id);
      const { data: splitsData } = await supabase
        .from("expense_splits")
        .select("*")
        .in("expense_id", expenseIds);
      setSplits(splitsData ?? []);
    } else {
      setSplits([]);
    }

    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ═══════════════════════════════════════════════════════════════════
     Identity check (localStorage)
     ═══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!room || members.length === 0) return;
    const stored = localStorage.getItem(`splitbro_user_${room.id}`);
    if (stored && members.find((m) => m.id === stored)) {
      setCurrentUser(stored);
    } else {
      setShowIdentityPicker(true);
    }
  }, [room, members]);

  const pickIdentity = (memberId: string) => {
    if (!room) return;
    localStorage.setItem(`splitbro_user_${room.id}`, memberId);
    setCurrentUser(memberId);
    setShowIdentityPicker(false);
    confetti({ particleCount: 60, spread: 55, origin: { y: 0.7 } });
  };

  /* ═══════════════════════════════════════════════════════════════════
     Realtime subscriptions
     ═══════════════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `room_id=eq.${room.id}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expense_splits" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, fetchAll]);

  /* ═══════════════════════════════════════════════════════════════════
     Derived data
     ═══════════════════════════════════════════════════════════════════ */
  const balances = computeBalances(members, expenses, splits);
  const settlements = computeSettlements(members, expenses, splits);
  const memberMap = new Map(members.map((m) => [m.id, m.name]));
  const totalSpent = expenses.reduce((acc, e) => acc + e.amount, 0);

  /* ═══════════════════════════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════════════════════════ */
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportWhatsApp = () => {
    if (!room) return;
    const currency = room.currency || "Rs";
    const lines: string[] = [];

    lines.push(`📒 *${room.name}* — Split Bro`);
    lines.push("");
    lines.push(`💰 Total: ${currency} ${totalSpent.toLocaleString()}`);
    lines.push(`👥 ${members.length} members`);
    lines.push("");

    if (settlements.length > 0) {
      lines.push("🔄 *Settlements:*");
      for (const t of settlements) {
        lines.push(`• ${t.fromName} ➜ ${t.toName}: ${currency} ${t.amount.toLocaleString()}`);
      }
    } else {
      lines.push("✅ All settled up!");
    }

    lines.push("");
    lines.push(`🔗 ${shareUrl}`);

    const msg = lines.join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <main className="min-h-dvh bg-[#F6F7F9] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center animate-pulse bg-gradient-to-br from-[#FF5C28] to-[#FF7A45]">
            <Receipt className="w-7 h-7 text-white" />
          </div>
          <p className="text-sm font-medium text-zinc-400">
            Loading your Khata…
          </p>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-dvh bg-[#F6F7F9] flex items-center justify-center px-4">
        <div className="bento-card text-center max-w-sm">
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Room Not Found</h2>
          <p className="text-sm text-zinc-500">
            This Khata doesn&apos;t exist or may have been removed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-dvh bg-[#F6F7F9]">
        <div className="app-shell px-4 pt-6 pb-28 safe-bottom space-y-4">
          {/* ── Header Card ────────────────────────────────── */}
          <div className="bento-card animate-pop">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-[#FF5C28] mb-0.5">
                  Khata
                </p>
                <h1 className="text-[1.625rem] font-extrabold tracking-tight text-zinc-900 leading-tight truncate">
                  {room.name}
                </h1>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-500 font-medium">
                    {members.length} members
                  </span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-xs font-semibold text-zinc-700">
                    {room.currency || "Rs"} {totalSpent.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#FF5C28] to-[#FF7A45] shadow-lg shadow-orange-200/50">
                <Receipt className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          {/* ── Balance Overview ───────────────────────────── */}
          <div className="animate-pop stagger-1">
            <p className="section-label mb-2.5">Balances</p>
            <div className="grid grid-cols-2 gap-2.5">
              {members.map((m) => {
                const bal = balances.get(m.id) ?? 0;
                const isPositive = bal >= 0;
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 transition-all ${isPositive ? "balance-positive" : "balance-negative"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {isPositive ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className="text-xs font-semibold text-zinc-800 truncate">
                        {m.name}
                      </span>
                      {m.id === currentUser && (
                        <span className="badge badge-neutral text-[0.55rem] ml-auto">You</span>
                      )}
                    </div>
                    <p
                      className="text-lg font-extrabold tracking-tight"
                      style={{ color: isPositive ? "#059669" : "#dc2626" }}
                    >
                      {isPositive ? "+" : "-"}
                      {(room.currency || "Rs")} {Math.abs(Math.round(bal)).toLocaleString()}
                    </p>
                    <p className="text-[0.625rem] font-medium mt-0.5 text-zinc-400">
                      {isPositive ? "gets back" : "owes"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Settlements ────────────────────────────────── */}
          <div className="bento-card animate-pop stagger-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#FF5C28]" />
              </div>
              <h2 className="text-sm font-bold text-zinc-900">Settlements</h2>
            </div>
            {settlements.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-sm font-semibold text-emerald-600">
                  ✅ All settled up!
                </p>
                <p className="text-xs mt-1 text-zinc-400">
                  No pending transfers
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {settlements.map((t: Transfer, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-[#FAFAFA] border border-zinc-100"
                  >
                    <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] font-semibold truncate text-zinc-800">
                        <span className="text-red-600">{t.fromName}</span>
                        <span className="text-zinc-300 mx-1">→</span>
                        <span className="text-emerald-600">{t.toName}</span>
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-zinc-900 tabular-nums">
                      {(room.currency || "Rs")} {t.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Recent Expenses ────────────────────────────── */}
          <div className="animate-pop stagger-3">
            <p className="section-label mb-2.5">
              Recent Expenses ({expenses.length})
            </p>
            {expenses.length === 0 ? (
              <div className="bento-card text-center py-10">
                <Receipt className="w-10 h-10 mx-auto mb-3 text-zinc-200" />
                <p className="text-sm font-semibold text-zinc-400">
                  No expenses yet
                </p>
                <p className="text-xs mt-1 text-zinc-300">
                  Tap the + button to add one
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {expenses.map((exp) => {
                  const expSplits = splits.filter((s) => s.expense_id === exp.id);
                  return (
                    <div key={exp.id} className="bento-card">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[0.875rem] font-bold text-zinc-900 truncate">{exp.title}</h3>
                          <p className="text-xs mt-0.5 text-zinc-500">
                            Paid by{" "}
                            <span className="font-semibold text-zinc-700">
                              {memberMap.get(exp.paid_by) ?? "Unknown"}
                            </span>
                            <span className="text-zinc-300 mx-1">·</span>
                            {formatDate(exp.created_at)}
                          </p>
                        </div>
                        <span className="text-[0.9375rem] font-extrabold flex-shrink-0 text-transparent bg-clip-text bg-gradient-to-r from-[#FF5C28] to-[#FF7A45] tabular-nums">
                          {(room.currency || "Rs")} {exp.amount.toLocaleString()}
                        </span>
                      </div>
                      {expSplits.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {expSplits.map((s) => (
                            <span key={s.id} className="badge badge-neutral">
                              {memberMap.get(s.member_id) ?? "?"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Floating Dock (iOS-style) ────────────────────── */}
      <div className="floating-dock">
        <div className="dock-inner">
          {/* Left: Share Link */}
          <button
            id="copy-link-btn"
            className="tap-target flex items-center gap-1.5 px-2 py-1"
            onClick={copyLink}
            aria-label="Copy share link"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Link2 className="w-4 h-4 text-zinc-400" />
            )}
            <span className="text-xs font-medium text-zinc-400">
              {copied ? "Copied!" : "Share"}
            </span>
          </button>

          {/* Center: FAB */}
          <button
            id="add-expense-fab"
            className="fab"
            onClick={() => setShowAddExpense(true)}
            aria-label="Add expense"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
          </button>

          {/* Right: WhatsApp */}
          <button
            id="whatsapp-btn"
            className="tap-target flex items-center gap-1.5 px-2 py-1"
            onClick={exportWhatsApp}
            aria-label="Share on WhatsApp"
          >
            <Share2 className="w-4 h-4 text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400">WhatsApp</span>
          </button>
        </div>
      </div>

      {/* ── Identity Picker Modal ────────────────────────── */}
      {showIdentityPicker && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <h2 className="text-xl font-bold text-zinc-900">Who are you?</h2>
            <p className="text-xs text-zinc-500 mt-1 mb-5">
              Pick your name to personalise this Khata
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <button
                  key={m.id}
                  className="tap-target w-full text-left p-4 rounded-2xl border border-zinc-200 bg-white hover:border-orange-300 hover:bg-orange-50/50 transition-all flex items-center gap-3"
                  onClick={() => pickIdentity(m.id)}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-gradient-to-br from-[#FF5C28] to-[#FF7A45]">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-[0.9375rem] font-semibold text-zinc-900">{m.name}</span>
                  <ChevronDown className="w-4 h-4 text-zinc-300 ml-auto -rotate-90" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ────────────────────────────── */}
      {showAddExpense && room && (
        <AddExpenseModal
          room={room}
          members={members}
          onClose={() => setShowAddExpense(false)}
          onAdded={fetchAll}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Add Expense Modal — Mobile-Optimized Bottom Sheet
   ══════════════════════════════════════════════════════════════════════ */

function AddExpenseModal({
  room,
  members,
  onClose,
  onAdded,
}: {
  room: Room;
  members: Member[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(members.map((m) => m.id))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPaidDropdown, setShowPaidDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPaidDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleMember = (id: string) => {
    const next = new Set(selectedMembers);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedMembers(next);
  };

  const perPersonShare = () => {
    const amt = parseFloat(amount);
    if (!amt || selectedMembers.size === 0) return 0;
    return Math.round((amt / selectedMembers.size) * 100) / 100;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    const numAmount = parseFloat(amount);

    if (!trimmedTitle) {
      setError("Title is required");
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (selectedMembers.size === 0) {
      setError("Select at least one person");
      return;
    }

    setSubmitting(true);
    try {
      const { data: expData, error: expErr } = await supabase
        .from("expenses")
        .insert({
          room_id: room.id,
          title: trimmedTitle,
          amount: numAmount,
          paid_by: paidBy,
        })
        .select()
        .single();

      if (expErr || !expData) throw expErr || new Error("Failed to add expense");

      const share = Math.round((numAmount / selectedMembers.size) * 100) / 100;
      const splitInserts = Array.from(selectedMembers).map((memberId) => ({
        expense_id: expData.id,
        member_id: memberId,
        amount: share,
      }));

      const { error: splitErr } = await supabase
        .from("expense_splits")
        .insert(splitInserts);

      if (splitErr) throw splitErr;

      confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
      onAdded();
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to add expense");
    } finally {
      setSubmitting(false);
    }
  };

  const paidByMember = members.find((m) => m.id === paidBy);
  const currency = room.currency || "Rs";

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-900">Add Expense</h2>
          <button
            className="tap-target w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Amount — Hero Input */}
          <div className="text-center">
            <label className="section-label block mb-2">
              Amount ({currency})
            </label>
            <input
              id="expense-amount-input"
              type="number"
              className="input-field input-amount"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="any"
              autoFocus
            />
          </div>

          {/* Title */}
          <div>
            <label className="section-label block mb-1.5">
              What&apos;s this for?
            </label>
            <input
              id="expense-title-input"
              type="text"
              className="input-field"
              placeholder="e.g. Groceries, Dinner, Rent"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Paid By — Custom Dropdown */}
          <div>
            <label className="section-label block mb-1.5">
              Paid by
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                id="paid-by-select"
                type="button"
                className="tap-target input-field flex items-center justify-between gap-2"
                onClick={() => setShowPaidDropdown(!showPaidDropdown)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-[#FF5C28] to-[#FF7A45]">
                    {paidByMember?.name[0]?.toUpperCase()}
                  </div>
                  <span className="font-semibold text-zinc-900">{paidByMember?.name ?? "Select"}</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform ${showPaidDropdown ? "rotate-180" : ""}`}
                />
              </button>
              {showPaidDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-zinc-100 py-1.5 z-10 max-h-52 overflow-y-auto">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`tap-target w-full text-left px-3.5 py-3 flex items-center gap-2.5 transition-colors text-sm ${
                        m.id === paidBy ? "bg-orange-50 font-semibold" : ""
                      }`}
                      onClick={() => {
                        setPaidBy(m.id);
                        setShowPaidDropdown(false);
                      }}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-gradient-to-br from-[#FF5C28] to-[#FF7A45]">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-zinc-900">{m.name}</span>
                      {m.id === paidBy && <Check className="w-4 h-4 ml-auto text-[#FF5C28]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Split Between — Pill Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="section-label">
                Split between
              </label>
              {parseFloat(amount) > 0 && selectedMembers.size > 0 && (
                <span className="text-xs font-bold text-[#FF5C28]">
                  {currency} {perPersonShare().toLocaleString()} each
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {members.map((m) => {
                const selected = selectedMembers.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className={`tap-target flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? "bg-orange-50 border-orange-200 ring-1 ring-orange-200"
                        : "bg-white border-zinc-100"
                    }`}
                    onClick={() => toggleMember(m.id)}
                  >
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[0.65rem] font-bold transition-colors ${
                        selected
                          ? "bg-gradient-to-br from-[#FF5C28] to-[#FF7A45] text-white"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {selected ? "✓" : ""}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-semibold text-zinc-900 truncate">{m.name}</p>
                      {selected && parseFloat(amount) > 0 && (
                        <p className="text-[0.625rem] font-medium text-zinc-400 tabular-nums">
                          {currency} {perPersonShare().toLocaleString()}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm font-medium text-red-600 bg-red-50 px-3.5 py-2.5 rounded-xl border border-red-100">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="submit-expense-btn"
            type="submit"
            className="btn-accent w-full flex items-center justify-center gap-2"
            disabled={submitting}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Adding…
              </span>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Add Expense
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
