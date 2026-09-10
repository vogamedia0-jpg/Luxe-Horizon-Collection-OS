import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, ChevronRight, CloudUpload, Download, Eye, FolderOpen, Globe2, LayoutDashboard,
  Loader2, LogOut, Menu, Package, Plus, Search, Settings2, Sparkles, Trash2, UploadCloud, X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { generateBrandedCataloguePdf } from '@/lib/pdf';

const logo = '/assets/logo.png';
const bucket = 'product-images';
const brandSuggestions = [
  'Rolex', 'Hermès', 'Chanel', 'Louis Vuitton', 'Cartier', 'Saint Laurent', 'Prada', 'Gucci',
  'Bottega Veneta', 'Dior', 'Fendi', 'Celine', 'Loewe', 'Balenciaga', 'Valentino', 'Burberry',
  'Loro Piana', 'Brunello Cucinelli', 'Moncler', 'Tom Ford', 'Giorgio Armani', 'Versace',
  'Givenchy', 'Dolce & Gabbana', 'Alexander McQueen', 'Miu Miu', 'Van Cleef & Arpels',
  'Tiffany & Co.', 'Bvlgari', 'Patek Philippe', 'Audemars Piguet', 'Omega', 'Richard Mille',
  'Vacheron Constantin', 'Jaeger-LeCoultre', 'IWC', 'Hublot', 'Panerai', 'Tag Heuer',
];
const categories = [
  'clothing', 'footwear', 'watches', 'bags', 'accessories', 'eyewear', 'jewellery',
  'wallets', 'belts', 'hats', 'scarves', 'other',
] as const;
const categoryLabel = (value: string) => ({
  clothing: 'Clothing', footwear: 'Footwear', watches: 'Watches', bags: 'Bags', accessories: 'Accessories',
  eyewear: 'Eyewear', jewellery: 'Jewellery', wallets: 'Wallets & Small Leather Goods', belts: 'Belts',
  hats: 'Hats & Caps', scarves: 'Scarves', other: 'Other',
}[value] || value.replace(/(^|\s)\w/g, (m) => m.toUpperCase()));

type Collection = {
  id: string; name: string; slug: string; startDate?: string | null; endDate?: string | null;
  isPublished: boolean; publishedAt?: string | null; createdAt: string; updatedAt: string;
};
type ProductImage = { id: string; imagePath: string; isPrimary: boolean; sortOrder: number };
type Product = {
  id: string; collectionId: string; gender: 'men' | 'women' | 'unknown'; category: string;
  brand?: string | null; aiGender?: string | null; aiCategory?: string | null; aiBrand?: string | null;
  aiConfidence?: number | null; reviewed: boolean; isActive: boolean; isPublished: boolean; sortOrder: number;
  images: ProductImage[];
};
type Dashboard = {
  collection: Collection | null; totalUploaded: number; men: number; women: number; unknown: number;
  needsReview: number; published: number; categories: Record<string, number>;
};
type SessionState = { ready: boolean; token: string | null };

const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
  : '—';
