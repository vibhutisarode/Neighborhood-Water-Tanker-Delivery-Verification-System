import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Camera,
  Check,
  ClipboardList,
  Droplets,
  FileClock,
  Filter,
  History,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  BackendBlock,
  BackendDelivery,
  BackendEvent,
  disputeDelivery,
  isSupabaseConfigured,
  loadBackendData,
  loadPublicSupply,
  getEvidenceUrl,
  submitDelivery,
  supabase,
  verifyDelivery,
} from "./lib/supabase";

type Status = "PENDING" | "VERIFIED" | "DISPUTED";
function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || saving) return;
    setSaving(true); setError("");
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setError("Unable to sign in. Check your manager credentials.");
    else onSignedIn();
    setSaving(false);
  };
  return <div className="auth-screen"><div className="auth-card"><div className="brand"><div className="brand-mark"><Droplets size={21} /></div><div><strong>JalVerify</strong><span>Manager access</span></div></div><p className="eyebrow">SECURE REVIEW CONSOLE</p><h1>Sign in to the evidence ledger.</h1><p>Manager authentication is required to review delivery evidence and make quota decisions.</p><form onSubmit={signIn}><label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@example.com" /></label><label>Password<input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" /></label>{error && <div className="error-banner"><AlertTriangle size={16} />{error}</div>}<button className="primary-button wide" disabled={saving}>{saving ? "Signing in..." : "Sign in"}</button></form><button className="text-button" onClick={() => window.location.assign('/public')}>View resident supply instead <ArrowRight size={14} /></button></div></div>;
}

type Page =
  | "overview"
  | "queue"
  | "deliveries"
  | "blocks"
  | "audit"
  | "driver"
  | "public";
type Delivery = {
  id: string;
  tanker: string;
  driver: string;
  block: string;
  volume: number;
  meter: number;
  status: Status;
  submittedAt: string;
  photo?: string;
  photoPath?: string;
  possibleDuplicate?: boolean;
  offHours?: boolean;
  volumeMismatch?: boolean;
  riskScore?: number;
  riskLevel?: string;
  note?: string;
  disputeReason?: string;
  managerComment?: string;
  reviewedAt?: string;
};
type Block = {
  id?: string;
  name: string;
  quota: number;
  scheduled: number;
  active: boolean;
  deliveryWindowStart?: string | null;
  deliveryWindowEnd?: string | null;
};
type AuditEvent = {
  id: string;
  deliveryId: string;
  action: string;
  actor: string;
  time: string;
  comment?: string;
};

