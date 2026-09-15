import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Eye, FolderOpen, Globe2, LayoutDashboard, Loader2, Menu, Merge, Package, Search, Settings2, UploadCloud, Users, X } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

const logo = '/assets/logo.png';
const brandSuggestions = [
  'Rolex','Omega','Cartier','Patek Philippe','Audemars Piguet','Richard Mille','Hublot','Breitling','TAG Heuer',
  'Vacheron Constantin','Jaeger-LeCoultre','IWC','Panerai','Chanel','Hermès','Louis Vuitton','Dior','Gucci','Prada',
  'Saint Laurent','Bottega Veneta','Celine','Fendi','Balenciaga','Burberry','Valentino','Versace','Givenchy','Loewe',
  'Goyard','Miu Miu','Moncler','Loro Piana','Brunello Cucinelli','Giorgio Armani','Dolce & Gabbana','Tom Ford',
  'Balmain','Alexander McQueen','Jacquemus','Van Cleef & Arpels','Tiffany & Co.','Bvlgari',
];
const categories = ['clothing','footwear','watches','bags','accessories','eyewear','jewellery','wallets','belts','hats','scarves','other'];
const categoryLabel = (value:string) => ({ clothing:'Clothing', footwear:'Footwear', watches:'Watches', bags:'Bags', accessories:'Accessories', eyewear:'Eyewear', jewellery:'Jewellery', wallets:'Wallets & Small Leather Goods', belts:'Belts', hats:'Hats & Caps', scarves:'Scarves', other:'Other' } as Record<string,string>)[value] || value;

type ProductImage = { id:string; imagePath:string; isPrimary:boolean; sortOrder:number };
type Product = { id:string; collectionId:string; gender:'men'|'women'|'unknown'; category:string; brand?:string|null; reviewed:boolean; isActive:boolean; isPublished:boolean; images:ProductImage[] };
type Analytics = { periodDays:number; totalVisits:number; uniqueVisitors:number; todayVisits:number; whatsappClicks:number; productViews:number; refs:{ref:string;count:number}[]; recent:{createdAt:string;ref:string;path:string}[] };

function cleanErrorText(raw:string) {
  let message = raw || 'Request failed.';
  for (let i = 0; i < 2; i += 1) {
    try { const parsed = JSON.parse(message); message = parsed.error || parsed.message || parsed.details || message; } catch { break; }
  }
  if (message.includes('products_category_check')) return 'The database category list is still using the old setup. Run the new Supabase category migration once, then approve again.';
  if (message.includes('check constraint')) return 'A database rule rejected this product update. Check the selected brand, gender and category, then try again.';
  if (message.length > 180) return 'The server rejected this request. Refresh once and try again.';
  return message;
}

async function request<T>(path:string, token:string, init:RequestInit={}) {
  const response = await fetch(`/api${path}`, { ...init, headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...(init.headers||{}) } });
  if (!response.ok) throw new Error(cleanErrorText(await response.text()) || `Request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function imageFor(product:Product) { return product.images.find((i)=>i.isPrimary)?.imagePath || product.images[0]?.imagePath || '/assets/brand-board.png'; }
function formatDate(value:string) { return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }

function FastShell({ children, reviewCount=0 }:{ children:React.ReactNode; reviewCount?:number }) {
  const [open,setOpen]=useState(false); const [location]=useLocation();
  const nav = [
    ['/admin/dashboard','Overview',LayoutDashboard],['/admin/upload','Upload',UploadCloud],['/admin/review','Review',Eye],
    ['/admin/products','Products',Package],['/admin/collections','Collections',FolderOpen],['/admin/catalogue','Publish & Share',Globe2],['/admin/analytics','Analytics',BarChart3],['/admin/settings','Settings',Settings2],
  ] as const;
  return <div className="min-h-[100dvh] bg-[var(--lh-ivory)] text-[var(--lh-ink)]">
    <aside className={`fixed inset-y-0 left-0 z-50 w-[264px] bg-[var(--lh-burgundy)] px-5 py-6 text-[var(--lh-ivory-light)] transition-transform lg:translate-x-0 ${open?'translate-x-0':'-translate-x-full'}`}>
      <div className="flex items-center justify-between"><div className="rounded-xl bg-[var(--lh-ivory-light)] p-2"><img src={logo} alt="Luxe Horizon" className="h-8 w-auto" /></div><button onClick={()=>setOpen(false)} className="lg:hidden"><X size={20}/></button></div>
      <nav className="mt-8 space-y-1">{nav.map(([href,label,Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${location===href?'bg-white/10 text-[var(--lh-champagne)]':'text-white/75 hover:bg-white/5 hover:text-white'}`}><Icon size={17}/><span>{label}</span>{label==='Review'&&reviewCount>0&&<span className="ml-auto rounded-full bg-[var(--lh-champagne)] px-2 py-0.5 text-[10px] font-bold text-[var(--lh-burgundy)]">{reviewCount}</span>}</Link>)}</nav>
    </aside>
    <div className="lg:pl-[264px]"><header className="sticky top-0 z-40 flex h-[66px] items-center justify-between border-b border-[var(--lh-border)] bg-[color:var(--lh-ivory)]/95 px-5 backdrop-blur sm:px-8"><button onClick={()=>setOpen(true)} className="lg:hidden"><Menu size={21}/></button><span className="hidden text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--lh-muted-ink)] lg:block">Luxe Horizon Collection OS</span><Link href="/catalogue" className="text-xs font-semibold text-[var(--lh-burgundy)]">View catalogue</Link></header>{children}</div>
  </div>;
}