const imageFor = (product: Product) => product.images.find((image) => image.isPrimary)?.imagePath || product.images[0]?.imagePath || '/assets/brand-board.png';

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed (${response.status})`);
  if (response.status === 204) return undefined as T;
  return response.json();
}

function Logo({ light = false }: { light?: boolean }) {
  return <img src={logo} alt="Luxe Horizon" className={`h-9 w-auto object-contain ${light ? 'brightness-0 invert opacity-95' : ''}`} />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!supabase) return; setPending(true); setError(''); setNotice('');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError('Email or password was not accepted.');
    setPending(false);
  };
  const recover = async () => {
    if (!supabase) return;
    if (!email.trim()) { setError('Enter your admin email first.'); return; }
    setRecoveryPending(true); setError(''); setNotice('');
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin?recovery=1`,
    });
    if (recoveryError) setError(recoveryError.message || 'Password recovery email could not be sent.');
    else setNotice('Password recovery email sent. Open the email and follow the secure link to set a new password.');
    setRecoveryPending(false);
  };
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--lh-burgundy-deep)] px-5 text-[var(--lh-ivory-light)] noise">
    <form onSubmit={submit} className="w-full max-w-[420px] rounded-[20px] border border-white/10 bg-white/[.055] p-7 shadow-2xl sm:p-9">
      <Logo light />
      <p className="mt-10 lh-label !text-[var(--lh-champagne)]">Private operations</p>
      <h1 className="mt-3 font-display text-4xl tracking-[-.03em]">Admin sign in</h1>
      <p className="mt-2 text-sm text-white/55">Manage collections, products and publishing.</p>
      <label className="mt-8 block text-xs font-semibold">Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[var(--lh-champagne)]" /></label>
      <label className="mt-4 block text-xs font-semibold">Password<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[var(--lh-champagne)]" /></label>
      <button type="button" onClick={recover} disabled={recoveryPending} className="mt-3 text-xs font-semibold text-[var(--lh-champagne)] underline-offset-4 hover:underline disabled:opacity-50">{recoveryPending ? 'Sending recovery email…' : 'Forgot password?'}</button>
      {error && <p className="mt-3 text-xs text-[#efb1a5]">{error}</p>}
      {notice && <p className="mt-3 text-xs leading-5 text-[#eed8a8]">{notice}</p>}
      <button disabled={pending} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--lh-champagne)] text-xs font-semibold text-[var(--lh-burgundy-deep)] disabled:opacity-50">{pending && <Loader2 size={14} className="animate-spin" />} Sign in</button>
    </form>
  </div>;
}

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setPending(true); setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (updateError) { setError(updateError.message || 'Password could not be updated.'); return; }
    window.history.replaceState({}, '', '/admin');
    window.location.reload();
  };
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--lh-burgundy-deep)] px-5 text-[var(--lh-ivory-light)] noise">
    <form onSubmit={submit} className="w-full max-w-[420px] rounded-[20px] border border-white/10 bg-white/[.055] p-7 shadow-2xl sm:p-9">
      <Logo light />
      <p className="mt-10 lh-label !text-[var(--lh-champagne)]">Secure recovery</p>
      <h1 className="mt-3 font-display text-4xl tracking-[-.03em]">Set new password</h1>
      <p className="mt-2 text-sm text-white/55">Choose a new password for Luxe Horizon Admin.</p>
      <label className="mt-8 block text-xs font-semibold">New password<input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[var(--lh-champagne)]" /></label>
      <label className="mt-4 block text-xs font-semibold">Confirm password<input type="password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/15 bg-black/10 px-3 text-sm outline-none focus:border-[var(--lh-champagne)]" /></label>
      {error && <p className="mt-3 text-xs text-[#efb1a5]">{error}</p>}
      <button disabled={pending} className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--lh-champagne)] text-xs font-semibold text-[var(--lh-burgundy-deep)] disabled:opacity-50">{pending && <Loader2 size={14} className="animate-spin" />} Set new password</button>
    </form>
  </div>;
}

function useAdminSession(): SessionState {
  const [state, setState] = useState<SessionState>({ ready: !isSupabaseConfigured, token: null });
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => mounted && setState({ ready: true, token: data.session?.access_token || null }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ ready: true, token: session?.access_token || null }));
    return () => { mounted = false; data.subscription.unsubscribe(); };
  }, []);
  return state;
}

const nav = [
  ['/admin/dashboard', 'Overview', LayoutDashboard], ['/admin/upload', 'Upload', CloudUpload], ['/admin/review', 'Review', Eye],
  ['/admin/products', 'Products', Package], ['/admin/collections', 'Collections', FolderOpen], ['/admin/catalogue', 'Publish & Share', Globe2],
] as const;