const blocks: Block[] = [
  { name: "Block A", quota: 2500, scheduled: 4000, active: true },
  { name: "Block B", quota: 3000, scheduled: 4000, active: true },
  { name: "Block C", quota: 2000, scheduled: 2500, active: true },
  { name: "Block D", quota: 4000, scheduled: 5000, active: true },
  { name: "Block E", quota: 3500, scheduled: 3500, active: true },
];
const seed: Delivery[] = [
  {
    id: "DV-1048",
    tanker: "MH-31-AB-1234",
    driver: "Ramesh Kumar",
    block: "Block A",
    volume: 2000,
    meter: 1980,
    status: "VERIFIED",
    submittedAt: "Today, 14:32",
    reviewedAt: "Today, 14:38",
  },
  {
    id: "DV-1047",
    tanker: "KA-05-MN-7712",
    driver: "Suresh Patil",
    block: "Block B",
    volume: 1500,
    meter: 1480,
    status: "VERIFIED",
    submittedAt: "Today, 13:16",
    reviewedAt: "Today, 13:22",
  },
  {
    id: "DV-1046",
    tanker: "MH-31-XY-4490",
    driver: "Iqbal Shaikh",
    block: "Block C",
    volume: 2000,
    meter: 1975,
    status: "VERIFIED",
    submittedAt: "Today, 11:05",
    reviewedAt: "Today, 11:12",
  },
  {
    id: "DV-1045",
    tanker: "MH-31-AB-1234",
    driver: "Ramesh Kumar",
    block: "Block B",
    volume: 2000,
    meter: 1450,
    status: "PENDING",
    submittedAt: "Today, 14:41",
    possibleDuplicate: true,
  },
  {
    id: "DV-1044",
    tanker: "TN-38-KL-0921",
    driver: "Mohan Das",
    block: "Block D",
    volume: 2400,
    meter: 1600,
    status: "PENDING",
    submittedAt: "Today, 02:14",
    offHours: true,
  },
  {
    id: "DV-1043",
    tanker: "KA-01-CC-2208",
    driver: "Arjun Nair",
    block: "Block E",
    volume: 1800,
    meter: 1810,
    status: "DISPUTED",
    submittedAt: "Today, 09:48",
    reviewedAt: "Today, 10:20",
    disputeReason: "Photo unreadable",
    managerComment: "Meter digits are obscured by glare.",
  },
  {
    id: "DV-1042",
    tanker: "MH-31-XY-4490",
    driver: "Iqbal Shaikh",
    block: "Block D",
    volume: 1600,
    meter: 1590,
    status: "VERIFIED",
    submittedAt: "Today, 08:52",
    reviewedAt: "Today, 09:01",
  },
];
const money = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const now = () =>
  `Today, ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
function stored<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}
function statusLabel(percent: number) {
  return percent >= 100
    ? "Complete"
    : percent >= 75
      ? "On track"
      : percent >= 50
        ? "Behind"
        : "Critical";
}
function mapBlock(block: BackendBlock): Block {
  return {
    id: block.id,
    name: block.name,
    quota: block.daily_quota_liters,
    scheduled: block.scheduled_liters,
    active: block.active,
    deliveryWindowStart: block.delivery_window_start,
    deliveryWindowEnd: block.delivery_window_end,
  };
}
function mapDelivery(delivery: BackendDelivery): Delivery {
  return {
    id: delivery.id,
    tanker: delivery.tankers?.tanker_number ?? delivery.tanker_id,
    driver: delivery.driver_name,
    block: delivery.blocks?.name ?? delivery.block_id,
    volume: delivery.claimed_volume_liters,
    meter: delivery.meter_reading,
    status: delivery.status,
    submittedAt: new Date(delivery.submitted_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    photoPath: delivery.photo_url,
    possibleDuplicate: delivery.possible_duplicate,
    offHours: delivery.off_hours,
    volumeMismatch: delivery.volume_mismatch,
    riskScore: delivery.risk_score,
    riskLevel: delivery.risk_level,
    disputeReason: delivery.dispute_reason ?? undefined,
    managerComment: delivery.manager_comment ?? undefined,
    reviewedAt:
      delivery.verified_at || delivery.disputed_at
        ? new Date(
            (delivery.verified_at || delivery.disputed_at)!,
          ).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : undefined,
  };
}
function mapEvent(event: BackendEvent): AuditEvent {
  return {
    id: event.id,
    deliveryId: event.delivery_id,
    action: event.action,
    actor: event.actor?.name ?? "System",
    time: new Date(event.created_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    comment: event.comment ?? undefined,
  };
}

export default function App() {
  const pageFromPath = () => {
    const path = window.location.pathname.replace(/^\//, "");
    return (["public", "driver", "queue", "deliveries", "blocks", "audit"].includes(path) ? path : "overview") as Page;
  };
  const [page, setPage] = useState<Page>(pageFromPath);
  const [deliveries, setDeliveries] = useState(() =>
    stored<Delivery[]>("jalverify-deliveries", seed),
  );
  const [events, setEvents] = useState<AuditEvent[]>(() =>
    stored(
      "jalverify-events",
      seed.flatMap((d) => [
        {
          id: `${d.id}-created`,
          deliveryId: d.id,
          action: "DELIVERY_CREATED",
          actor: d.driver,
          time: d.submittedAt,
        },
        ...(d.status !== "PENDING"
          ? [
              {
                id: `${d.id}-reviewed`,
                deliveryId: d.id,
                action:
                  d.status === "VERIFIED"
                    ? "DELIVERY_VERIFIED"
                    : "DELIVERY_DISPUTED",
                actor: "Priya Menon",
                time: d.reviewedAt ?? "Today",
              },
            ]
          : []),
      ]),
    ),
  );
  const [activeBlocks, setActiveBlocks] = useState<Block[]>(blocks);
  const [active, setActive] = useState<Delivery | null>(null);
  const [modal, setModal] = useState<"verify" | "dispute" | "detail" | null>(
    null,
  );
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authenticated, setAuthenticated] = useState(!isSupabaseConfigured);
  const [publicStats, setPublicStats] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const onPopState = () => setPage(pageFromPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session));
      if (!data.session) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) {
      localStorage.setItem("jalverify-deliveries", JSON.stringify(deliveries));
      localStorage.setItem("jalverify-events", JSON.stringify(events));
      return;
    }
    if (!authenticated) return;
    loadBackendData()
      .then((data) => {
        setActiveBlocks(data.blocks.map(mapBlock));
        setDeliveries(data.deliveries.map(mapDelivery));
        setEvents(data.events.map(mapEvent));
        setError("");
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Unable to load JalVerify data.",
        ),
      )
      .finally(() => setLoading(false));
  }, [authenticated]);
  useEffect(() => {
    if (!isSupabaseConfigured || page !== "public") return;
    loadPublicSupply().then(rows => setPublicStats(rows.map(row => ({ name: row.name, quota: row.daily_quota_liters, delivered: row.verified_volume_liters, underReview: row.under_review_liters, remaining: Math.max(row.daily_quota_liters - row.verified_volume_liters, 0), percent: Math.min(100, Math.round(row.verified_volume_liters / row.daily_quota_liters * 100)) })))).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load public supply."));
  }, [page]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 2800);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const stats = useMemo(
    () =>
      activeBlocks.map((b) => {
        const delivered = deliveries
          .filter((d) => d.block === b.name && d.status === "VERIFIED")
          .reduce((s, d) => s + d.volume, 0);
        const review = deliveries
          .filter((d) => d.block === b.name && d.status === "PENDING")
          .reduce((s, d) => s + d.volume, 0);
        return {
          ...b,
          delivered,
          underReview: review,
          remaining: Math.max(b.quota - delivered, 0),
          percent: Math.min(100, Math.round((delivered / b.quota) * 100)),
        };
      }),
    [activeBlocks, deliveries],
  );
  const decide = async (status: Status, reason?: string, comment?: string) => {
    if (!active) return;
    try {
      if (isSupabaseConfigured) {
        if (status === "VERIFIED") await verifyDelivery(active.id);
        else await disputeDelivery(active.id, reason ?? "Other", comment ?? "");
        const data = await loadBackendData();
        setActiveBlocks(data.blocks.map(mapBlock));
        setDeliveries(data.deliveries.map(mapDelivery));
        setEvents(data.events.map(mapEvent));
      } else {
        const item = {
          ...active,
          status,
          reviewedAt: now(),
          disputeReason: reason,
          managerComment: comment,
        };
        setDeliveries((list) => list.map((d) => (d.id === item.id ? item : d)));
        setEvents((list) => [
          {
            id: `${item.id}-${Date.now()}`,
            deliveryId: item.id,
            action:
              status === "VERIFIED" ? "DELIVERY_VERIFIED" : "DELIVERY_DISPUTED",
            actor: "Priya Menon",
            time: item.reviewedAt!,
            comment,
          },
          ...list,
        ]);
      }
      setToast(
        status === "VERIFIED"
          ? `${active.id} verified. ${money(active.volume)} L added to supply.`
          : `${active.id} marked as disputed.`,
      );
      setActive(null);
      setModal(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to update this delivery.",
      );
    }
  };
  const navigate = (next: Page) => {
    setPage(next);
    window.history.pushState({}, "", next === "overview" ? "/" : `/${next}`);
    setActive(null);
    setModal(null);
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Droplets size={26} />
        <strong>Loading JalVerify...</strong>
        <span>Connecting to the evidence ledger.</span>
      </div>
    );
  if (isSupabaseConfigured && page !== "public" && !authenticated)
    return <AuthScreen onSignedIn={() => setAuthenticated(true)} />;
  if (page === "driver")
    return (
      <DriverPage
        blocks={activeBlocks}
        onSubmit={async (d, file) => {
          if (isSupabaseConfigured) {
            if (!supabase) throw new Error("Supabase is not configured");
            const block = activeBlocks.find((b) => b.name === d.block);
            if (!block?.id) throw new Error("Selected block is not available.");
            const saved = await submitDelivery({
              tankerNumber: d.tanker,
              driverName: d.driver,
              blockId: block.id,
              claimedVolume: d.volume,
              meterReading: d.meter,
              file,
              note: d.note,
            });
            setDeliveries((list) => [mapDelivery(saved), ...list]);
            setToast("Delivery recorded and queued for verification.");
          } else {
            setDeliveries((list) => [d, ...list]);
            setEvents((list) => [
              {
                id: `${d.id}-created`,
                deliveryId: d.id,
                action: "DELIVERY_CREATED",
                actor: d.driver,
                time: d.submittedAt,
              },
              ...list,
            ]);
            setToast("Delivery recorded and queued for verification.");
          }
        }}
        navigate={navigate}
        deliveries={deliveries}
      />
    );
  if (page === "public")
    return <PublicPage stats={publicStats ?? stats} navigate={navigate} />;
  return (
    <div className="app-shell">
      <Sidebar page={page} navigate={navigate} />
      <main className="main-content">
        <Topbar page={page} navigate={navigate} />
        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        {page === "overview" && (
          <Overview stats={stats} deliveries={deliveries} navigate={navigate} />
        )}
        {page === "queue" && (
          <Queue
            deliveries={deliveries.filter((d) => d.status === "PENDING")}
            verify={(d) => {
              setActive(d);
              setModal("verify");
            }}
            dispute={(d) => {
              setActive(d);
              setModal("dispute");
            }}
            inspect={(d) => {
              setActive(d);
              setModal("detail");
            }}
          />
        )}
        {page === "deliveries" && (
          <DeliveryRegister
            deliveries={deliveries}
            open={(d) => {
              setActive(d);
              setModal("detail");
            }}
            navigate={navigate}
          />
        )}
        {page === "blocks" && <BlocksPage stats={stats} />}
        {page === "audit" && (
          <AuditPage deliveries={deliveries} events={events} />
        )}
      </main>
      {toast && (
        <div className="toast">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === "verify" && active && (
        <Verify
          delivery={active}
          confirm={() => decide("VERIFIED")}
          cancel={() => {
            setActive(null);
            setModal(null);
          }}
        />
      )}
      {modal === "dispute" && active && (
        <Dispute
          delivery={active}
          confirm={(r, c) => decide("DISPUTED", r, c)}
          cancel={() => {
            setActive(null);
            setModal(null);
          }}
        />
      )}
      {modal === "detail" && active && (
        <Detail
          delivery={active}
          close={() => {
            setActive(null);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function Sidebar({
  page,
  navigate,
}: {
  page: Page;
  navigate: (p: Page) => void;
}) {
  const items: [Page, string, typeof LayoutDashboard][] = [
    ["overview", "Overview", LayoutDashboard],
    ["queue", "Pending verification", ClipboardList],
    ["deliveries", "Deliveries", Truck],
    ["blocks", "Blocks", BarChart3],
    ["audit", "Audit log", History],
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Droplets size={21} />
        </div>
        <div>
          <strong>JalVerify</strong>
          <span>Water evidence platform</span>
        </div>
      </div>
      <div className="demo-pill">
        <i className="live-dot" />
        Demo environment
      </div>
      <nav>
        {items.map(([id, label, Icon]) => (
          <button
            key={id}
            className={page === id ? "nav-item active" : "nav-item"}
            onClick={() => navigate(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            {id === "queue" && <b>3</b>}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="support-card">
          <ShieldCheck size={18} />
          <div>
            <strong>Evidence first</strong>
            <span>Every decision leaves a trail.</span>
          </div>
        </div>
        <div className="user-chip">
          <div className="avatar">PM</div>
          <div>
            <strong>Priya Menon</strong>
            <span>Association manager</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
function Topbar({
  page,
  navigate,
}: {
  page: Page;
  navigate: (p: Page) => void;
}) {
  const titles: Record<string, string> = {
    overview: "Today at a glance",
    queue: "Pending verification",
    deliveries: "All deliveries",
    blocks: "Block configuration",
    audit: "Audit log",
  };
  return (
    <header className="topbar">
      <button className="icon-button menu-button">
        <Menu size={21} />
      </button>
      <div>
        <p className="eyebrow">SATURDAY, 12 SEPTEMBER 2026</p>
        <h1>{titles[page]}</h1>
      </div>
      <div className="topbar-actions">
        <button
          className="outline-button public-link"
          onClick={() => navigate("public")}
        >
          <Users size={16} /> Resident view
        </button>
        <button className="icon-button">
          <Bell size={19} />
        </button>
        <div className="avatar large">PM</div>
      </div>
    </header>
  );
}
function Metric({
  label,
  value,
  detail,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  icon: typeof Droplets;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <div className="metric-icon">
          <Icon size={18} />
        </div>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Badge({ percent }: { percent: number }) {
  const label = statusLabel(percent);
  return (
    <span className={`status-badge ${label.toLowerCase().replace(" ", "-")}`}>
      <i />
      {label}
    </span>
  );
}
function Overview({
  stats,
  deliveries,
  navigate,
}: {
  stats: any[];
  deliveries: Delivery[];
  navigate: (p: Page) => void;
}) {
  const verified = deliveries
    .filter((d) => d.status === "VERIFIED")
    .reduce((s, d) => s + d.volume, 0);
  const quota = stats.reduce((s, b) => s + b.quota, 0);
  const pending = deliveries.filter((d) => d.status === "PENDING");
  const disputed = deliveries.filter((d) => d.status === "DISPUTED");
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div>
          <h2>Good afternoon, Priya</h2>
          <p>Here is the verified water picture for your community.</p>
        </div>
        <button className="primary-button" onClick={() => navigate("driver")}>
          <Plus size={17} /> Record delivery
        </button>
      </section>
      <section className="metric-grid">
        <Metric
          label="Today's verified water"
          value={`${money(verified)} L`}
          detail={`of ${money(quota)} L quota`}
          tone="teal"
          icon={Droplets}
        />
        <Metric
          label="Scheduled quota"
          value={`${money(quota)} L`}
          detail="5 active blocks"
          tone="blue"
          icon={BarChart3}
        />
        <Metric
          label="Completion"
          value={`${Math.round((verified / quota) * 100)}%`}
          detail="Across all blocks"
          tone="lime"
          icon={Zap}
        />
        <Metric
          label="Needs attention"
          value={`${pending.length + disputed.length}`}
          detail={`${pending.length} pending, ${disputed.length} disputed`}
          tone="orange"
          icon={AlertTriangle}
        />
      </section>
      <div className="content-grid">
        <section className="panel supply-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LIVE SUPPLY STATUS</p>
              <h3>Today's supply by block</h3>
            </div>
            <button className="text-button" onClick={() => navigate("blocks")}>
              Manage blocks <ArrowRight size={15} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Block</th>
                  <th>Verified</th>
                  <th>Quota</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Gap</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((b) => (
                  <tr key={b.name}>
                    <td>
                      <strong>{b.name}</strong>
                      <small>{money(b.scheduled)} L scheduled</small>
                    </td>
                    <td className="number-cell">{money(b.delivered)} L</td>
                    <td className="muted-cell">{money(b.quota)} L</td>
                    <td>
                      <div className="progress-line">
                        <span style={{ width: `${b.percent}%` }} />
                      </div>
                      <small>{b.percent}%</small>
                    </td>
                    <td>
                      <Badge percent={b.percent} />
                    </td>
                    <td className={b.remaining ? "gap-cell" : "muted-cell"}>
                      {b.remaining ? `${money(b.remaining)} L` : "Complete"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="panel attention-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACTION QUEUE</p>
              <h3>Needs your review</h3>
            </div>
            <span className="count-badge">{pending.length}</span>
          </div>
          {pending.map((d) => (
            <div
              className="attention-item"
              key={d.id}
              onClick={() => navigate("queue")}
            >
              <div className="attention-icon">
                <AlertTriangle size={17} />
              </div>
              <div>
                <strong>{d.block} delivery</strong>
                <span>
                  {money(d.volume)} L from {d.tanker}
                </span>
                <small>
                  {d.offHours
                    ? "Off-hours delivery"
                    : d.possibleDuplicate
                      ? "Possible duplicate"
                      : "Awaiting review"}
                </small>
              </div>
              <ArrowRight size={16} />
            </div>
          ))}
        </aside>
      </div>
      <div className="insight-banner">
        <div className="insight-icon">
          <Droplets size={21} />
        </div>
        <div>
          <strong>
            {(stats.find((b) => b.name === "Block B")?.remaining ?? 0) > 0
              ? `Block B needs ${money(stats.find((b) => b.name === "Block B")?.remaining ?? 0)} L more today.`
              : "Block B has met today's quota."}
          </strong>
          <span>
            Verified supply is the only volume counted toward resident quotas.
          </span>
        </div>
        <button className="text-button" onClick={() => navigate("public")}>
          Preview resident view <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function Queue({
  deliveries,
  verify,
  dispute,
  inspect,
}: {
  deliveries: Delivery[];
  verify: (d: Delivery) => void;
  dispute: (d: Delivery) => void;
  inspect: (d: Delivery) => void;
}) {
  const sortedDeliveries = [...deliveries].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0) || b.submittedAt.localeCompare(a.submittedAt));
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">PRIORITY QUEUE</p>
          <h2>Review evidence, protect the quota.</h2>
          <p>High-signal anomalies are surfaced first for a faster decision.</p>
        </div>
        <div className="queue-summary">
          <span>{deliveries.length}</span>
          <small>deliveries waiting</small>
        </div>
      </section>
      <div className="notice">
        <ShieldCheck size={17} />
        <span>
          <strong>Verification priority is not a fraud verdict.</strong> Review
          the evidence and leave the final decision with the association.
        </span>
      </div>
      <div className="queue-list">
        {sortedDeliveries.map((d) => (
          <Evidence
            key={d.id}
            d={d}
            verify={() => verify(d)}
            dispute={() => dispute(d)}
            inspect={() => inspect(d)}
          />
        ))}
      </div>
    </div>
  );
}
function Evidence({
  d,
  verify,
  dispute,
  inspect,
}: {
  d: Delivery;
  verify: () => void;
  dispute: () => void;
  inspect: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState("");
  useEffect(() => { if (d.photoPath && isSupabaseConfigured) getEvidenceUrl(d.photoPath).then(setPhotoUrl).catch(() => undefined); }, [d.photoPath]);
  const mismatch = Math.abs(d.volume - d.meter);
  const risk =
    d.riskLevel ? d.riskLevel[0] + d.riskLevel.slice(1).toLowerCase() : d.possibleDuplicate || d.offHours || mismatch > 300 ? "High" : mismatch > 100 ? "Medium" : "Low";
  return (
    <article className="evidence-card">
      <div className="evidence-photo">
        {photoUrl ? <img src={photoUrl} alt="Uploaded meter evidence" /> : <><ImageIcon size={27} /><span>Meter photo attached</span><small>{d.photoPath ? "Loading secure preview" : "Demo evidence preview"}</small></>}
      </div>
      <div className="evidence-body">
        <div className="evidence-head">
          <div>
            <p className="eyebrow">{d.id}</p>
            <h3>{d.tanker}</h3>
            <span className="subtext">
              {d.driver} <span className="dot-sep">•</span> submitted{" "}
              {d.submittedAt}
            </span>
          </div>
          <span className={`risk ${risk.toLowerCase()}`}>{risk} risk</span>
        </div>
        <div className="evidence-facts">
          <Fact label="Target block" value={d.block} />
          <Fact label="Claimed volume" value={`${money(d.volume)} L`} />
          <Fact label="Meter reading" value={`${money(d.meter)} L`} />
          <Fact
            label="Schedule"
            value={d.offHours ? "Off-hours" : "Within window"}
            warning={d.offHours}
          />
        </div>
        {(d.possibleDuplicate || d.offHours || mismatch > 100) && (
          <div className="warning-row">
            <AlertTriangle size={16} />
            <span>
              {d.possibleDuplicate
                ? "Possible duplicate: similar delivery within 30 minutes."
                : d.offHours
                  ? "Off-hours delivery: submitted outside the block window."
                  : `Volume mismatch: ${money(mismatch)} L difference between claim and meter.`}
            </span>
          </div>
        )}
        <div className="evidence-actions">
          <button className="outline-button" onClick={inspect}>View evidence</button>
          <button className="outline-button" onClick={dispute}>
            Dispute
          </button>
          <button className="primary-button" onClick={verify}>
            <Check size={16} /> Verify delivery
          </button>
        </div>
      </div>
    </article>
  );
}
function Fact({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div>
      <small>{label}</small>
      <strong className={warning ? "warning-text" : ""}>{value}</strong>
    </div>
  );
}

function DeliveryRegister({
  deliveries,
  open,
  navigate,
}: {
  deliveries: Delivery[];
  open: (d: Delivery) => void;
  navigate: (p: Page) => void;
}) {
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [search, setSearch] = useState("");
  const list = deliveries.filter(
    (d) =>
      (filter === "ALL" || d.status === filter) &&
      `${d.id} ${d.tanker} ${d.block}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">DELIVERY REGISTER</p>
          <h2>Every load, accounted for.</h2>
          <p>
            The complete record stays available, including disputed deliveries.
          </p>
        </div>
        <button className="primary-button" onClick={() => navigate("driver")}>
          <Plus size={17} /> Record delivery
        </button>
      </section>
      <div className="toolbar">
        <div className="search-box">
          <Search size={17} />
          <input
            placeholder="Search tanker, block or delivery ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <Filter size={16} />
          {(["ALL", "PENDING", "VERIFIED", "DISPUTED"] as const).map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>
      <section className="panel register-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Delivery</th>
                <th>Tanker / driver</th>
                <th>Block</th>
                <th>Volume</th>
                <th>Submitted</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} onClick={() => open(d)}>
                  <td>
                    <strong>{d.id}</strong>
                    {d.possibleDuplicate && (
                      <small className="table-warning">
                        Possible duplicate
                      </small>
                    )}
                  </td>
                  <td>
                    <strong>{d.tanker}</strong>
                    <small>{d.driver}</small>
                  </td>
                  <td>{d.block}</td>
                  <td className="number-cell">{money(d.volume)} L</td>
                  <td className="muted-cell">{d.submittedAt}</td>
                  <td>
                    <span className={`status-badge ${d.status.toLowerCase()}`}>
                      <i />
                      {d.status[0] + d.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td>
                    <ArrowRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length && (
          <div className="empty">
            <ClipboardList size={22} />
            No deliveries found for this period.
          </div>
        )}
      </section>
    </div>
  );
}
function BlocksPage({ stats }: { stats: any[] }) {
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">COMMUNITY SETTINGS</p>
          <h2>Blocks and daily quotas.</h2>
          <p>
            Set the water target and expected tanker schedule for each block.
          </p>
        </div>
        <button className="outline-button">
          <Plus size={16} /> Add block
        </button>
      </section>
      <div className="block-grid">
        {stats.map((b) => (
          <article className="block-card" key={b.name}>
            <div className="block-card-top">
              <div className="block-letter">{b.name.slice(-1)}</div>
              <span className="active-tag">Active</span>
            </div>
            <h3>{b.name}</h3>
            <div className="block-stat">
              <span>Daily quota</span>
              <strong>{money(b.quota)} L</strong>
            </div>
            <div className="block-stat">
              <span>Scheduled today</span>
              <strong>{money(b.scheduled)} L</strong>
            </div>
            <div className="block-progress">
              <div className="progress-line">
                <span style={{ width: `${b.percent}%` }} />
              </div>
              <span>{b.percent}% delivered</span>
            </div>
            <button className="text-button">
              Edit settings <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
function AuditPage({
  deliveries,
  events,
}: {
  deliveries: Delivery[];
  events: AuditEvent[];
}) {
  return (
    <div className="page-wrap">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">CHAIN OF EVIDENCE</p>
          <h2>Audit log</h2>
          <p>A durable history of what was submitted, reviewed and decided.</p>
        </div>
        <button className="outline-button">
          <FileClock size={16} /> Daily report
        </button>
      </section>
      <div className="audit-layout">
        <section className="panel audit-list">
          <div className="panel-heading">
            <div>
              <h3>Activity stream</h3>
              <span className="subtext">{events.length} recorded events</span>
            </div>
            <button className="icon-button">
              <SlidersHorizontal size={17} />
            </button>
          </div>
          {events.map((e) => (
            <div className="audit-event" key={e.id}>
              <div
                className={`event-icon ${e.action.includes("VERIFIED") ? "verified" : e.action.includes("DISPUTED") ? "disputed" : ""}`}
              >
                {e.action.includes("VERIFIED") ? (
                  <Check size={15} />
                ) : e.action.includes("DISPUTED") ? (
                  <AlertTriangle size={15} />
                ) : (
                  <Upload size={15} />
                )}
              </div>
              <div>
                <strong>{e.action.replaceAll("_", " ")}</strong>
                <span>
                  {e.deliveryId} <span className="dot-sep">•</span> by {e.actor}
                </span>
                {e.comment && <small>{e.comment}</small>}
              </div>
              <time>{e.time}</time>
            </div>
          ))}
        </section>
        <section className="panel audit-principle">
          <div className="principle-mark">
            <ShieldCheck size={22} />
          </div>
          <p className="eyebrow">TRUST MODEL</p>
          <h3>Evidence creates accountability.</h3>
          <p>
            Server timestamp, tanker identity, target block, meter evidence and
            a manager decision create a stronger chain of evidence.
          </p>
          <div className="chain">
            <span>Submit</span>
            <ArrowRight size={14} />
            <span>Review</span>
            <ArrowRight size={14} />
            <span>Decide</span>
            <ArrowRight size={14} />
            <span>Audit</span>
          </div>
          <div className="audit-mini">
            <span>Tracked deliveries</span>
            <strong>{deliveries.length}</strong>
          </div>
        </section>
      </div>
      <section className="panel audit-register">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">HISTORICAL DELIVERIES</p>
            <h3>Delivery evidence register</h3>
          </div>
          <span className="subtext">{deliveries.length} deliveries retained</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Delivery</th><th>Tanker / block</th><th>Volume</th><th>Submitted</th><th>Photo</th><th>Status</th><th>Decision note</th></tr></thead>
            <tbody>{deliveries.map((delivery) => <tr key={delivery.id}>
              <td><strong>{delivery.id}</strong></td>
              <td><strong>{delivery.tanker}</strong><small>{delivery.block}</small></td>
              <td className="number-cell">{money(delivery.volume)} L</td>
              <td className="muted-cell">{delivery.submittedAt}</td>
              <td>{delivery.photo || delivery.photoPath ? <span className="evidence-attached"><Check size={13} /> Attached</span> : <span className="muted-cell">Demo record</span>}</td>
              <td><span className={`status-badge ${delivery.status.toLowerCase()}`}><i />{delivery.status[0] + delivery.status.slice(1).toLowerCase()}</span></td>
              <td className="audit-comment">{delivery.managerComment ?? delivery.disputeReason ?? "No manager comment"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DriverPage({
  blocks,
  onSubmit,
  navigate,
  deliveries,
}: {
  blocks: Block[];
  onSubmit: (d: Delivery, file: File) => Promise<void>;
  navigate: (p: Page) => void;
  deliveries: Delivery[];
}) {
  const [form, setForm] = useState({
    tanker: "",
    driver: "",
    block: blocks[0]?.name ?? "",
    volume: "",
    meter: "",
    note: "",
  });
  const [photo, setPhoto] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [done, setDone] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const duplicate = deliveries.some(
    (d) =>
      d.tanker === form.tanker &&
      d.block === form.block &&
      d.submittedAt.startsWith("Today"),
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tanker || !form.driver || !form.volume || !form.meter || !photo || !photoFile || saving)
      return;
    setSaving(true);
    setSubmitError("");
    const d: Delivery = {
      id: `DV-${1050 + deliveries.length}`,
      tanker: form.tanker,
      driver: form.driver,
      block: form.block,
      volume: Number(form.volume),
      meter: Number(form.meter),
      status: "PENDING",
      submittedAt: now(),
      photo,
      possibleDuplicate: duplicate,
      note: form.note,
    };
    try {
      await onSubmit(d, photoFile);
      setDone(d);
    } catch (reason) {
      setSubmitError(reason instanceof Error ? reason.message : "Connection lost. Your delivery has NOT been recorded.");
    } finally {
      setSaving(false);
    }
  };
  if (done)
    return (
      <div className="driver-shell">
        <DriverHeader navigate={navigate} />
        <div className="success-screen">
          <div className="success-mark">
            <Check size={30} />
          </div>
          <p className="eyebrow">DELIVERY RECORDED</p>
          <h1>Evidence is in the log.</h1>
          <p>
            Your delivery is queued for manager verification. The server time is
            the authoritative submission time.
          </p>
          <div className="receipt">
            <div>
              <span>Delivery ID</span>
              <strong>{done.id}</strong>
            </div>
            <div>
              <span>Recorded at</span>
              <strong>{done.submittedAt} IST</strong>
            </div>
            <div>
              <span>Route</span>
              <strong>
                {done.tanker} <ArrowRight size={13} /> {done.block}
              </strong>
            </div>
            <div>
              <span>Claimed volume</span>
              <strong>{money(done.volume)} L</strong>
            </div>
          </div>
          <span className="status-badge pending">
            <i />
            Pending verification
          </span>
          <button
            className="primary-button wide"
            onClick={() => {
              setDone(null);
              setPhoto("");
              setPhotoFile(null);
              setForm({
                tanker: "",
                driver: "",
                block: blocks[0]?.name ?? "",
                volume: "",
                meter: "",
                note: "",
              });
            }}
          >
            Record another delivery
          </button>
        </div>
      </div>
    );
  return (
    <div className="driver-shell">
      <DriverHeader navigate={navigate} />
      <div className="driver-content">
        <div className="driver-intro">
          <p className="eyebrow">DELIVERY EVIDENCE</p>
          <h1>Record a delivery</h1>
          <p>
            Capture the meter clearly so the association can verify every litre.
          </p>
        </div>
        <form className="driver-form" onSubmit={submit}>
          <label>
            Tanker ID
            <input
              required
              placeholder="e.g. MH-31-AB-1234"
              value={form.tanker}
              onChange={(e) => setForm({ ...form, tanker: e.target.value })}
            />
          </label>
          <label>
            Driver name
            <input
              required
              placeholder="Your full name"
              value={form.driver}
              onChange={(e) => setForm({ ...form, driver: e.target.value })}
            />
          </label>
          <label>
            Target building / block
            <select
              value={form.block}
              onChange={(e) => setForm({ ...form, block: e.target.value })}
            >
              {blocks.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
          </label>
          <div className="two-col">
            <label>
              Delivered volume <span className="unit">litres</span>
              <input
                required
                type="number"
                min="1"
                placeholder="2000"
                value={form.volume}
                onChange={(e) => setForm({ ...form, volume: e.target.value })}
              />
            </label>
            <label>
              Meter reading <span className="unit">litres</span>
              <input
                required
                type="number"
                min="1"
                placeholder="1980"
                value={form.meter}
                onChange={(e) => setForm({ ...form, meter: e.target.value })}
              />
            </label>
          </div>
          <label className="photo-upload">
            Meter photograph
            <span>
              Show the full meter reading in focus. The photo is your primary
              proof.
            </span>
            <input
              required
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && file.size <= 5000000) {
                  setPhotoFile(file);
                  const reader = new FileReader();
                  reader.onload = () => setPhoto(String(reader.result));
                  reader.readAsDataURL(file);
                }
              }}
            />
            {photo ? (
              <img src={photo} alt="Meter preview" />
            ) : (
              <div className="upload-placeholder">
                <Camera size={25} />
                <strong>Tap to take a photo</strong>
                <span>JPG or PNG, max 5 MB</span>
              </div>
            )}
          </label>
          <label>
            Note <span className="optional">optional</span>
            <textarea
              rows={2}
              placeholder="Anything the manager should know?"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          {duplicate && (
            <div className="warning-row">
              <AlertTriangle size={16} />A similar delivery was recorded
              recently. Continue only if this is a second delivery.
            </div>
          )}
          {submitError && <div className="error-banner"><AlertTriangle size={16} />{submitError}</div>}
          <button className="primary-button wide" type="submit" disabled={saving}>
            <Upload size={17} /> {saving ? "Uploading evidence..." : "Submit delivery evidence"}
          </button>
          <p className="form-footnote">
            <ShieldCheck size={14} /> Submitted time is recorded by the server
            and cannot be edited.
          </p>
        </form>
      </div>
    </div>
  );
}
function DriverHeader({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <header className="driver-top">
      <div className="brand">
        <div className="brand-mark">
          <Droplets size={21} />
        </div>
        <div>
          <strong>JalVerify</strong>
          <span>Driver capture</span>
        </div>
      </div>
      <button className="text-button" onClick={() => navigate("overview")}>
        Manager view <ArrowRight size={14} />
      </button>
    </header>
  );
}

function PublicPage({
  stats,
  navigate,
}: {
  stats: any[];
  navigate: (p: Page) => void;
}) {
  const verified = stats.reduce((s, b) => s + b.delivered, 0);
  const quota = stats.reduce((s, b) => s + b.quota, 0);
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="brand">
          <div className="brand-mark">
            <Droplets size={21} />
          </div>
          <div>
            <strong>JalVerify</strong>
            <span>Community water ledger</span>
          </div>
        </div>
        <button className="outline-button" onClick={() => navigate("overview")}>
          Association login <ArrowRight size={15} />
        </button>
      </header>
      <div className="public-content">
        <div className="public-hero">
          <div>
            <p className="eyebrow">
              SATURDAY, 12 SEPTEMBER 2026 <i className="live-dot" /> LIVE
            </p>
            <h1>
              Today's water
              <br />
              <em>supply, verified.</em>
            </h1>
            <p>
              Transparent supply status for every block. Pending deliveries are
              shown separately until reviewed.
            </p>
          </div>
          <div className="public-total">
            <span>Community verified</span>
            <strong>
              {money(verified)} <small>/ {money(quota)} L</small>
            </strong>
            <div className="progress-line">
              <span
                style={{ width: `${Math.round((verified / quota) * 100)}%` }}
              />
            </div>
            <small>
              {Math.round((verified / quota) * 100)}% of today's quota
            </small>
          </div>
        </div>
        <div className="public-label">
          <h2>Supply by block</h2>
          <span>Verified &nbsp; Under review</span>
        </div>
        <div className="notice public-trust"><ShieldCheck size={16} /><span>Verified volume includes deliveries reviewed and approved by the association. Deliveries still under review are not included in the verified total.</span></div>
        <div className="public-blocks">
          {stats.map((b) => (
            <article className="public-block" key={b.name}>
              <div className="public-block-head">
                <div className="block-letter">{b.name.slice(-1)}</div>
                <div>
                  <h3>{b.name}</h3>
                  <span>
                    {b.percent >= 100
                      ? "Quota met"
                      : `${money(b.remaining)} L remaining`}
                  </span>
                </div>
                <Badge percent={b.percent} />
              </div>
              <div className="public-volume">
                <strong>
                  {money(b.delivered)} <small>/ {money(b.quota)} L</small>
                </strong>
                <span>{b.percent}%</span>
              </div>
              <div className="progress-line">
                <span style={{ width: `${b.percent}%` }} />
              </div>
              {b.underReview > 0 && (
                <div className="under-review">
                  <FileClock size={14} />
                  {money(b.underReview)} L under review{" "}
                  <span>Last verified: today</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
      <footer>
        <span>JalVerify</span>
        <span>Evidence-led water delivery verification</span>
        <span>Updated just now</span>
      </footer>
    </div>
  );
}

function Verify({
  delivery,
  confirm,
  cancel,
}: {
  delivery: Delivery;
  confirm: () => void;
  cancel: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={cancel}>
          <X size={18} />
        </button>
        <div className="modal-icon success">
          <Check size={21} />
        </div>
        <p className="eyebrow">CONFIRM VERIFICATION</p>
        <h2>Verify this delivery?</h2>
        <p>
          <strong>{money(delivery.volume)} L</strong> will be added to today's
          verified water supply for {delivery.block}.
        </p>
        <div className="modal-summary">
          <span>{delivery.id}</span>
          <strong>{delivery.tanker}</strong>
          <span>{delivery.submittedAt}</span>
        </div>
        <div className="modal-actions">
          <button className="outline-button" onClick={cancel}>
            Cancel
          </button>
          <button className="primary-button" onClick={confirm}>
            <Check size={16} /> Confirm verification
          </button>
        </div>
      </div>
    </div>
  );
}
function Dispute({
  delivery,
  confirm,
  cancel,
}: {
  delivery: Delivery;
  confirm: (r: string, c: string) => void;
  cancel: () => void;
}) {
  const [reason, setReason] = useState("Photo unreadable");
  const [comment, setComment] = useState("");
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={cancel}>
          <X size={18} />
        </button>
        <div className="modal-icon warning">
          <AlertTriangle size={21} />
        </div>
        <p className="eyebrow">HOLD PAYMENT ELIGIBILITY</p>
        <h2>Dispute this delivery</h2>
        <p>
          This delivery remains in the audit trail but will not count toward
          verified supply.
        </p>
        <label>
          Reason
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              "Partial delivery",
              "Wrong block",
              "Meter reading mismatch",
              "Photo unreadable",
              "Duplicate delivery",
              "Off-hours delivery",
              "Delivery not received",
              "Other",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Manager comment <span className="optional">required</span>
          <textarea
            required
            rows={3}
            placeholder="What did you observe?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button className="outline-button" onClick={cancel}>
            Cancel
          </button>
          <button
            className="danger-button"
            disabled={!comment.trim()}
            onClick={() => confirm(reason, comment)}
          >
            Submit dispute
          </button>
        </div>
      </div>
    </div>
  );
}
function Detail({
  delivery,
  close,
}: {
  delivery: Delivery;
  close: () => void;
}) {
  const [photoUrl, setPhotoUrl] = useState("");
  useEffect(() => {
    if (delivery.photoPath && isSupabaseConfigured) getEvidenceUrl(delivery.photoPath).then(setPhotoUrl).catch(() => undefined);
  }, [delivery.photoPath]);
  const payment = delivery.status === "VERIFIED" ? "Eligible" : delivery.status === "DISPUTED" ? "Held" : "Pending review";
  return (
    <div className="modal-backdrop">
      <div className="modal detail-modal">
        <button className="modal-close" onClick={close}>
          <X size={18} />
        </button>
        <p className="eyebrow">EVIDENCE CARD / {delivery.id}</p>
        <h2>{delivery.block} delivery</h2>
        <div className="detail-photo">
          {photoUrl || delivery.photo ? (
            <img src={photoUrl || delivery.photo} alt="Meter evidence" />
          ) : (
            <ImageIcon size={32} />
          )}
        </div>
        <div className="detail-grid">
          <Fact label="Tanker" value={delivery.tanker} />
          <Fact label="Driver" value={delivery.driver} />
          <Fact label="Claimed" value={`${money(delivery.volume)} L`} />
          <Fact label="Meter" value={`${money(delivery.meter)} L`} />
          <Fact label="Submitted" value={`${delivery.submittedAt} IST`} />
          <Fact label="Status" value={delivery.status} />
          <Fact label="Payment" value={payment} />
          <Fact label="Risk" value={delivery.riskScore !== undefined ? `${delivery.riskLevel ?? "LOW"} (${delivery.riskScore})` : "Demo priority"} />
        </div>
        <div className="timeline">
          <div>
            <i />
            <span>
              <strong>Delivery submitted</strong>
              <small>{delivery.submittedAt}</small>
            </span>
          </div>
          {delivery.reviewedAt && (
            <div>
              <i
                className={
                  delivery.status === "VERIFIED" ? "verified-dot" : "review-dot"
                }
              />
              <span>
                <strong>Manager {delivery.status.toLowerCase()}</strong>
                <small>{delivery.reviewedAt} by Priya Menon</small>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
