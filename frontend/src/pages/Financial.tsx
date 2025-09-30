import React, { useMemo, useState } from 'react';
import { Layers, ReceiptText, Wallet } from 'lucide-react';
import Budget from './Budget';

type TabKey = 'budget' | 'rcb' | 'pr';

const Financial: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('rcb');
  const [financialYear, setFinancialYear] = useState<string>(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q1');

  // RCB settings per year/quarter for dynamic columns
  type RCBSettings = {
    mooeAccounts: string[];
    coAccounts: string[];
    withholdingTypes: string[]; // up to 2 entries
  };
  const [rcbSettingsByYQ, setRcbSettingsByYQ] = useState<Record<string, RCBSettings>>({});

  // Year-Quarter key and settings (define early for draft defaults)
  const yqKey = `${financialYear}-${quarter}`;
  const rcbSettings: RCBSettings = useMemo(() => {
    if (!rcbSettingsByYQ[yqKey]) {
      const defaults: RCBSettings = {
        mooeAccounts: ['Travelling Expenses', 'Maintenance/Other Operating'],
        coAccounts: ['Office Equipment'],
        withholdingTypes: ['Type 1', 'Type 2']
      };
      setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: defaults }));
      return defaults;
    }
    return rcbSettingsByYQ[yqKey];
  }, [yqKey, rcbSettingsByYQ]);

  // RCB entries per year-quarter
  type RCBEntry = {
    date: string;
    reference: string;
    payee: string;
    particulars: string;
    deposit: number;
    withdrawal: number;
    balance: number; // computed client-side for now
    mooe: Record<string, number>;
    co: Record<string, number>;
    advOfficials: number;
    advTreasurer: number;
    others: number;
    withholding: Record<string, number>;
  };
  const [rcbEntriesByYQ, setRcbEntriesByYQ] = useState<Record<string, RCBEntry[]>>({});

  // Draft entry inputs
  const emptyDraft = (): RCBEntry => ({
    date: new Date().toISOString().slice(0,10),
    reference: '',
    payee: '',
    particulars: '',
    deposit: 0,
    withdrawal: 0,
    balance: 0,
    mooe: Object.fromEntries(rcbSettings.mooeAccounts.map(n => [n, 0])),
    co: Object.fromEntries(rcbSettings.coAccounts.map(n => [n, 0])),
    advOfficials: 0,
    advTreasurer: 0,
    others: 0,
    withholding: Object.fromEntries((rcbSettings.withholdingTypes.length? rcbSettings.withholdingTypes:['Withholding']).map(n => [n, 0])),
  });
  const [draft, setDraft] = useState<RCBEntry>(emptyDraft());
  
  // Reset draft when settings change
  const settingsKey = JSON.stringify(rcbSettings);
  React.useEffect(() => { setDraft(emptyDraft()); }, [settingsKey]);
  
  const toNumber = (v: string) => {
    const n = parseFloat(v.replace(/,/g,''));
    return isNaN(n)? 0 : n;
  };
  
  const entries = useMemo(() => rcbEntriesByYQ[yqKey] || [], [rcbEntriesByYQ, yqKey]);

  const addEntry = () => {
    const newEntries = [...entries, { ...draft }];
    // recompute running balance: start from previous balance, then +deposit -withdrawal
    let run = 0;
    newEntries.forEach((e, idx) => {
      run = (idx === 0 ? 0 : newEntries[idx-1].balance) + (e.deposit||0) - (e.withdrawal||0);
      e.balance = run;
    });
    setRcbEntriesByYQ(prev => ({ ...prev, [yqKey]: newEntries }));
    setDraft(emptyDraft());
  };
  
  const totals = useMemo(() => {
    const sum = (arr: number[]) => arr.reduce((a,b)=>a+b,0);
    return {
      deposit: sum(entries.map(e=>e.deposit||0)),
      withdrawal: sum(entries.map(e=>e.withdrawal||0)),
      balance: entries.length ? entries[entries.length-1].balance : 0,
      mooe: Object.fromEntries(rcbSettings.mooeAccounts.map(n => [n, sum(entries.map(e=>e.mooe[n]||0))])),
      co: Object.fromEntries(rcbSettings.coAccounts.map(n => [n, sum(entries.map(e=>e.co[n]||0))])),
      advOfficials: sum(entries.map(e=>e.advOfficials||0)),
      advTreasurer: sum(entries.map(e=>e.advTreasurer||0)),
      others: sum(entries.map(e=>e.others||0)),
      withholding: Object.fromEntries((rcbSettings.withholdingTypes.length? rcbSettings.withholdingTypes:['Withholding']).map(n => [n, sum(entries.map(e=>e.withholding[n]||0))])),
    };
  }, [entries, rcbSettings]);

  // (removed duplicate yqKey/rcbSettings)

  const updateRcbSettings = (updater: (s: RCBSettings) => RCBSettings) => {
    setRcbSettingsByYQ(prev => ({ ...prev, [yqKey]: updater(rcbSettings) }));
  };
  

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial</h1>
          <p className="text-sm text-gray-500">Unified module for Budget, Register of Cash in Bank (RCB), and Purchase Requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 relative">
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
            >
              {Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 3 + i)).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="min-w-0 relative">
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as any)}
              className="px-4 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm font-medium appearance-none"
            >
              {(['Q1','Q2','Q3','Q4'] as const).map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('budget')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'budget' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Wallet className="h-4 w-4" /> Budget
          </button>
          <button
            onClick={() => setActiveTab('rcb')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'rcb' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Layers className="h-4 w-4" /> Register of Cash in Bank
          </button>
          <button
            onClick={() => setActiveTab('pr')}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'pr' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ReceiptText className="h-4 w-4" /> Purchase Requests
          </button>
        </nav>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'budget' && (
          <div className="space-y-4">
            <Budget />
          </div>
        )}

        {activeTab === 'rcb' && (
          <div className="card p-6">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-900">Register of Cash in Bank and Other Related Financial Transactions</div>
              <div className="text-sm text-gray-600">Year {financialYear} • {quarter}</div>
            </div>

            {/* RCB column settings (quick inline editor) */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">MOOE subaccounts</div>
                <div className="space-y-2">
                  {rcbSettings.mooeAccounts.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, mooeAccounts: s.mooeAccounts.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, mooeAccounts: s.mooeAccounts.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => updateRcbSettings(s => ({ ...s, mooeAccounts: [...s.mooeAccounts, 'New MOOE'] }))}
                  >Add subaccount</button>
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">Capital Outlay subaccounts</div>
                <div className="space-y-2">
                  {rcbSettings.coAccounts.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, coAccounts: s.coAccounts.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, coAccounts: s.coAccounts.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => updateRcbSettings(s => ({ ...s, coAccounts: [...s.coAccounts, 'New CO'] }))}
                  >Add subaccount</button>
                </div>
              </div>

              <div className="border border-gray-200 rounded p-3">
                <div className="text-sm font-medium mb-2">Withholding types (max 2)</div>
                <div className="space-y-2">
                  {rcbSettings.withholdingTypes.map((name, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        value={name}
                        onChange={e => updateRcbSettings(s => ({ ...s, withholdingTypes: s.withholdingTypes.map((n, i) => i===idx? e.target.value : n) }))}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        className="text-red-600 text-xs"
                        onClick={() => updateRcbSettings(s => ({ ...s, withholdingTypes: s.withholdingTypes.filter((_, i) => i!==idx) }))}
                      >Remove</button>
                    </div>
                  ))}
                  {rcbSettings.withholdingTypes.length < 2 && (
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => updateRcbSettings(s => ({ ...s, withholdingTypes: [...s.withholdingTypes, 'New Tax Type'] }))}
                    >Add type</button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 text-xs">
                <thead>
                  {/* Row 1: Group headers */}
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left" rowSpan={3}>Date</th>
                    <th className="border p-2 text-left" rowSpan={3}>Reference</th>
                    <th className="border p-2 text-left" rowSpan={3}>Name of Payee</th>
                    <th className="border p-2 text-left" rowSpan={3}>Particulars</th>
                    <th className="border p-2 text-center" colSpan={3}>Cash in Bank</th>
                    <th className="border p-2 text-center" colSpan={
                      rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2
                    }>Breakdown of Withdrawals/Payments</th>
                    <th className="border p-2 text-center" rowSpan={3}>Others</th>
                    <th className="border p-2 text-center" rowSpan={2} colSpan={Math.max(1, rcbSettings.withholdingTypes.length)}>Withholding Tax</th>
                  </tr>
                  {/* Row 2: Sub-groups under Breakdown */}
                  <tr className="bg-gray-50">
                    <th className="border p-2" rowSpan={2}>Deposit</th>
                    <th className="border p-2" rowSpan={2}>Withdrawal</th>
                    <th className="border p-2" rowSpan={2}>Balance</th>
                    <th className="border p-2 text-center" colSpan={rcbSettings.mooeAccounts.length}>Maintenance and Other Operating Expenses (MOOE)</th>
                    <th className="border p-2 text-center" colSpan={rcbSettings.coAccounts.length}>Capital Outlay</th>
                    <th className="border p-2 text-center" colSpan={2}>Advances</th>
                    {/* Withholding Tax header in row 1 spans to row 3 via colSpan; no cells needed here */}
                  </tr>
                  {/* Row 3: Individual sub-accounts and withholding types */}
                  <tr className="bg-gray-50">
                    {rcbSettings.mooeAccounts.map((n, i) => (
                      <th key={`mooe-${i}`} className="border p-2">{n}</th>
                    ))}
                    {rcbSettings.coAccounts.map((n, i) => (
                      <th key={`co-${i}`} className="border p-2">{n}</th>
                    ))}
                    <th className="border p-2">Adv. to SK officials</th>
                    <th className="border p-2">Adv. to SK treasurer</th>
                    {rcbSettings.withholdingTypes.map((n, i) => (
                      <th key={`wt-${i}`} className="border p-2">{n}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Input row */}
                  <tr className="bg-yellow-50">
                    <td className="border p-1"><input type="date" value={draft.date} onChange={e=>setDraft({...draft, date: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.reference} onChange={e=>setDraft({...draft, reference: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.payee} onChange={e=>setDraft({...draft, payee: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.particulars} onChange={e=>setDraft({...draft, particulars: e.target.value})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.deposit} onChange={e=>setDraft({...draft, deposit: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.withdrawal} onChange={e=>setDraft({...draft, withdrawal: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1 text-right text-gray-500">{draft.balance.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`mooei-${i}`} className="border p-1"><input value={draft.mooe[n]} onChange={e=>setDraft({...draft, mooe: {...draft.mooe, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`coi-${i}`} className="border p-1"><input value={draft.co[n]} onChange={e=>setDraft({...draft, co: {...draft.co, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    <td className="border p-1"><input value={draft.advOfficials} onChange={e=>setDraft({...draft, advOfficials: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    <td className="border p-1"><input value={draft.advTreasurer} onChange={e=>setDraft({...draft, advTreasurer: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`wti-${i}`} className="border p-1"><input value={draft.withholding[n] || 0} onChange={e=>setDraft({...draft, withholding: {...draft.withholding, [n]: toNumber(e.target.value)}})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                    ))}
                    <td className="border p-1"><input value={draft.others} onChange={e=>setDraft({...draft, others: toNumber(e.target.value)})} className="w-full border border-gray-300 rounded px-1 py-1 text-xs"/></td>
                  </tr>
                  <tr>
                    <td className="border p-1" colSpan={
                      7 + rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2 + 1 + rcbSettings.withholdingTypes.length
                    }>
                      <button className="btn-primary text-xs" onClick={addEntry}>Add entry</button>
                    </td>
                    <td className="border p-1"></td>
                  </tr>
                  {/* Existing entries */}
                  {entries.length === 0 ? (
                    <tr>
                      <td className="border p-2" colSpan={
                        7 + rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2 + 1 + rcbSettings.withholdingTypes.length
                      }>
                        No entries yet for {quarter} {financialYear}.
                      </td>
                      <td className="border p-2"></td>
                    </tr>
                  ) : entries.map((e, idx) => (
                    <tr key={idx}>
                      <td className="border p-1">{e.date}</td>
                      <td className="border p-1">{e.reference}</td>
                      <td className="border p-1">{e.payee}</td>
                      <td className="border p-1">{e.particulars}</td>
                      <td className="border p-1 text-right">{e.deposit.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.withdrawal.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.balance.toLocaleString()}</td>
                      {rcbSettings.mooeAccounts.map((n,i)=>(
                        <td key={`mooev-${i}`} className="border p-1 text-right">{(e.mooe[n]||0).toLocaleString()}</td>
                      ))}
                      {rcbSettings.coAccounts.map((n,i)=>(
                        <td key={`cov-${i}`} className="border p-1 text-right">{(e.co[n]||0).toLocaleString()}</td>
                      ))}
                      <td className="border p-1 text-right">{e.advOfficials.toLocaleString()}</td>
                      <td className="border p-1 text-right">{e.advTreasurer.toLocaleString()}</td>
                      {rcbSettings.withholdingTypes.map((n,i)=>(
                        <td key={`wtv-${i}`} className="border p-1 text-right">{(e.withholding[n]||0).toLocaleString()}</td>
                      ))}
                      <td className="border p-1 text-right">{e.others.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="border p-2 italic" colSpan={4}>Totals for the quarter</td>
                    <td className="border p-2 text-right">{totals.deposit.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.withdrawal.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.balance.toLocaleString()}</td>
                    {rcbSettings.mooeAccounts.map((n,i)=>(
                      <td key={`tmooe-${i}`} className="border p-2 text-right">{(((totals.mooe as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    {rcbSettings.coAccounts.map((n,i)=>(
                      <td key={`tco-${i}`} className="border p-2 text-right">{(((totals.co as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    <td className="border p-2 text-right">{totals.advOfficials.toLocaleString()}</td>
                    <td className="border p-2 text-right">{totals.advTreasurer.toLocaleString()}</td>
                    {rcbSettings.withholdingTypes.map((n,i)=>(
                      <td key={`twt-${i}`} className="border p-2 text-right">{(((totals.withholding as any)[n]) || 0).toLocaleString()}</td>
                    ))}
                    <td className="border p-2 text-right">{totals.others.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td className="border p-2 italic" colSpan={4}>Totals/Balance carried forward</td>
                    <td className="border p-2 text-right" colSpan={
                      3 + (rcbSettings.mooeAccounts.length + rcbSettings.coAccounts.length + 2) + 1 + rcbSettings.withholdingTypes.length
                    }>0.00</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="text-xs text-gray-500 mt-3">Prepared and certified correct by: SK Treasurer • Noted by: SK Chairperson</div>
          </div>
        )}

        {activeTab === 'pr' && (
          <div className="card p-6">
            <div className="text-gray-600 text-sm">Purchase Requests will be implemented here. It will support PR creation, line items, attachments, status tracking, and exports.</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Financial;