function Shell({ children, reviewCount = 0, activeCollection }: { children: React.ReactNode; reviewCount?: number; activeCollection?: Collection | null }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-[var(--lh-ivory)] noise">
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-[var(--lh-burgundy-deep)] px-5 py-6 text-[var(--lh-ivory-light)] transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2"><Logo light /><button className="lg:hidden" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <div className="mt-8 rounded-xl border border-white/10 bg-white/[.055] p-3.5">
        <p className="lh-label !text-[var(--lh-champagne)]">Current collection</p>
        <p className="mt-2 font-display text-[17px] leading-tight">{activeCollection?.name || 'No collection yet'}</p>
        <p className="mt-2 text-[10px] text-white/48">{activeCollection ? (activeCollection.isPublished ? `Published ${formatDate(activeCollection.publishedAt)}` : 'Draft') : 'Create your first collection'}</p>
      </div>
      <nav className="mt-7 flex-1 space-y-1">{nav.map(([href, label, Icon]) => <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] transition ${location === href ? 'bg-white/[.11] text-[var(--lh-champagne)]' : 'text-white/68 hover:bg-white/[.06] hover:text-white'}`}><Icon size={16} /><span>{label}</span>{label === 'Review' && reviewCount > 0 && <span className="ml-auto rounded-full bg-[var(--lh-champagne)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--lh-burgundy-deep)]">{reviewCount}</span>}</Link>)}</nav>
      <div className="border-t border-white/10 pt-4">
        <Link href="/admin/settings" className={`flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] ${location === '/admin/settings' ? 'bg-white/[.11] text-[var(--lh-champagne)]' : 'text-white/68 hover:text-white'}`}><Settings2 size={16} /> Settings</Link>
        <button onClick={() => supabase?.auth.signOut()} className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-3 text-[13px] text-white/55 hover:bg-white/[.06] hover:text-white"><LogOut size={16} /> Sign out</button>
      </div>
    </aside>
    <div className="lg:pl-[264px]">
      <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-[var(--lh-border)] bg-[rgba(243,238,230,.94)] px-5 backdrop-blur-xl sm:px-8">
        <button className="lg:hidden" onClick={() => setOpen(true)}><Menu size={20} /></button>
        <div className="hidden font-mono-ui text-[9px] uppercase tracking-[.18em] text-[var(--lh-muted-ink)] lg:block">Luxe Horizon Collection OS</div>
        <Link href="/catalogue" className="text-xs font-semibold text-[var(--lh-burgundy)]">View catalogue</Link>
      </header>
      <main>{children}</main>
    </div>
  </div>;
}

function Intro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="lh-label">{eyebrow}</p><h1 className="mt-2 font-display text-4xl tracking-[-.035em] text-[var(--lh-ink)] sm:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--lh-muted-ink)]">{description}</p></div>{action}</div>;
}
function Page({ children }: { children: React.ReactNode }) { return <div className="mx-auto max-w-[1380px] px-5 py-8 sm:px-8 lg:px-10 lg:py-11">{children}</div>; }
function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`lh-panel rounded-2xl ${className}`}>{children}</section>; }
function Stat({ label, value, detail, accent = false }: { label: string; value: number; detail: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-5 ${accent ? 'border-[var(--lh-burgundy)] bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)]' : 'border-[var(--lh-border)] bg-[var(--lh-ivory-light)]'}`}><p className={`font-mono-ui text-[9px] uppercase tracking-[.15em] ${accent ? 'text-white/60' : 'text-[var(--lh-muted-ink)]'}`}>{label}</p><p className="mt-3 font-display text-4xl">{value}</p><p className={`mt-2 text-xs ${accent ? 'text-white/55' : 'text-[var(--lh-muted-ink)]'}`}>{detail}</p></div>;
}
function Count({ label, value }: { label: string; value: number }) { return <div><p className="font-mono-ui text-[9px] uppercase text-[var(--lh-muted-ink)]">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>; }
function Quick({ href, label }: { href: string; label: string }) { return <Link href={href} className="flex items-center justify-between rounded-xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-4 py-4 text-sm font-semibold text-[var(--lh-ink)] transition hover:border-[var(--lh-burgundy)]/40">{label}<ChevronRight size={15} /></Link>; }
function Empty({ title, text }: { title: string; text: string }) { return <Panel className="px-6 py-20 text-center"><CheckCircle2 className="mx-auto text-[var(--lh-burgundy)]" /><h2 className="mt-4 font-display text-2xl">{title}</h2><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">{text}</p></Panel>; }

function DashboardPage({ token }: { token: string }) {
  const [data, setData] = useState<Dashboard | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { void api<Dashboard>('/dashboard', token).then(setData).finally(() => setLoading(false)); }, [token]);
  const total = data?.totalUploaded || 0;
  if (loading) return <Page><Loader2 className="animate-spin text-[var(--lh-burgundy)]" /></Page>;
  return <Page>
    <Intro eyebrow="Operations" title="Catalogue Overview" description="Current collection status, review progress and publishing activity." action={<Link href="/admin/upload" className="lh-primary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-semibold"><Plus size={15} /> Upload products</Link>} />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Total products" value={total} detail="Current collection" accent /><Stat label="Needs review" value={data?.needsReview || 0} detail="Pending confirmation" /><Stat label="Published" value={data?.published || 0} detail={`${Math.round(((data?.published || 0) / Math.max(total, 1)) * 100)}% of current collection`} /><Stat label="Unsorted" value={data?.unknown || 0} detail="Gender not confirmed" /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
      <Panel className="p-6 sm:p-8"><p className="lh-label">Current collection</p><h2 className="mt-3 font-display text-3xl tracking-[-.025em]">{data?.collection?.name || 'No collection created'}</h2><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">{data?.collection ? (data.collection.isPublished ? `Published ${formatDate(data.collection.publishedAt)}` : 'Draft — publish whenever you are ready') : 'Create a collection to begin.'}</p><div className="mt-8 grid grid-cols-3 gap-3 border-t border-[var(--lh-border)] pt-5"><Count label="Men" value={data?.men || 0} /><Count label="Women" value={data?.women || 0} /><Count label="Unknown" value={data?.unknown || 0} /></div></Panel>
      <section className="rounded-2xl bg-[var(--lh-ivory-deep)] p-6 sm:p-8"><p className="lh-label">Quick actions</p><div className="mt-5 space-y-2"><Quick href="/admin/review" label="Review pending items" /><Quick href="/admin/collections" label="Manage collections" /><Quick href="/admin/catalogue" label="Publish & share" /></div></section>
    </div>
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
      <Panel className="p-6"><p className="lh-label">Category mix</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{Object.entries(data?.categories || {}).map(([name, value]) => <div key={name} className="flex items-center justify-between rounded-xl bg-[var(--lh-ivory)] px-4 py-3 text-sm"><span>{categoryLabel(name)}</span><strong>{value}</strong></div>)}{Object.keys(data?.categories || {}).length === 0 && <p className="text-sm text-[var(--lh-muted-ink)]">No products yet.</p>}</div></Panel>
      <section className="rounded-2xl bg-[var(--lh-burgundy)] p-6 text-[var(--lh-ivory-light)] sm:p-8"><p className="lh-label !text-[var(--lh-champagne)]">Recent activity</p><div className="mt-5 space-y-4 text-sm"><div className="border-b border-white/10 pb-4"><p className="font-semibold">Current catalogue</p><p className="mt-1 text-white/55">{data?.published || 0} published products</p></div><div><p className="font-semibold">Review queue</p><p className="mt-1 text-white/55">{data?.needsReview || 0} products waiting for confirmation</p></div></div></section>
    </div>
  </Page>;
}