function AnalyticsPage({token}:{token:string}) {
  const [data,setData]=useState<Analytics|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setData(await request<Analytics>('/analytics',token));}catch(e){setError(e instanceof Error?e.message:'Could not load analytics.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[token]);
  if(loading)return <main className="mx-auto max-w-[1280px] px-5 py-10"><Loader2 className="animate-spin text-[var(--lh-burgundy)]"/></main>;
  return <FastShell><main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="lh-label">Audience</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Analytics</h1><p className="mt-2 max-w-xl text-sm text-[var(--lh-muted-ink)]">See how many visitors opened the public Luxe Horizon catalogue. Data shown for the last {data?.periodDays || 30} days.</p></div><button onClick={load} className="lh-secondary-action rounded-full px-4 py-2.5 text-xs font-semibold">Refresh</button></div>
    {error&&<div className="mb-4 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-4 py-3 text-xs text-[var(--lh-muted-ink)]">{error}</div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="rounded-2xl border border-[var(--lh-burgundy)] bg-[var(--lh-burgundy)] p-5 text-[var(--lh-ivory-light)]"><Users size={18} className="text-[var(--lh-champagne)]"/><p className="mt-5 text-[9px] font-semibold uppercase tracking-[.16em] text-white/55">Unique visitors</p><p className="mt-2 font-display text-4xl">{data?.uniqueVisitors||0}</p><p className="mt-2 text-xs text-white/50">Approx. unique browsers/devices</p></div>
      <div className="rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] p-5"><Eye size={18} className="text-[var(--lh-burgundy)]"/><p className="mt-5 text-[9px] font-semibold uppercase tracking-[.16em] text-[var(--lh-muted-ink)]">Total visits</p><p className="mt-2 font-display text-4xl">{data?.totalVisits||0}</p><p className="mt-2 text-xs text-[var(--lh-muted-ink)]">Catalogue opens</p></div>
      <div className="rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] p-5"><BarChart3 size={18} className="text-[var(--lh-burgundy)]"/><p className="mt-5 text-[9px] font-semibold uppercase tracking-[.16em] text-[var(--lh-muted-ink)]">Today</p><p className="mt-2 font-display text-4xl">{data?.todayVisits||0}</p><p className="mt-2 text-xs text-[var(--lh-muted-ink)]">Visits today</p></div>
      <div className="rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] p-5"><Globe2 size={18} className="text-[var(--lh-burgundy)]"/><p className="mt-5 text-[9px] font-semibold uppercase tracking-[.16em] text-[var(--lh-muted-ink)]">WhatsApp</p><p className="mt-2 font-display text-4xl">{data?.whatsappClicks||0}</p><p className="mt-2 text-xs text-[var(--lh-muted-ink)]">Enquiry clicks</p></div>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.9fr]">
      <section className="lh-panel rounded-2xl p-6 sm:p-7"><p className="lh-label">Link sources</p><h2 className="mt-2 font-display text-2xl">Where visits came from</h2><div className="mt-5 space-y-2">{(data?.refs||[]).map((item)=><div key={item.ref} className="flex items-center justify-between rounded-xl bg-[var(--lh-ivory)] px-4 py-3 text-sm"><span className="truncate pr-4">{item.ref}</span><strong>{item.count}</strong></div>)}{!(data?.refs||[]).length&&<p className="text-sm text-[var(--lh-muted-ink)]">No visits recorded yet.</p>}</div><p className="mt-5 text-xs leading-5 text-[var(--lh-muted-ink)]">If you later share links containing <strong>?ref=client-name</strong>, visits will be grouped under that reference.</p></section>
      <section className="rounded-2xl bg-[var(--lh-ivory-deep)] p-6 sm:p-7"><p className="lh-label">Recent visits</p><div className="mt-5 space-y-3">{(data?.recent||[]).slice(0,10).map((visit,index)=><div key={`${visit.createdAt}-${index}`} className="border-b border-[var(--lh-border)] pb-3 last:border-0"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{visit.ref}</span><span className="text-[10px] text-[var(--lh-muted-ink)]">{formatDate(visit.createdAt)}</span></div><p className="mt-1 truncate text-[10px] text-[var(--lh-muted-ink)]">{visit.path}</p></div>)}{!(data?.recent||[]).length&&<p className="text-sm text-[var(--lh-muted-ink)]">No visits recorded yet.</p>}</div></section>
    </div>
    <p className="mt-5 text-xs leading-5 text-[var(--lh-muted-ink)]">This tracker does not collect names, phone numbers, exact addresses or precise location. The unique visitor number is an approximate count of distinct browsers/devices that opened the catalogue.</p>
  </main></FastShell>;
}

function ReviewPage({token}:{token:string}) {
  const [items,setItems]=useState<Product[]>([]); const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const load=async()=>setItems(await request<Product[]>('/products?reviewed=false',token)); useEffect(()=>{void load();},[token]);
  const ready=items.filter((p)=>Boolean(p.brand?.trim())&&p.gender!=='unknown'&&p.category!=='other');
  const saveOne=async(p:Product)=>request(`/products/${p.id}/flexible`,token,{method:'PATCH',body:JSON.stringify({brand:p.brand||'',gender:p.gender,category:p.category,reviewed:true,isPublished:true})});
  const approveOne=async(p:Product)=>{setBusy(true);setMessage('');try{await saveOne(p);await load();setMessage('Approved and published.');}catch(e){setMessage(e instanceof Error?e.message:'Could not approve product.');}finally{setBusy(false)}};
  const approveAll=async()=>{if(!ready.length)return;setBusy(true);setMessage('');try{await Promise.all(ready.map(saveOne));await load();setMessage(`${ready.length} product${ready.length===1?'':'s'} approved and published.`);}catch(e){setMessage(e instanceof Error?e.message:'Bulk approval failed.');}finally{setBusy(false)}};
  return <FastShell reviewCount={items.length}><main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="lh-label">Workspace</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Review Queue</h1><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">Confirm the essentials once, then approve and publish in the same action.</p></div><button onClick={approveAll} disabled={busy||!ready.length} className="lh-primary-action rounded-full px-5 py-3 text-xs font-semibold disabled:opacity-40">{busy?'Working…':`Approve & publish all ready (${ready.length})`}</button></div>{message&&<div className="mb-4 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-4 py-3 text-xs text-[var(--lh-muted-ink)]">{message}</div>}{items.length===0?<div className="lh-panel rounded-2xl px-6 py-20 text-center"><CheckCircle2 className="mx-auto text-[var(--lh-burgundy)]"/><h2 className="mt-5 font-display text-3xl">Review queue is clear</h2><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">There are no pending products.</p></div>:<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((p)=><article key={p.id} className="lh-panel overflow-hidden rounded-2xl"><div className="aspect-[1.05] bg-[var(--lh-ivory-deep)]"><img src={imageFor(p)} alt="" className="h-full w-full object-cover"/></div><div className="p-5"><label className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--lh-burgundy)]">Brand</label><select value={p.brand||''} onChange={(e)=>setItems((all)=>all.map((x)=>x.id===p.id?{...x,brand:e.target.value}:x))} className="mt-2 h-11 w-full rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm"><option value="">Select brand</option>{brandSuggestions.map((b)=><option key={b} value={b}>{b}</option>)}</select><div className="mt-3 grid grid-cols-2 gap-2"><select value={p.gender} onChange={(e)=>setItems((all)=>all.map((x)=>x.id===p.id?{...x,gender:e.target.value as Product['gender']}:x))} className="h-11 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm"><option value="unknown">Select gender</option><option value="women">Women</option><option value="men">Men</option></select><select value={p.category} onChange={(e)=>setItems((all)=>all.map((x)=>x.id===p.id?{...x,category:e.target.value}:x))} className="h-11 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm">{categories.map((c)=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div><button onClick={()=>approveOne(p)} disabled={busy||!p.brand?.trim()||p.gender==='unknown'||p.category==='other'} className="lh-primary-action mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-xs font-semibold disabled:opacity-35"><CheckCircle2 size={15}/> Approve & publish</button></div></article>)}</div>}</main></FastShell>;
}

