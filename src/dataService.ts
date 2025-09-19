
export type VarianceRow = {
  id: string;
  entity: string;
  bookDate: string;
  gl: string;
  description: string;
  prior: number;
  current: number;
  thresholdPct: number;
  owner: string;
  status: "OK" | "Investigate" | "Breached";
  lastUpdated: string;
};

export type Txn = {
  id: string;
  date: string;
  source: string;
  narrative: string;
  drcr: "DR" | "CR";
  amount: number;
  tags?: string[];
};

export async function fetchVariances(): Promise<VarianceRow[]> {
  try {
    const res = await fetch('/api/variances');
    if (!res.ok) throw new Error('bad status');
    return await res.json();
  } catch {
    const mod = await import('./mockData');
    return mod.VARIANCES;
  }
}

export async function fetchTransactions(varId: string): Promise<Txn[]> {
  try {
    const res = await fetch(`/api/transactions/${varId}`);
    if (!res.ok) throw new Error('bad status');
    return await res.json();
  } catch {
    const mod = await import('./mockData');
    return mod.MOCK_TXNS[varId] ?? [];
  }
}