function UploadPage({ token, collections, reload }: { token: string; collections: Collection[]; reload: () => void }) {
  const [files, setFiles] = useState<File[]>([]); const [collectionId, setCollectionId] = useState(collections[0]?.id || '');
  const [hint, setHint] = useState<'mixed' | 'men' | 'women'>('mixed'); const [groupMode, setGroupMode] = useState<'individual' | 'one-product'>('individual');
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  useEffect(() => { if (!collectionId && collections[0]) setCollectionId(collections[0].id); }, [collections, collectionId]);
  const submit = async () => {
    if (!supabase || !collectionId || !files.length) return;
    setBusy(true); setMessage('');
    try {
      const paths: string[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').toLowerCase();
        const path = `${collectionId}/${crypto.randomUUID()}-${safe}`;
        const uploaded = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (uploaded.error) throw uploaded.error;
        paths.push(path);
      }
      if (groupMode === 'one-product') {
        await api('/products/upload-grouped', token, { method: 'POST', body: JSON.stringify({ collectionId, batchHint: hint, groups: [{ imagePaths: paths }] }) });
        setMessage(`1 product uploaded with ${paths.length} image${paths.length === 1 ? '' : 's'}.`);
      } else {
        await api('/products/upload', token, { method: 'POST', body: JSON.stringify({ collectionId, batchHint: hint, images: paths.map((imagePath) => ({ imagePath })) }) });
        setMessage(`${paths.length} product${paths.length === 1 ? '' : 's'} uploaded to the review queue.`);
      }
      setFiles([]); reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Upload failed.'); }
    setBusy(false);
  };
  return <Page><Intro eyebrow="Workspace" title="Upload Products" description="Upload whenever new arrivals are ready. Nothing becomes public until you review and publish it." />
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
      <Panel className="p-6 sm:p-8"><label className="block text-xs font-semibold">Collection<select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm">{collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <div className="mt-5"><p className="text-xs font-semibold">Batch hint</p><div className="mt-2 grid grid-cols-3 gap-2">{(['mixed','men','women'] as const).map((item) => <button key={item} onClick={() => setHint(item)} className={`rounded-lg border px-3 py-3 text-xs font-semibold capitalize ${hint === item ? 'border-[var(--lh-burgundy)] bg-[rgba(100,37,54,.06)] text-[var(--lh-burgundy)]' : 'border-[var(--lh-border)]'}`}>{item}</button>)}</div></div>
        <div className="mt-5"><p className="text-xs font-semibold">Image grouping</p><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setGroupMode('individual')} className={`rounded-lg border px-3 py-3 text-xs font-semibold ${groupMode === 'individual' ? 'border-[var(--lh-burgundy)] bg-[rgba(100,37,54,.06)] text-[var(--lh-burgundy)]' : 'border-[var(--lh-border)]'}`}>Each image = one product</button><button onClick={() => setGroupMode('one-product')} className={`rounded-lg border px-3 py-3 text-xs font-semibold ${groupMode === 'one-product' ? 'border-[var(--lh-burgundy)] bg-[rgba(100,37,54,.06)] text-[var(--lh-burgundy)]' : 'border-[var(--lh-border)]'}`}>Selected images = one product</button></div></div>
        <label className="mt-6 flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[var(--lh-border)] bg-[var(--lh-ivory)] px-6 text-center"><UploadCloud size={28} className="text-[var(--lh-burgundy)]" /><span className="mt-3 font-display text-2xl">Drop product images here</span><span className="mt-2 text-xs text-[var(--lh-muted-ink)]">JPG, PNG or WEBP</span><input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} /></label>
        {files.length > 0 && <div className="mt-4 text-xs text-[var(--lh-muted-ink)]">{files.length} file{files.length === 1 ? '' : 's'} selected</div>}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--lh-border)] pt-5"><p className="max-w-[65%] text-xs text-[var(--lh-muted-ink)]">{message}</p><button disabled={busy || !files.length || !collectionId} onClick={submit} className="lh-primary-action inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-semibold disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <CloudUpload size={14} />} Upload</button></div>
      </Panel>
      <section className="rounded-2xl bg-[var(--lh-burgundy)] p-7 text-[var(--lh-ivory-light)]"><Sparkles size={18} className="text-[var(--lh-champagne)]" /><h2 className="mt-5 font-display text-3xl">AI-assisted review</h2><p className="mt-3 text-sm leading-6 text-white/60">AI can suggest gender, category and brand. Low-confidence products remain in your review queue so you keep final control.</p><div className="mt-7 border-t border-white/10 pt-5 text-xs leading-6 text-white/65">Nothing is published automatically.</div></section>
    </div>
  </Page>;
}