function ProductsPage({token}:{token:string}) {
  const [items,setItems]=useState<Product[]>([]); const [selected,setSelected]=useState<string[]>([]); const [busy,setBusy]=useState(false); const [search,setSearch]=useState(''); const [message,setMessage]=useState('');
  const load=async()=>setItems(await request<Product[]>('/products',token)); useEffect(()=>{void load();},[token]);
  const filtered=useMemo(()=>items.filter((p)=>!search||(p.brand||'').toLowerCase().includes(search.toLowerCase())),[items,search]);
  const toggle=(id:string)=>setSelected((ids)=>ids.includes(id)?ids.filter((x)=>x!==id):[...ids,id]);
  const merge=async()=>{if(selected.length<2)return;setBusy(true);setMessage('');try{await request('/products/merge',token,{method:'POST',body:JSON.stringify({productIds:selected})});setSelected([]);await load();setMessage('Selected angles are now grouped under one product.');}catch(e){setMessage(e instanceof Error?e.message:'Merge failed.');}finally{setBusy(false)}};
  const publishAll=async()=>{const ids=items.filter((p)=>p.reviewed&&!p.isPublished&&p.brand&&p.gender!=='unknown'&&p.category!=='other').map((p)=>p.id);if(!ids.length)return;setBusy(true);try{await request('/products/bulk-update',token,{method:'POST',body:JSON.stringify({ids,isPublished:true})});await load();setMessage(`${ids.length} ready product${ids.length===1?'':'s'} published.`);}catch(e){setMessage(e instanceof Error?e.message:'Publish failed.');}finally{setBusy(false)}};
  return <FastShell><main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:py-10"><div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="lh-label">Catalogue</p><h1 className="mt-2 font-display text-4xl sm:text-5xl">Products</h1><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">Manage products, group multiple angles and publish ready items in bulk.</p></div><div className="flex flex-wrap gap-2"><button onClick={merge} disabled={busy||selected.length<2} className="lh-secondary-action inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold disabled:opacity-40"><Merge size={14}/> Merge selected ({selected.length})</button><button onClick={publishAll} disabled={busy} className="lh-primary-action rounded-full px-4 py-2.5 text-xs font-semibold">Publish all ready</button></div></div>{message&&<div className="mb-4 rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-4 py-3 text-xs text-[var(--lh-muted-ink)]">{message}</div>}<label className="relative mb-4 block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lh-muted-ink)]" size={16}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search brand" className="h-11 w-full rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] pl-10 pr-3 text-sm"/></label><div className="overflow-hidden rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)]">{filtered.map((p)=><div key={p.id} className="grid grid-cols-[28px_62px_1fr_auto] items-center gap-3 border-b border-[var(--lh-border)] p-3 last:border-0"><input type="checkbox" checked={selected.includes(p.id)} onChange={()=>toggle(p.id)} className="h-4 w-4 accent-[var(--lh-burgundy)]"/><img src={imageFor(p)} alt="" className="h-16 w-16 rounded-xl object-cover"/><div className="min-w-0"><p className="truncate text-sm font-semibold">{p.brand||'Brand not set'}</p><p className="mt-1 text-[11px] text-[var(--lh-muted-ink)]">{p.gender} · {categoryLabel(p.category)} · {p.images.length} image{p.images.length===1?'':'s'}</p></div><span className={`rounded-full px-3 py-2 text-[10px] font-semibold ${p.isPublished?'border border-[var(--lh-border)]':'bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)]'}`}>{p.isPublished?'Published':'Draft'}</span></div>)}</div><p className="mt-4 text-xs leading-5 text-[var(--lh-muted-ink)]">For several photos of the same item, select those rows and use “Merge selected”. Future uploads can also use “Selected images = one product” so all angles stay under one product from the start.</p></main></FastShell>;
}

export default function AdminFastPages(){
  const [token,setToken]=useState<string|null>(null); const [ready,setReady]=useState(false);
  useEffect(()=>{if(!supabase){setReady(true);return;}let mounted=true;void supabase.auth.getSession().then(({data})=>{if(mounted){setToken(data.session?.access_token||null);setReady(true)}});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setToken(s?.access_token||null));return()=>{mounted=false;data.subscription.unsubscribe();};},[]);
  if(!ready)return <div className="flex min-h-screen items-center justify-center bg-[var(--lh-ivory)]"><Loader2 className="animate-spin text-[var(--lh-burgundy)]"/></div>;
  if(!token){window.location.href='/admin';return null;}
  const path=window.location.pathname;
  if(path==='/admin/review')return <ReviewPage token={token}/>;
  if(path==='/admin/analytics')return <AnalyticsPage token={token}/>;
  return <ProductsPage token={token}/>;
}
