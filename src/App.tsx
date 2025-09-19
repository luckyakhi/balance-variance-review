
import React, { useEffect, useMemo, useState } from 'react'
import { fetchVariances, fetchTransactions } from './dataService'
import type { VarianceRow as VRow, Txn } from './dataService'

const fmtINR = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const pct = (a: number, b: number) => (b === 0 ? 0 : (a / b) * 100);

type VarianceRow = VRow;

function Badge({ children, tone = 'default' }:{children: React.ReactNode; tone?: 'default'|'ok'|'warn'|'danger'}){
  const map = {
    default: 'bg-gray-100 text-gray-800',
    ok: 'bg-green-100 text-green-800',
    warn: 'bg-amber-100 text-amber-800',
    danger: 'bg-red-100 text-red-800',
  } as const;
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${map[tone]}`}>{children}</span>;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

function Toolbar(props: any){
  const {entity,setEntity,date,setDate,search,setSearch,threshold,setThreshold,view,setView} = props;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">As-of Date</label>
        <input type="date" value={date} onChange={(e)=>setDate(e.target.value)} className="rounded-lg border-gray-300 text-sm" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs text-gray-500">Legal Entity</label>
        <select value={entity} onChange={(e)=>setEntity(e.target.value)} className="rounded-lg border-gray-300 text-sm">
          <option value="ALL">All</option>
          <option value="IN-BLR-PB">IN-BLR-PB</option>
          <option value="CH-ZRH-PB">CH-ZRH-PB</option>
          <option value="SG-SIN-PB">SG-SIN-PB</option>
        </select>
      </div>
      <div className="flex grow flex-col min-w-[220px]">
        <label className="text-xs text-gray-500">Search GL / Description</label>
        <input placeholder="e.g. 101100 or Cash Nostro" value={search} onChange={(e)=>setSearch(e.target.value)} className="rounded-lg border-gray-300 text-sm" />
      </div>
      <div className="flex flex-col max-w-[220px]">
        <label className="text-xs text-gray-500">Variance Threshold (%)</label>
        <input type="range" min={0} max={20} value={threshold} onChange={(e)=>setThreshold(Number(e.target.value))} />
        <div className="text-xs text-gray-500">≥ {threshold}%</div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-2 py-1">
        <button onClick={()=>setView('account')} className={`rounded-lg px-3 py-1 text-sm ${props.view==='account' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>By Account</button>
        <button onClick={()=>setView('product')} className={`rounded-lg px-3 py-1 text-sm ${props.view==='product' ? 'bg-gray-900 text-white' : 'text-gray-700'}`}>By Product</button>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button className="rounded-xl border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onClick={()=>props.onExport?.()}>Export CSV</button>
        <button className="rounded-xl bg-gray-900 px-3 py-2 text-sm text-white shadow">Create Task</button>
      </div>
    </div>
  )
}

type ExpandedRowState = {
  open: boolean;
  loading: boolean;
  txns: Txn[];
  page: number;
};