function ReviewPage({ token, reload }: { token: string; reload: () => void }) {
  const [items, setItems] = useState<Product[]>([]); const [busy, setBusy] = useState('');
  const load = () => api<Product[]>('/products?reviewed=false', token).then(setItems);
  useEffect(() => { void load(); }, [token]);
  const approve = async (product: Product) => { setBusy(product.id); await api(`/products/${product.id}/flexible`, token, { method: 'PATCH', body: JSON.stringify({ reviewed: true, gender: product.gender, category: product.category, brand: product.brand || null }) }); await load(); reload(); setBusy(''); };
  return <Page><Intro eyebrow="Workspace" title="Review Queue" description="Confirm brand, gender and category before a product becomes catalogue-ready." action={<Link href="/admin/products" className="lh-secondary-action rounded-full px-4 py-2.5 text-xs font-semibold">All products</Link>} />
    {items.length === 0 ? <Empty title="Review queue is clear" text="There are no pending products." /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map((product) => <article key={product.id} className="lh-panel overflow-hidden rounded-2xl"><div className="aspect-[1.05] bg-[var(--lh-ivory-deep)]"><img src={imageFor(product)} alt="" className="h-full w-full object-cover" /></div><div className="p-5"><div className="mb-4 flex items-center justify-between"><span className="lh-label">AI confidence</span><span className="text-xs font-semibold text-[var(--lh-burgundy)]">{product.aiConfidence != null ? `${Math.round(product.aiConfidence * 100)}%` : '—'}</span></div><input list="brand-suggestions" value={product.brand || ''} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, brand: e.target.value } : p))} placeholder={product.aiBrand || 'Brand'} className="h-10 w-full rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><select value={product.gender} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, gender: e.target.value as Product['gender'] } : p))} className="h-10 rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-2 text-xs"><option value="unknown">Unknown</option><option value="women">Women</option><option value="men">Men</option></select><select value={product.category} onChange={(e) => setItems((all) => all.map((p) => p.id === product.id ? { ...p, category: e.target.value } : p))} className="h-10 rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-2 text-xs">{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select></div><p className="mt-3 text-[10px] text-[var(--lh-muted-ink)]">Suggested: {product.aiBrand || '—'} · {product.aiGender || '—'} · {product.aiCategory ? categoryLabel(product.aiCategory) : '—'}</p><button onClick={() => approve(product)} disabled={busy === product.id} className="lh-primary-action mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold">{busy === product.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve</button></div></article>)}</div>}
    <datalist id="brand-suggestions">{brandSuggestions.map((brand) => <option key={brand} value={brand} />)}</datalist>
  </Page>;
}

