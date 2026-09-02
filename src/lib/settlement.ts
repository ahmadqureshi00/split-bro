import type { Member, Expense, ExpenseSplit } from "./supabaseClient";

export interface Transfer {
  from: string;     // member id
  fromName: string;
  to: string;       // member id
  toName: string;
  amount: number;
}

/**
 * Compute the net balance for every member.
 * Positive = is owed money (creditor), Negative = owes money (debtor).
 */
export function computeBalances(
  members: Member[],
  expenses: Expense[],
  splits: ExpenseSplit[]
): Map<string, number> {
  const balances = new Map<string, number>();

  // Initialise all members at zero
  for (const m of members) {
    balances.set(m.id, 0);
  }

  // Add what each person paid
  for (const exp of expenses) {
    balances.set(exp.paid_by, (balances.get(exp.paid_by) ?? 0) + exp.amount);
  }

  // Subtract what each person consumed (their split share)
  for (const s of splits) {
    balances.set(s.member_id, (balances.get(s.member_id) ?? 0) - s.amount);
  }

  return balances;
}

/**
 * Greedy debt minimisation.
 * Repeatedly matches the largest debtor with the largest creditor.
 * Returns the minimal list of settlement transfers.
 */
export function computeSettlements(
  members: Member[],
  expenses: Expense[],
  splits: ExpenseSplit[]
): Transfer[] {
  const balances = computeBalances(members, expenses, splits);
  const nameMap = new Map(members.map((m) => [m.id, m.name]));

  // Build sorted lists of debtors and creditors
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const [id, balance] of balances) {
    if (balance < -0.5) {
      debtors.push({ id, amount: -balance }); // positive magnitude
    } else if (balance > 0.5) {
      creditors.push({ id, amount: balance });
    }
  }

  const transfers: Transfer[] = [];

  // Greedy matching
  while (debtors.length > 0 && creditors.length > 0) {
    // Sort descending so biggest is at index 0
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const debtor = debtors[0];
    const creditor = creditors[0];
    const transferAmount = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      from: debtor.id,
      fromName: nameMap.get(debtor.id) ?? "Unknown",
      to: creditor.id,
      toName: nameMap.get(creditor.id) ?? "Unknown",
      amount: Math.round(transferAmount * 100) / 100,
    });

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount < 0.5) debtors.shift();
    if (creditor.amount < 0.5) creditors.shift();
  }

  return transfers;
}