function VarianceTable({ rows }:{rows: VarianceRow[]}){
  const [sort,setSort] = useState<{key: keyof VarianceRow | 'absVar' | '%Var'; dir:'asc'|'desc'}>({key:'absVar', dir:'desc'});
  const [expandedRows, setExpandedRows] = useState<Record<string, ExpandedRowState>>({});
  const pageSize = 8;

  const computed = useMemo(()=>{
    const withCalc = rows.map(r=>{
      const absVar = r.current - r.prior;
      const varPct = pct(absVar, Math.abs(r.prior)) * (absVar>=0?1:-1);
      return {...r, absVar, varPct};
    });
    const sorted = [...withCalc].sort((a:any,b:any)=>{
      const key = sort.key==='absVar' ? 'absVar' : sort.key==='%Var' ? 'varPct' : sort.key;
      const va=a[key], vb=b[key];
      if(va<vb) return sort.dir==='asc'?-1:1;
      if(va>vb) return sort.dir==='asc'?1:-1;
      return 0;
    });
    return sorted;
  },[rows, sort]);

  const handleToggle = (row: VarianceRow) => {
    const current = expandedRows[row.id];
    const nextOpen = !(current?.open);
    const shouldFetch = nextOpen && (!current || current.txns.length === 0);

    setExpandedRows(prev => ({
      ...prev,
      [row.id]: {
        open: nextOpen,
        loading: shouldFetch,
        txns: current?.txns ?? [],
        page: nextOpen ? 1 : (current?.page ?? 1),
      },
    }));

    if (shouldFetch) {
      fetchTransactions(row.id)
        .then(txns => {
          setExpandedRows(prev => {
            const existing = prev[row.id];
            if (!existing) {
              return prev;
            }
            return {
              ...prev,
              [row.id]: {
                ...existing,
                loading: false,
                txns,
                page: 1,
              },
            };
          });
        })
        .catch(() => {
          setExpandedRows(prev => {
            const existing = prev[row.id];
            if (!existing) {
              return prev;
            }
            return {
              ...prev,
              [row.id]: {
                ...existing,
                loading: false,
                txns: [],
              },
            };
          });
        });
    }
  };

  const changePage = (rowId: string, delta: number) => {
    setExpandedRows(prev => {
      const entry = prev[rowId];
      if (!entry) return prev;
      const pages = Math.max(1, Math.ceil(entry.txns.length / pageSize));
      const safePage = Math.min(entry.page, pages);
      const nextPage = Math.min(pages, Math.max(1, safePage + delta));
      if (nextPage === entry.page) {
        if (entry.page !== safePage) {
          return {
            ...prev,
            [rowId]: { ...entry, page: safePage },
          };
        }
        return prev;
      }
      return {
        ...prev,
        [rowId]: { ...entry, page: nextPage },
      };
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <table className="w-full table-fixed">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            {['Entity','Account','Description','Prior','Current','Abs Variance','% Variance','Threshold','Status','Owner','Last Updated',''].map((t,i)=>(
              <th key={i} className={`px-3 py-2 text-left ${i!==11?'cursor-pointer select-none':''}`}
                  onClick={()=> i!==11 && setSort(s=>({key: ['entity','gl','description','prior','current','absVar','%Var','thresholdPct','status','owner','lastUpdated'][i] as any, dir: s.key===['entity','gl','description','prior','current','absVar','%Var','thresholdPct','status','owner','lastUpdated'][i] && s.dir==='desc'?'asc':'desc'}))}>
                {t}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-sm">
          {computed.map((r)=>{
            const tone = r.status==='Breached'?'danger': r.status==='Investigate'?'warn':'ok';
            const state = expandedRows[r.id] ?? { open: false, loading: false, txns: [], page: 1 };
            const isExpanded = state.open;
            const pages = Math.max(1, Math.ceil(state.txns.length / pageSize));
            const safePage = Math.min(state.page, pages);
            const start = (safePage - 1) * pageSize;
            const paged = state.txns.slice(start, start + pageSize);
            return (
              <React.Fragment key={r.id}>
                <tr className={`hover:bg-amber-50/40 ${isExpanded ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-3 py-2 font-medium text-gray-700">{r.entity}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.gl}</td>
                  <td className="px-3 py-2 text-gray-600">{r.description}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtINR(r.prior)}</td>
                  <td className="px-3 py-2 tabular-nums">{fmtINR(r.current)}</td>
                  <td className={`px-3 py-2 tabular-nums font-medium ${(r.current - r.prior) >= 0 ? 'text-emerald-700':'text-red-700'}`}>{fmtINR(r.current - r.prior)}</td>
                  <td className={`px-3 py-2 tabular-nums ${(r as any).varPct >= 0 ? 'text-emerald-700':'text-red-700'}`}>{(r as any).varPct.toFixed(2)}%</td>
                  <td className="px-3 py-2 tabular-nums">{r.thresholdPct}%</td>
                  <td className="px-3 py-2"><Badge tone={tone as any}>{r.status}</Badge></td>
                  <td className="px-3 py-2">{r.owner}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{r.lastUpdated}</td>
                  <td className="px-3 py-2 text-right"><button onClick={()=>handleToggle(r)} className="rounded-lg border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">{isExpanded ? 'Hide' : 'View'}</button></td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={12} className="px-6 py-4">
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500">Drill-down</div>
                            <div className="text-sm font-semibold text-gray-700">{r.gl} — {r.description}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <Badge tone={tone as any}>{r.status}</Badge>
                            <span>Owner: {r.owner}</span>
                            <span>Last updated {r.lastUpdated}</span>
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                          <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
                            <div className="text-sm font-medium text-gray-700">Underlying Transactions ({state.txns.length})</div>
                          </div>
                          {state.loading ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">Loading transactions...</div>
                          ) : (
                            <>
                              <div className="overflow-x-auto">
                                <table className="w-full table-fixed text-sm">
                                  <thead className="bg-white text-xs uppercase text-gray-500">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Date</th>
                                      <th className="px-3 py-2 text-left">Txn ID</th>
                                      <th className="px-3 py-2 text-left">Narration</th>
                                      <th className="px-3 py-2">DR/CR</th>
                                      <th className="px-3 py-2 text-right">Amount</th>
                                      <th className="px-3 py-2 text-left">Source</th>
                                      <th className="px-3 py-2 text-left">Tags</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {paged.map(t=> (
                                      <tr key={t.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2">{t.date}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
                                        <td className="px-3 py-2 text-gray-600">{t.narrative}</td>
                                        <td className="px-3 py-2 text-center"><Badge tone={t.drcr==='DR'?'danger':'ok'}>{t.drcr}</Badge></td>
                                        <td className={`px-3 py-2 text-right tabular-nums ${t.drcr==='DR'?'text-red-700':'text-emerald-700'}`}>{fmtINR(t.amount)}</td>
                                        <td className="px-3 py-2">{t.source}</td>
                                        <td className="px-3 py-2 text-xs text-gray-500">{t.tags?.join(', ')}</td>
                                      </tr>
                                    ))}
                                    {paged.length===0 && (
                                      <tr>
                                        <td className="px-3 py-6 text-center text-sm text-gray-400" colSpan={7}>No transactions</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center justify-between border-t bg-white px-4 py-3 text-sm text-gray-600">
                                <div className="text-xs text-gray-500">Page {safePage} / {pages}</div>
                                <div className="flex gap-2">
                                  <button className="rounded-lg border px-3 py-1 text-xs disabled:opacity-40" disabled={safePage<=1} onClick={()=>changePage(r.id,-1)}>Prev</button>
                                  <button className="rounded-lg border px-3 py-1 text-xs disabled:opacity-40" disabled={safePage>=pages} onClick={()=>changePage(r.id,1)}>Next</button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function App(){
  const [entity,setEntity] = useState('ALL');
  const [date,setDate] = useState('2025-09-17');
  const [search,setSearch] = useState('');
  const [threshold,setThreshold] = useState(0);
  const [view,setView] = useState<'account'|'product'>('account');
  const [rows,setRows] = useState<VarianceRow[]>([]);

  useEffect(()=>{ fetchVariances().then(setRows); },[]);

  const filtered = useMemo(()=>{
    return rows.filter(r=>
      (entity==='ALL' || r.entity===entity) &&
      (search.trim()==='' || r.gl.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase())) &&
      Math.abs(pct(r.current - r.prior, Math.abs(r.prior))) >= threshold
    );
  },[rows, entity, search, threshold]);

  const summary = useMemo(()=>{
    const total = filtered.length;
    const breached = filtered.filter(r=>r.status==='Breached').length;
    const investigate = filtered.filter(r=>r.status==='Investigate').length;
    const totalAbs = filtered.reduce((acc,r)=>acc+Math.abs(r.current - r.prior),0);
    return { total, breached, investigate, totalAbs };
  },[filtered]);

  const onExport = ()=>{
    const headers = ['entity','gl','description','prior','current','absVariance','pctVariance','thresholdPct','status','owner','lastUpdated'];
    const lines = [headers.join(',')];
    filtered.forEach(r=>{
      const absVar = r.current - r.prior;
      const varPct = pct(absVar, Math.abs(r.prior)) * (absVar>=0?1:-1);
      lines.push([r.entity, r.gl, r.description.replace(/,/g, ';'), r.prior, r.current, absVar, varPct.toFixed(2)+'%', r.thresholdPct, r.status, r.owner, r.lastUpdated].join(','));
    })
    const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'variance_export.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500">Corporate Reporting</div>
          <h1 className="text-2xl font-semibold">Balance Variance Review</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-xl border border-gray-300 px-3 py-2 text-sm">Help</button>
          <button className="rounded-xl bg-gray-900 px-3 py-2 text-sm text-white">New Review</button>
        </div>
      </div>
      <Toolbar entity={entity} setEntity={setEntity} date={date} setDate={setDate} search={search} setSearch={setSearch} threshold={threshold} setThreshold={setThreshold} view={view} setView={setView} onExport={onExport} />
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Accounts in Scope" value={String(summary.total)} />
        <StatCard label="> Threshold" value={String(summary.investigate + summary.breached)} sub={`${summary.breached} breached`} />
        <StatCard label="Total Abs Variance" value={fmtINR(summary.totalAbs)} />
        <StatCard label="Entity" value={entity==='ALL'?'All':entity} sub={`As-of ${date}`} />
      </div>
      <div className="mt-4">
        <VarianceTable rows={filtered} />
      </div>
      <div className="mt-6 text-center text-xs text-gray-400">Mock API ready at /api/* (or fallback to local data).</div>
    </div>
  )
}