function ProductsPage({ token, reload, collections }: { token: string; reload: () => void; collections: Collection[] }) {
  const [items, setItems] = useState<Product[]>([]); const [busy, setBusy] = useState(''); const [search, setSearch] = useState('');
  const [gender, setGender] = useState('all'); const [category, setCategory] = useState('all'); const [status, setStatus] = useState('all');
  const load = () => api<Product[]>('/products', token).then(setItems);
  useEffect(() => { void load(); }, [token]);
  const filtered = useMemo(() => items.filter((p) => (!search || (p.brand || '').toLowerCase().includes(search.toLowerCase())) && (gender === 'all' || p.gender === gender) && (category === 'all' || p.category === category) && (status === 'all' || (status === 'published' ? p.isPublished : status === 'draft' ? !p.isPublished : status === 'review' ? !p.reviewed : true))), [items, search, gender, category, status]);
  const patch = async (id: string, data: object) => { setBusy(id); await api(`/products/${id}/flexible`, token, { method: 'PATCH', body: JSON.stringify(data) }); await load(); reload(); setBusy(''); };
  const remove = async (id: string) => { if (!window.confirm('Delete this product?')) return; setBusy(id); await api(`/products/${id}`, token, { method: 'DELETE' }); await load(); reload(); setBusy(''); };
  return <Page><Intro eyebrow="Catalogue" title="Products" description="Search, filter, publish and manage all products from one place." />
    <Panel className="mb-4 p-3"><div className="flex flex-wrap gap-2"><label className="relative min-w-[210px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--lh-muted-ink)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brand" className="h-10 w-full rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] pl-9 pr-3 text-xs" /></label><select value={gender} onChange={(e) => setGender(e.target.value)} className="h-10 rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-xs"><option value="all">All genders</option><option value="women">Women</option><option value="men">Men</option><option value="unknown">Unknown</option></select><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-xs"><option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select><select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-xs"><option value="all">All states</option><option value="published">Published</option><option value="draft">Draft</option><option value="review">Needs review</option></select></div></Panel>
    {filtered.length === 0 ? <Empty title="No products found" text={items.length ? 'Try another search or filter.' : 'Upload the first product batch to begin.'} /> : <div className="overflow-hidden rounded-2xl border border-[var(--lh-border)] bg-[var(--lh-ivory-light)]">{filtered.map((product) => <div key={product.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-[var(--lh-border)] p-3 last:border-0 sm:grid-cols-[64px_1fr_110px_110px_120px]"><img src={imageFor(product)} alt="" className="h-14 w-14 rounded-lg object-cover" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{product.brand || 'Brand not set'}</p><p className="mt-1 text-[10px] text-[var(--lh-muted-ink)]">{product.gender} · {categoryLabel(product.category)}</p></div><span className="hidden text-xs sm:block">{product.reviewed ? 'Reviewed' : 'Pending'}</span><span className="hidden text-xs sm:block">{product.isPublished ? 'Published' : 'Draft'}</span><div className="flex items-center justify-end gap-2"><button disabled={!product.reviewed || busy === product.id} onClick={() => patch(product.id, { isPublished: !product.isPublished })} className={`rounded-full px-3 py-2 text-[10px] font-semibold disabled:opacity-35 ${product.isPublished ? 'border border-[var(--lh-border)]' : 'bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)]'}`}>{product.isPublished ? 'Unpublish' : 'Publish'}</button><button onClick={() => remove(product.id)} className="rounded-full p-2 text-[hsl(var(--destructive))]"><Trash2 size={14} /></button></div></div>)}</div>}
  </Page>;
}

function CollectionsPage({ token, collections, reload }: { token: string; collections: Collection[]; reload: () => void }) {
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false);
  const create = async () => { if (!name.trim()) return; setBusy(true); const slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-5)}`; await api('/collections', token, { method: 'POST', body: JSON.stringify({ name: name.trim(), slug, startDate: null, endDate: null }) }); setName(''); reload(); setBusy(false); };
  const publish = async (collection: Collection) => { await api(`/collections/${collection.id}`, token, { method: 'PATCH', body: JSON.stringify({ isPublished: !collection.isPublished }) }); reload(); };
  return <Page><Intro eyebrow="Catalogue" title="Collections" description="Create a new collection whenever you are ready. Publishing it sets the client-facing update date." />
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><Panel className="p-6"><p className="lh-label">Create</p><h2 className="mt-2 font-display text-2xl">New collection</h2><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" className="mt-5 h-11 w-full rounded-lg border border-[var(--lh-border)] bg-[var(--lh-ivory-light)] px-3 text-sm" /><button disabled={busy || !name.trim()} onClick={create} className="lh-primary-action mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold disabled:opacity-40"><Plus size={14} /> Create</button></Panel>
      <Panel className="overflow-hidden">{collections.length === 0 ? <div className="p-6 text-sm text-[var(--lh-muted-ink)]">No collections yet.</div> : collections.map((collection) => <div key={collection.id} className="flex items-center justify-between gap-4 border-b border-[var(--lh-border)] p-5 last:border-0"><div><p className="font-display text-xl">{collection.name}</p><p className="mt-1 text-xs text-[var(--lh-muted-ink)]">{collection.isPublished ? `Published ${formatDate(collection.publishedAt)}` : `Created ${formatDate(collection.createdAt)}`}</p></div><button onClick={() => publish(collection)} className={`rounded-full px-4 py-2 text-xs font-semibold ${collection.isPublished ? 'bg-[var(--lh-burgundy)] text-[var(--lh-ivory-light)]' : 'border border-[var(--lh-border)]'}`}>{collection.isPublished ? 'Published' : 'Publish'}</button></div>)}</Panel>
    </div>
  </Page>;
}

function PublishPage({ token, dashboard }: { token: string; dashboard: Dashboard | null }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const copy = async () => { await navigator.clipboard.writeText(`${window.location.origin}/catalogue`); setMessage('Catalogue link copied.'); };
  const generatePdf = async () => {
    setBusy(true); setMessage('');
    try {
      const products = await api<Product[]>('/products?published=true', token);
      const activeProducts = products.filter((p) => p.isPublished && p.isActive && (!dashboard?.collection?.id || p.collectionId === dashboard.collection.id));
      const title = dashboard?.collection?.name || 'Luxe Horizon Catalogue';
      await generateBrandedCataloguePdf(title, activeProducts, (path) => path || '/assets/brand-board.png');
      setMessage('PDF generated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'PDF generation failed.'); }
    setBusy(false);
  };
  return <Page><Intro eyebrow="Catalogue" title="Publish & Share" description="View the live catalogue, copy its link or generate a PDF of the currently published collection." />
    <section className="overflow-hidden rounded-2xl bg-[var(--lh-burgundy-deep)] text-[var(--lh-ivory-light)]"><div className="grid md:grid-cols-[1fr_.8fr]"><div className="p-7 sm:p-10"><p className="lh-label !text-[var(--lh-champagne)]">Public catalogue</p><h2 className="mt-4 font-display text-4xl">{dashboard?.collection?.name || 'No collection published'}</h2><p className="mt-3 text-sm text-white/55">{dashboard?.published || 0} products currently published.</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/catalogue" className="rounded-full bg-[var(--lh-champagne)] px-5 py-3 text-xs font-semibold text-[var(--lh-burgundy-deep)]">View catalogue</Link><button onClick={copy} className="rounded-full border border-white/20 px-5 py-3 text-xs font-semibold">Copy link</button><button onClick={generatePdf} disabled={busy || !dashboard?.published} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-xs font-semibold disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Generate PDF</button></div>{message && <p className="mt-4 text-xs text-white/55">{message}</p>}</div><img src="/assets/brand-board.png" alt="Luxe Horizon brand materials" className="min-h-[260px] h-full w-full object-cover opacity-70" /></div></section>
  </Page>;
}

function SettingsPage() { return <Page><Intro eyebrow="Settings" title="Configuration" description="Account and deployment settings for Luxe Horizon." /><Panel className="p-6 sm:p-8"><p className="lh-label">Customer enquiries</p><h2 className="mt-2 font-display text-2xl">WhatsApp</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--lh-muted-ink)]">The customer enquiry number is configured through <strong>VITE_LUXE_HORIZON_WHATSAPP</strong>.</p><div className="mt-8 border-t border-[var(--lh-border)] pt-7"><p className="lh-label">Data & storage</p><h2 className="mt-2 font-display text-2xl">Supabase</h2><p className="mt-2 text-sm text-[var(--lh-muted-ink)]">Authentication, catalogue data and private product images use the existing Luxe Horizon Supabase project.</p></div></Panel></Page>; }

function AdminRoutes({ token }: { token: string }) {
  const [collections, setCollections] = useState<Collection[]>([]); const [dashboard, setDashboard] = useState<Dashboard | null>(null); const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);
  useEffect(() => { void Promise.all([api<Collection[]>('/collections', token), api<Dashboard>('/dashboard', token)]).then(([c,d]) => { setCollections(c); setDashboard(d); }); }, [token, version]);
  const active = dashboard?.collection || collections.find((c) => c.isPublished) || collections[0] || null;
  return <Shell reviewCount={dashboard?.needsReview || 0} activeCollection={active}><Switch>
    <Route path="/admin/dashboard">{() => <DashboardPage token={token} />}</Route>
    <Route path="/admin/upload">{() => <UploadPage token={token} collections={collections} reload={reload} />}</Route>
    <Route path="/admin/review">{() => <ReviewPage token={token} reload={reload} />}</Route>
    <Route path="/admin/products">{() => <ProductsPage token={token} reload={reload} collections={collections} />}</Route>
    <Route path="/admin/collections">{() => <CollectionsPage token={token} collections={collections} reload={reload} />}</Route>
    <Route path="/admin/catalogue">{() => <PublishPage token={token} dashboard={dashboard} />}</Route>
    <Route path="/admin/settings">{() => <SettingsPage />}</Route>
    <Route>{() => <DashboardPage token={token} />}</Route>
  </Switch></Shell>;
}

export default function AdminApp() {
  const session = useAdminSession();
  const recoveryMode = new URLSearchParams(window.location.search).get('recovery') === '1';
  if (!isSupabaseConfigured) return <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--lh-ivory)] px-6 text-center"><div><h1 className="font-display text-3xl">Supabase configuration required</h1><p className="mt-3 max-w-md text-sm text-[var(--lh-muted-ink)]">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to run the admin application.</p></div></div>;
  if (!session.ready) return <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--lh-ivory)]"><Loader2 className="animate-spin text-[var(--lh-burgundy)]" /></div>;
  if (recoveryMode) return <ResetPassword />;
  if (!session.token) return <Login />;
  return <AdminRoutes token={session.token} />;
}
