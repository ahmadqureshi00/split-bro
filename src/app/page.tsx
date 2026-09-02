"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Users, Plus, Minus, ArrowRight, Sparkles, Receipt, Zap } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [members, setMembers] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addMember = () => {
    if (members.length < 20) setMembers([...members, ""]);
  };

  const removeMember = (idx: number) => {
    if (members.length > 2) setMembers(members.filter((_, i) => i !== idx));
  };

  const updateMember = (idx: number, value: string) => {
    const updated = [...members];
    updated[idx] = value;
    setMembers(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedName = roomName.trim();
    const validMembers = members.map((m) => m.trim()).filter(Boolean);

    if (!trimmedName) {
      setError("Room name is required");
      return;
    }
    if (validMembers.length < 2) {
      setError("You need at least 2 members");
      return;
    }
    const uniqueNames = new Set(validMembers.map((n) => n.toLowerCase()));
    if (uniqueNames.size !== validMembers.length) {
      setError("Duplicate member names are not allowed");
      return;
    }

    setLoading(true);
    try {
      const slug = Math.random().toString(36).substring(2, 9);

      console.log("[Split Bro] Creating room:", { name: trimmedName, slug });
      const { data: room, error: roomErr } = await supabase
        .from("rooms")
        .insert({ name: trimmedName, slug })
        .select()
        .single();

      if (roomErr) {
        console.error("[Split Bro] Room creation error:", roomErr);
        throw new Error(roomErr.message || "Failed to create room");
      }
      if (!room) {
        throw new Error("Room was created but no data was returned");
      }
      console.log("[Split Bro] Room created:", room);

      const memberInserts = validMembers.map((name) => ({
        room_id: room.id,
        name: name.trim(),
      }));

      console.log("[Split Bro] Inserting members:", memberInserts);
      const { error: membersErr } = await supabase
        .from("members")
        .insert(memberInserts);

      if (membersErr) {
        console.error("[Split Bro] Members insertion error:", membersErr);
        throw new Error(membersErr.message || "Failed to add members");
      }
      console.log("[Split Bro] Members inserted successfully");

      router.push(`/room/${slug}`);
    } catch (err: unknown) {
      console.error("[Split Bro] handleSubmit error:", err);
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#F6F7F9] flex items-center justify-center px-4 py-8">
      <div className="app-shell space-y-5 px-1">
        {/* ── Hero Card ─────────────────────────────────── */}
        <div className="bento-card text-center animate-pop">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#FF5C28] to-[#FF7A45] shadow-lg shadow-orange-200">
            <Receipt className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Split <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5C28] to-[#FF7A45]">Bro</span>
          </h1>
          <p className="text-sm mt-2 text-zinc-500 leading-relaxed">
            Zero-signup expense splitting for hostels &amp; trips.
            <br />
            Create a Khata, share the link, done. ⚡
          </p>
        </div>

        {/* ── Feature Pills ─────────────────────────────── */}
        <div className="flex items-center justify-center gap-2 flex-wrap animate-pop stagger-1">
          {[
            { icon: <Zap className="w-3.5 h-3.5" />, label: "Instant" },
            { icon: <Users className="w-3.5 h-3.5" />, label: "No Signup" },
            { icon: <Sparkles className="w-3.5 h-3.5" />, label: "Real-time" },
          ].map((pill) => (
            <span
              key={pill.label}
              className="badge badge-orange px-3 py-1.5 text-xs"
            >
              {pill.icon}
              {pill.label}
            </span>
          ))}
        </div>

        {/* ── Create Room Form ──────────────────────────── */}
        <form onSubmit={handleSubmit} className="bento-card space-y-5 animate-pop stagger-2">
          <h2 className="text-lg font-bold text-zinc-900">
            Create a new Khata
          </h2>

          {/* Room Name */}
          <div>
            <label className="section-label block mb-1.5">
              Room Name
            </label>
            <input
              id="room-name-input"
              type="text"
              className="input-field"
              placeholder="e.g. Hostel 42"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="section-label">
                Members ({members.length})
              </label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="tap-target w-8 h-8 rounded-xl flex items-center justify-center border border-zinc-200 bg-zinc-50"
                  onClick={() => removeMember(members.length - 1)}
                  disabled={members.length <= 2}
                  aria-label="Remove member"
                >
                  <Minus className="w-4 h-4 text-zinc-400" />
                </button>
                <button
                  type="button"
                  className="tap-target w-8 h-8 rounded-xl flex items-center justify-center border border-orange-200 bg-orange-50"
                  onClick={addMember}
                  disabled={members.length >= 20}
                  aria-label="Add member"
                >
                  <Plus className="w-4 h-4 text-[#FF5C28]" />
                </button>
              </div>
            </div>
            <div className="space-y-2.5">
              {members.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-[#FF5C28] to-[#FF7A45]">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={`Member ${idx + 1} name`}
                    value={name}
                    onChange={(e) => updateMember(idx, e.target.value)}
                    maxLength={30}
                  />
                  {members.length > 2 && (
                    <button
                      type="button"
                      className="tap-target w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      onClick={() => removeMember(idx)}
                      aria-label={`Remove member ${idx + 1}`}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm font-medium text-red-600 bg-red-50 px-3.5 py-2.5 rounded-xl border border-red-100">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="create-room-btn"
            type="submit"
            className="btn-accent w-full flex items-center justify-center gap-2 text-base"
            disabled={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating…
              </span>
            ) : (
              <>
                Create Room Khata
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* ── Footer ────────────────────────────────────── */}
        <p className="text-center text-xs text-zinc-400 animate-pop stagger-3 pb-4">
          Built by Ahmad Qureshi with ❤️ for hostel life · No data leaves your Khata
        </p>
      </div>
    </main>
  );
}
