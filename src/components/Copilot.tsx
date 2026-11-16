import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Loader2, Send, Sparkles, User, Zap } from 'lucide-react';
import { PlanLimitError, useWorkspace } from '@/hooks/useWorkspace';
import { createMessage, getSuggestedQueries, processLLMQuery, processLocalQuery, type CopilotContext } from '@/lib/copilotEngine';
import { EmptyWorkspace } from '@/components/EmptyWorkspace';
import type { CopilotMessage } from '@/types';

/** Safe renderer: **bold** and • bullets only. Never injects HTML (vendor names come from uploaded files). */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
            {parts.map((p, j) => (p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : <Fragment key={j}>{p}</Fragment>))}
          </p>
        );
      })}
    </>
  );
}

export function Copilot() {
  const { activeDataset, transactions, analysis, settings, updateSettings, consumeCopilotQuery, copilotRemaining, plan, openUpgrade } = useWorkspace();
  const [histories, setHistories] = useState<Record<string, CopilotMessage[]>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => { try { return sessionStorage.getItem('finsight:apikey') ?? ''; } catch { return ''; } });
  const [showKey, setShowKey] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const id = activeDataset?.id ?? '';

  const ctx: CopilotContext = useMemo(
    () => ({ datasetName: activeDataset?.name ?? '', transactions, anomalies: analysis.anomalies, kpis: analysis.kpis, monthly: analysis.monthly, alerts: analysis.alerts }),
    [activeDataset, transactions, analysis]
  );
  const messages = histories[id] ?? [];
  const suggestions = useMemo(() => getSuggestedQueries(ctx), [ctx]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, loading]);

  if (!activeDataset) return <EmptyWorkspace module="the AI Financial Copilot" />;

  const push = (m: CopilotMessage) => setHistories((h) => ({ ...h, [id]: [...(h[id] ?? []), m] }));

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    try { consumeCopilotQuery(); } catch (e) {
      if (e instanceof PlanLimitError) { openUpgrade({ reason: 'Copilot question limit reached', feature: 'full_analytics' }); return; }
    }
    push(createMessage('user', q));
    setInput('');
    setLoading(true);
    try {
      let answer: string;
      if (apiKey) {
        try { answer = await processLLMQuery(q, ctx, apiKey, settings.aiProvider); }
        catch (e) { answer = `LLM request failed (${e instanceof Error ? e.message : 'error'}), so here is the local analysis:\n\n${processLocalQuery(q, ctx)}`; }
      } else {
        await new Promise((r) => setTimeout(r, 250));
        answer = processLocalQuery(q, ctx);
      }
      push(createMessage('assistant', answer));
    } finally { setLoading(false); }
  };

  const welcome = `Hello! I'm connected to **${activeDataset.name}** — ${transactions.length.toLocaleString()} transactions. Ask me for totals, rankings, comparisons or to explain an anomaly.`;
  const shown = [createMessage('assistant', welcome), ...messages];

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)] animate-fade-in">
      <div className="card !rounded-b-none p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center"><Brain className="h-5 w-5 text-white" /></div>
          <div><h2 className="text-base font-bold text-navy-900">AI Financial Copilot</h2>
            <p className="text-xs text-navy-400 flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${apiKey ? 'bg-success-500' : 'bg-brand-500'}`} />{apiKey ? `${settings.aiProvider === 'openai' ? 'OpenAI' : 'Groq'} LLM on live aggregates` : 'Local analyst engine'} · dataset: {activeDataset.name}</p></div>
        </div>
        <div className="flex items-center gap-2">
          {plan === 'starter' && <span className="badge-neutral">{copilotRemaining} questions left</span>}
          <button onClick={() => setShowKey(!showKey)} className="btn-ghost text-xs"><Zap className="h-4 w-4" />LLM key</button>
        </div>
      </div>
      {showKey && (
        <div className="card !rounded-none border-t-0 p-4 flex flex-wrap items-center gap-2">
          <select className="input-field !w-auto" value={settings.aiProvider} onChange={(e) => updateSettings({ aiProvider: e.target.value as 'openai' | 'groq' })}><option value="openai">OpenAI (gpt-4o-mini)</option><option value="groq">Groq (Llama 3.3)</option></select>
          <input type="password" className="input-field flex-1 min-w-[200px] font-mono" placeholder="API key (kept in this tab only)" value={apiKey} onChange={(e) => { setApiKey(e.target.value); try { sessionStorage.setItem('finsight:apikey', e.target.value); } catch { /* ignore */ } }} />
          <p className="text-[11px] text-navy-400 w-full">Optional. Only aggregated totals — not raw rows — are sent to the provider. Without a key the built-in engine answers offline.</p>
        </div>
      )}
      <div className="card !rounded-none border-t-0 flex-1 overflow-y-auto p-4 space-y-4">
        {shown.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${m.role === 'user' ? 'bg-navy-100 text-navy-600' : 'gradient-brand text-white'}`}>{m.role === 'user' ? <User className="h-4 w-4" /> : <Brain className="h-4 w-4" />}</div>
            <div className={`max-w-[80%] rounded-2xl p-3.5 ${m.role === 'user' ? 'bg-navy-900 text-white rounded-tr-sm' : 'bg-navy-50 text-navy-700 rounded-tl-sm border border-navy-100'}`}><RichText text={m.content} /></div>
          </div>
        ))}
        {loading && <div className="flex gap-3"><div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center"><Brain className="h-4 w-4 text-white" /></div><div className="bg-navy-50 rounded-2xl border border-navy-100 p-3 flex items-center gap-2"><Loader2 className="h-4 w-4 text-brand-600 animate-spin" /><span className="text-sm text-navy-400">Analysing…</span></div></div>}
        <div ref={endRef} />
      </div>
      {messages.length === 0 && (
        <div className="card !rounded-none border-t-0 px-4 pb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => <button key={s} onClick={() => send(s)} className="px-3 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-medium hover:bg-brand-100 flex items-center gap-1.5"><Sparkles className="h-3 w-3" />{s}</button>)}
        </div>
      )}
      <div className="card !rounded-t-none border-t-0 p-3 flex gap-2">
        <input className="input-field flex-1" value={input} disabled={loading} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={`Ask about ${activeDataset.name}…`} />
        <button onClick={() => send()} disabled={loading || !input.trim()} className="btn-primary !px-3 disabled:opacity-40"><Send className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
