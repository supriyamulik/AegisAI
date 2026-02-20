// import { useState, useEffect, useCallback } from "react";
// import {
//   LineChart, Line, AreaChart, Area, BarChart, Bar,
//   XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
//   RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
//   Cell
// } from "recharts";

// // ─────────────────────────────────────────────
// // API CONFIG — point this at your FastAPI server
// // ─────────────────────────────────────────────

// const API_BASE = "https://aegisai-ta6m.onrender.com";

// // Helper: derive a display-friendly "status" from governance actions + risk level
// function deriveStatus(modelId, riskLevel, governanceActions) {
//   const modelActions = (governanceActions || []).filter((a) => a.model_id === modelId);
//   if (modelActions.some((a) => a.action_type === "freeze_model")) return "frozen";
//   if (modelActions.some((a) => a.action_type === "escalate_to_human")) return "escalated";
//   if (riskLevel === "moderate" || riskLevel === "high") return "monitoring";
//   return "active";
// }

// // Helper: derive model type from component_scores keys
// function deriveModelType(componentScores) {
//   const keys = Object.keys(componentScores || {});
//   return keys.some((k) => ["hallucination_score", "toxicity_score", "prompt_injection_risk", "data_leakage_risk"].includes(k))
//     ? "LLM"
//     : "ML";
// }

// // Helper: build merged risk history for multi-line trends chart
// function buildAllHistory(riskHistory, models) {
//   if (!riskHistory?.length || !models?.length) return [];
//   // Group history by date bucket (per-day last value per model)
//   const byDate = {};
//   riskHistory.forEach(({ model_id, risk_index, timestamp }) => {
//     const date = new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
//     if (!byDate[date]) byDate[date] = { date };
//     byDate[date][model_id] = Math.round(risk_index * 10) / 10;
//   });
//   return Object.values(byDate).slice(-31);
// }

// // ─────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────

// const RISK_CONFIG = {
//   critical: { color: "#FF3B5C", bg: "rgba(255,59,92,0.15)", label: "CRITICAL", glow: "0 0 12px #FF3B5C66" },
//   high: { color: "#FF8C42", bg: "rgba(255,140,66,0.15)", label: "HIGH", glow: "0 0 12px #FF8C4266" },
//   moderate: { color: "#F5C842", bg: "rgba(245,200,66,0.15)", label: "MODERATE", glow: "0 0 12px #F5C84266" },
//   low: { color: "#00E5A0", bg: "rgba(0,229,160,0.15)", label: "LOW", glow: "0 0 12px #00E5A066" },
// };

// const MODEL_COLORS = ["#7B61FF", "#00C4FF", "#FF6B9D", "#00E5A0", "#FF8C42", "#F5C842"];

// const STATUS_CONFIG = {
//   frozen: { label: "FROZEN", color: "#FF3B5C" },
//   escalated: { label: "ESCALATED", color: "#FF8C42" },
//   monitoring: { label: "MONITORING", color: "#F5C842" },
//   active: { label: "ACTIVE", color: "#00E5A0" },
// };

// const ACTION_ICONS = {
//   freeze_model: "⛔",
//   escalate_to_human: "🚨",
//   enable_strict_filtering: "🛡️",
//   send_alert: "⚠️",
//   trigger_retraining: "🔄",
// };

// // ─────────────────────────────────────────────
// // RISK GAUGE COMPONENT
// // ─────────────────────────────────────────────

// function RiskGauge({ value, size = 140 }) {
//   const level = value >= 81 ? "critical" : value >= 61 ? "high" : value >= 31 ? "moderate" : "low";
//   const cfg = RISK_CONFIG[level];
//   const angle = (value / 100) * 180 - 180;
//   const cx = size / 2, cy = size * 0.62;
//   const r = size * 0.38;

//   const arcPath = (startDeg, endDeg, color, opacity = 1) => {
//     const toRad = (d) => (d * Math.PI) / 180;
//     const x1 = cx + r * Math.cos(toRad(startDeg));
//     const y1 = cy + r * Math.sin(toRad(startDeg));
//     const x2 = cx + r * Math.cos(toRad(endDeg));
//     const y2 = cy + r * Math.sin(toRad(endDeg));
//     const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
//     return (
//       <path
//         d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
//         fill="none"
//         stroke={color}
//         strokeWidth={size * 0.07}
//         strokeLinecap="round"
//         opacity={opacity}
//       />
//     );
//   };

//   // Needle
//   const needleAngle = (value / 100) * 180 - 180;
//   const nx = cx + (r - size * 0.05) * Math.cos((needleAngle * Math.PI) / 180);
//   const ny = cy + (r - size * 0.05) * Math.sin((needleAngle * Math.PI) / 180);

//   return (
//     <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
//       <svg width={size} height={size * 0.75}>
//         <defs>
//           <filter id="glow">
//             <feGaussianBlur stdDeviation="3" result="coloredBlur" />
//             <feMerge>
//               <feMergeNode in="coloredBlur" />
//               <feMergeNode in="SourceGraphic" />
//             </feMerge>
//           </filter>
//         </defs>
//         {arcPath(-180, -90, "#1A3040", 0.5)}
//         {arcPath(-90, 0, "#1A3040", 0.5)}
//         {arcPath(-180, -108, "#00E5A0", 0.9)}
//         {arcPath(-108, -54, "#F5C842", 0.9)}
//         {arcPath(-54, -18, "#FF8C42", 0.9)}
//         {arcPath(-18, 0, "#FF3B5C", 0.9)}
//         {arcPath(-180, angle, cfg.color)}
//         <line
//           x1={cx} y1={cy}
//           x2={nx} y2={ny}
//           stroke={cfg.color}
//           strokeWidth={size * 0.025}
//           strokeLinecap="round"
//           filter="url(#glow)"
//         />
//         <circle cx={cx} cy={cy} r={size * 0.04} fill={cfg.color} />
//         <text x={cx} y={cy - size * 0.1} textAnchor="middle" fill={cfg.color}
//           fontSize={size * 0.22} fontWeight="800" fontFamily="'Courier New', monospace">
//           {Math.round(value)}
//         </text>
//         <text x={cx} y={cy - size * 0.28} textAnchor="middle"
//           fill="rgba(255,255,255,0.4)" fontSize={size * 0.09} fontFamily="monospace">
//           / 100
//         </text>
//       </svg>
//       <div style={{
//         fontSize: 11, fontWeight: 700, letterSpacing: 3,
//         color: cfg.color, fontFamily: "monospace",
//         padding: "3px 10px", background: cfg.bg,
//         borderRadius: 3, marginTop: -8
//       }}>
//         {cfg.label}
//       </div>
//     </div>
//   );
// }

// // ─────────────────────────────────────────────
// // MAIN DASHBOARD
// // ─────────────────────────────────────────────

// export default function AegisAIDashboard() {
//   // ── API state ──
//   const [models, setModels] = useState([]);
//   const [governanceActions, setGovernanceActions] = useState([]);
//   const [allHistory, setAllHistory] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // ── UI state ──
//   const [selectedModel, setSelectedModel] = useState(null);
//   const [activeTab, setActiveTab] = useState("overview");
//   const [animatedScores, setAnimatedScores] = useState({});
//   const [pulseActive, setPulseActive] = useState(true);
//   const [lastRefresh, setLastRefresh] = useState(new Date());

//   // ── Derived KPIs ──
//   const avgRisk = models.length
//     ? Math.round(models.reduce((a, m) => a + m.risk_index, 0) / models.length * 10) / 10
//     : 0;
//   const criticalCount = models.filter((m) => m.risk_level === "critical").length;
//   const complianceScore = Math.round(100 - avgRisk);

//   // ── Fetch dashboard data from FastAPI ──
//   const fetchDashboard = useCallback(async () => {
//     try {
//       const [summaryRes, govRes] = await Promise.all([
//         fetch(`${API_BASE}/dashboard/summary`),
//         fetch(`${API_BASE}/governance/actions`),
//       ]);

//       if (!summaryRes.ok) throw new Error(`API error: ${summaryRes.status}`);
//       const summary = await summaryRes.json();
//       const govData = govRes.ok ? await govRes.json() : { governance_actions: [] };

//       const govActions = govData.governance_actions || [];

//       // Enrich models with derived fields the backend doesn't return directly
//       const enrichedModels = (summary.models || []).map((m) => ({
//         ...m,
//         name: m.model_id
//           .replace(/-/g, " ")
//           .replace(/\b\w/g, (c) => c.toUpperCase()),
//         type: deriveModelType(m.component_scores),
//         unit: m.unit || "AI Division",
//         status: deriveStatus(m.model_id, m.risk_level, govActions),
//       }));

//       const history = buildAllHistory(summary.risk_history || [], enrichedModels);

//       setModels(enrichedModels);
//       setGovernanceActions(govActions);
//       setAllHistory(history);
//       setLastRefresh(new Date());
//       setError(null);

//       // Keep selectedModel in sync with fresh data
//       setSelectedModel((prev) => {
//         const updated = enrichedModels.find((m) => m.model_id === prev?.model_id);
//         return updated ?? enrichedModels[0] ?? null;
//       });

//       // Animate scores
//       const targets = {};
//       enrichedModels.forEach((m) => { targets[m.model_id] = m.risk_index; });
//       const start = {};
//       enrichedModels.forEach((m) => { start[m.model_id] = 0; });
//       setAnimatedScores(start);
//       let frame = 0;
//       const total = 60;
//       const iv = setInterval(() => {
//         frame++;
//         const ease = 1 - Math.pow(1 - Math.min(1, frame / total), 3);
//         const updated = {};
//         enrichedModels.forEach((m) => {
//           updated[m.model_id] = Math.round(targets[m.model_id] * ease * 10) / 10;
//         });
//         setAnimatedScores(updated);
//         if (frame >= total) clearInterval(iv);
//       }, 20);

//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   // Initial fetch + auto-refresh every 45 seconds (matches backend evolution interval)
//   useEffect(() => {
//     fetchDashboard();
//     const t = setInterval(fetchDashboard, 45000);
//     return () => clearInterval(t);
//   }, [fetchDashboard]);

//   // Pulse interval
//   useEffect(() => {
//     const t = setInterval(() => setPulseActive((p) => !p), 1500);
//     return () => clearInterval(t);
//   }, []);

//   // Loading / error screens
//   if (loading) return (
//     <div style={{ minHeight: "100vh", background: "#030B14", display: "flex", alignItems: "center", justifyContent: "center", color: "#00C4FF", fontFamily: "monospace", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 40 }}>🛡️</div>
//       <div style={{ fontSize: 14, letterSpacing: 4 }}>AEGIS AI — CONNECTING TO API…</div>
//       <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{API_BASE}/dashboard/summary</div>
//     </div>
//   );

//   if (error) return (
//     <div style={{ minHeight: "100vh", background: "#030B14", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF3B5C", fontFamily: "monospace", flexDirection: "column", gap: 16 }}>
//       <div style={{ fontSize: 40 }}>⚠️</div>
//       <div style={{ fontSize: 14, letterSpacing: 2 }}>API CONNECTION FAILED</div>
//       <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", maxWidth: 400, textAlign: "center" }}>{error}</div>
//       <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Make sure your FastAPI backend is running at {API_BASE}</div>
//       <button onClick={fetchDashboard} style={{ marginTop: 8, padding: "8px 20px", background: "rgba(255,59,92,0.15)", border: "1px solid #FF3B5C55", color: "#FF3B5C", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
//         RETRY
//       </button>
//     </div>
//   );

//   if (!selectedModel) return null;

//   // Radar data for selected model
//   const radarData = Object.entries(selectedModel.component_scores || {}).map(([key, val]) => ({
//     metric: key.replace(/_/g, " ").replace("score", "").replace("risk", "").trim()
//       .split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
//     value: Math.round(val * 100),
//     fullMark: 100,
//   }));

//   // Heatmap cell risk level
//   const getRiskLevel = (score) =>
//     score >= 81 ? "critical" : score >= 61 ? "high" : score >= 31 ? "moderate" : "low";

//   // Forecast (simple moving average using allHistory for selected model)
//   const selectedHistory = allHistory.slice(-14).map((d) => ({
//     date: d.date,
//     actual: d[selectedModel.model_id] ?? null,
//   })).filter((d) => d.actual !== null);
//   const lastFive = selectedHistory.slice(-5).map((d) => d.actual);
//   const forecastBase = lastFive.length
//     ? lastFive.reduce((a, b) => a + b, 0) / lastFive.length
//     : selectedModel.risk_index;
//   const forecastPoints = [
//     { date: "Day +1", forecast: Math.min(100, Math.round(forecastBase * 1.02 * 10) / 10) },
//     { date: "Day +2", forecast: Math.min(100, Math.round(forecastBase * 1.04 * 10) / 10) },
//     { date: "Day +3", forecast: Math.min(100, Math.round(forecastBase * 1.06 * 10) / 10) },
//   ];

//   const styles = {
//     root: {
//       minHeight: "100vh",
//       background: "#030B14",
//       color: "#E2EBF4",
//       fontFamily: "'JetBrains Mono', 'Courier New', monospace",
//       overflow: "hidden",
//     },
//     header: {
//       background: "linear-gradient(135deg, #040E1C 0%, #071828 100%)",
//       borderBottom: "1px solid rgba(0,196,255,0.12)",
//       padding: "0 28px",
//       display: "flex",
//       alignItems: "center",
//       justifyContent: "space-between",
//       height: 64,
//       position: "sticky",
//       top: 0,
//       zIndex: 100,
//     },
//     logo: {
//       display: "flex",
//       alignItems: "center",
//       gap: 12,
//     },
//     shield: {
//       width: 36, height: 36,
//       background: "linear-gradient(135deg, #00C4FF, #7B61FF)",
//       borderRadius: 8,
//       display: "flex",
//       alignItems: "center",
//       justifyContent: "center",
//       fontSize: 18,
//       boxShadow: "0 0 20px rgba(0,196,255,0.4)",
//     },
//     logoText: {
//       fontSize: 20, fontWeight: 800,
//       background: "linear-gradient(90deg, #00C4FF, #7B61FF)",
//       WebkitBackgroundClip: "text",
//       WebkitTextFillColor: "transparent",
//       letterSpacing: 1,
//     },
//     logoSub: {
//       fontSize: 10, color: "rgba(255,255,255,0.4)",
//       letterSpacing: 2, marginTop: -2,
//     },
//     statusBar: {
//       display: "flex", alignItems: "center", gap: 20,
//     },
//     liveDot: {
//       width: 8, height: 8, borderRadius: "50%",
//       background: "#00E5A0",
//       boxShadow: pulseActive ? "0 0 0 4px rgba(0,229,160,0.3)" : "none",
//       transition: "box-shadow 0.5s",
//     },
//     liveLabel: {
//       fontSize: 10, letterSpacing: 2, color: "#00E5A0", fontWeight: 700,
//     },
//     timestamp: {
//       fontSize: 11, color: "rgba(255,255,255,0.35)",
//     },
//     layout: {
//       display: "grid",
//       gridTemplateColumns: "220px 1fr",
//       minHeight: "calc(100vh - 64px)",
//     },
//     sidebar: {
//       background: "rgba(255,255,255,0.02)",
//       borderRight: "1px solid rgba(255,255,255,0.06)",
//       padding: "20px 0",
//     },
//     sidebarTitle: {
//       fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.3)",
//       padding: "0 16px 12px",
//       textTransform: "uppercase",
//     },
//     modelRow: (isSelected, level) => ({
//       padding: "10px 16px",
//       cursor: "pointer",
//       borderLeft: `3px solid ${isSelected ? RISK_CONFIG[level].color : "transparent"}`,
//       background: isSelected ? `${RISK_CONFIG[level].bg}` : "transparent",
//       transition: "all 0.2s",
//       marginBottom: 2,
//     }),
//     modelRowName: {
//       fontSize: 11, fontWeight: 600, color: "#E2EBF4", marginBottom: 4,
//       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
//     },
//     modelRowMeta: {
//       display: "flex", alignItems: "center", justifyContent: "space-between",
//     },
//     badge: (level) => ({
//       fontSize: 9, fontWeight: 700, letterSpacing: 1,
//       color: RISK_CONFIG[level].color,
//       background: RISK_CONFIG[level].bg,
//       padding: "2px 6px", borderRadius: 3,
//     }),
//     main: {
//       overflow: "auto",
//       padding: "24px",
//       background: "#030B14",
//     },
//     statsRow: {
//       display: "grid",
//       gridTemplateColumns: "repeat(4, 1fr)",
//       gap: 16,
//       marginBottom: 24,
//     },
//     statCard: (accent) => ({
//       background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
//       border: `1px solid ${accent}22`,
//       borderRadius: 12,
//       padding: "16px 20px",
//       position: "relative",
//       overflow: "hidden",
//     }),
//     statAccentBar: (accent) => ({
//       position: "absolute", top: 0, left: 0, right: 0,
//       height: 2,
//       background: `linear-gradient(90deg, ${accent}, transparent)`,
//     }),
//     statValue: (accent) => ({
//       fontSize: 32, fontWeight: 800, color: accent, fontFamily: "monospace",
//       lineHeight: 1.1,
//     }),
//     statLabel: {
//       fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.4)",
//       marginTop: 4, textTransform: "uppercase",
//     },
//     grid2: {
//       display: "grid",
//       gridTemplateColumns: "1fr 1fr",
//       gap: 16,
//       marginBottom: 16,
//     },
//     grid3: {
//       display: "grid",
//       gridTemplateColumns: "1fr 1fr 1fr",
//       gap: 16,
//       marginBottom: 16,
//     },
//     card: {
//       background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
//       border: "1px solid rgba(255,255,255,0.08)",
//       borderRadius: 12,
//       padding: "20px",
//     },
//     cardTitle: {
//       fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.5)",
//       textTransform: "uppercase", marginBottom: 16, fontWeight: 700,
//     },
//     heatmapGrid: {
//       display: "grid",
//       gridTemplateColumns: "repeat(3, 1fr)",
//       gap: 8,
//     },
//     heatCell: (level, isSelected) => ({
//       background: RISK_CONFIG[level].bg,
//       border: `1px solid ${isSelected ? RISK_CONFIG[level].color : RISK_CONFIG[level].color + "44"}`,
//       borderRadius: 8,
//       padding: "12px",
//       cursor: "pointer",
//       transition: "all 0.2s",
//       boxShadow: isSelected ? RISK_CONFIG[level].glow : "none",
//     }),
//     heatCellName: {
//       fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 6, fontWeight: 600,
//     },
//     heatCellScore: (level) => ({
//       fontSize: 22, fontWeight: 800, color: RISK_CONFIG[level].color, fontFamily: "monospace",
//     }),
//     tabRow: {
//       display: "flex", gap: 4, marginBottom: 24,
//     },
//     tab: (isActive) => ({
//       padding: "8px 16px", borderRadius: 6, cursor: "pointer",
//       fontSize: 11, letterSpacing: 1, fontWeight: 600,
//       background: isActive ? "rgba(0,196,255,0.15)" : "transparent",
//       color: isActive ? "#00C4FF" : "rgba(255,255,255,0.4)",
//       border: isActive ? "1px solid rgba(0,196,255,0.3)" : "1px solid transparent",
//       transition: "all 0.2s",
//       textTransform: "uppercase",
//     }),
//     actionRow: (severity) => ({
//       padding: "12px 14px",
//       borderRadius: 8,
//       background: severity === "executed"
//         ? "rgba(255,255,255,0.03)"
//         : "rgba(255,140,66,0.08)",
//       border: severity === "executed"
//         ? "1px solid rgba(255,255,255,0.07)"
//         : "1px solid rgba(255,140,66,0.25)",
//       marginBottom: 8,
//     }),
//     actionHeader: {
//       display: "flex", alignItems: "center", justifyContent: "space-between",
//       marginBottom: 4,
//     },
//     actionType: {
//       fontSize: 11, fontWeight: 700, letterSpacing: 1,
//       color: "#E2EBF4",
//     },
//     actionModel: {
//       fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4,
//     },
//     actionReason: {
//       fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
//     },
//     compBar: (pct) => ({
//       height: 8, borderRadius: 4,
//       background: `linear-gradient(90deg, #00E5A0 0%, ${pct > 50 ? "#F5C842" : "#FF3B5C"} 100%)`,
//       width: `${pct}%`,
//       transition: "width 1s ease",
//     }),
//   };

//   const CustomTooltip = ({ active, payload, label }) => {
//     if (!active || !payload?.length) return null;
//     return (
//       <div style={{
//         background: "#071828", border: "1px solid rgba(0,196,255,0.2)",
//         borderRadius: 8, padding: "10px 14px", fontSize: 11,
//       }}>
//         <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>{label}</div>
//         {payload.map((p, i) => (
//           <div key={i} style={{ color: p.color, marginBottom: 2 }}>
//             {p.name}: {p.value?.toFixed(1)}
//           </div>
//         ))}
//       </div>
//     );
//   };

//   return (
//     <div style={styles.root}>
//       {/* HEADER */}
//       <header style={styles.header}>
//         <div style={styles.logo}>
//           <div style={styles.shield}>🛡️</div>
//           <div>
//             <div style={styles.logoText}>AEGIS<span style={{ opacity: 0.6 }}>AI</span></div>
//             <div style={styles.logoSub}>UNIFIED AI RISK GOVERNANCE · BANKING</div>
//           </div>
//         </div>
//         <div style={styles.statusBar}>
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             <div style={styles.liveDot} />
//             <span style={styles.liveLabel}>LIVE</span>
//           </div>
//           <div style={styles.timestamp}>
//             {lastRefresh.toLocaleTimeString()} · Auto-refresh 45s
//           </div>
//           <button
//             onClick={fetchDashboard}
//             style={{
//               fontSize: 10, color: "#00C4FF", background: "rgba(0,196,255,0.08)",
//               border: "1px solid rgba(0,196,255,0.25)", padding: "4px 10px",
//               borderRadius: 4, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace",
//             }}
//           >
//             ↺ REFRESH
//           </button>
//           <div style={{
//             fontSize: 10, color: "#00C4FF",
//             border: "1px solid rgba(0,196,255,0.3)",
//             padding: "4px 10px", borderRadius: 4, letterSpacing: 1,
//           }}>
//             SR 11-7 · ECOA · EU AI ACT
//           </div>
//         </div>
//       </header>

//       <div style={styles.layout}>
//         {/* SIDEBAR */}
//         <nav style={styles.sidebar}>
//           <div style={styles.sidebarTitle}>Model Registry</div>
//           {models.map((m) => {
//             const level = m.risk_level;
//             const animated = animatedScores[m.model_id] ?? 0;
//             return (
//               <div
//                 key={m.model_id}
//                 style={styles.modelRow(selectedModel.model_id === m.model_id, level)}
//                 onClick={() => setSelectedModel(m)}
//               >
//                 <div style={styles.modelRowName}>{m.name}</div>
//                 <div style={styles.modelRowMeta}>
//                   <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{m.unit}</span>
//                   <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//                     <span style={{ fontSize: 13, fontWeight: 800, color: RISK_CONFIG[level].color, fontFamily: "monospace" }}>
//                       {animated.toFixed(0)}
//                     </span>
//                     <span style={styles.badge(level)}>{RISK_CONFIG[level].label}</span>
//                   </div>
//                 </div>
//               </div>
//             );
//           })}

//           {/* Sidebar compliance indicator */}
//           <div style={{ padding: "20px 16px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16 }}>
//             <div style={styles.sidebarTitle}>Compliance Readiness</div>
//             <div style={{ fontSize: 22, fontWeight: 800, color: complianceScore > 60 ? "#00E5A0" : "#FF8C42", fontFamily: "monospace" }}>
//               {complianceScore}%
//             </div>
//             <div style={{
//               marginTop: 8, height: 6, borderRadius: 3,
//               background: "rgba(255,255,255,0.08)", overflow: "hidden",
//             }}>
//               <div style={{
//                 height: "100%", width: `${complianceScore}%`,
//                 background: complianceScore > 60 ? "#00E5A0" : "#FF8C42",
//                 borderRadius: 3, transition: "width 1.5s ease",
//               }} />
//             </div>
//             <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 6, letterSpacing: 1 }}>
//               PORTFOLIO COMPLIANCE
//             </div>
//           </div>
//         </nav>

//         {/* MAIN CONTENT */}
//         <main style={styles.main}>
//           {/* KPI CARDS */}
//           <div style={styles.statsRow}>
//             {[
//               { label: "Avg Risk Index", value: avgRisk, accent: avgRisk > 60 ? "#FF8C42" : "#00C4FF", suffix: "" },
//               { label: "Critical Models", value: criticalCount, accent: "#FF3B5C", suffix: "" },
//               { label: "Total Models", value: models.length, accent: "#7B61FF", suffix: "" },
//               { label: "Compliance Score", value: `${complianceScore}%`, accent: "#00E5A0", suffix: "" },
//             ].map((kpi, i) => (
//               <div key={i} style={styles.statCard(kpi.accent)}>
//                 <div style={styles.statAccentBar(kpi.accent)} />
//                 <div style={styles.statValue(kpi.accent)}>{kpi.value}</div>
//                 <div style={styles.statLabel}>{kpi.label}</div>
//               </div>
//             ))}
//           </div>

//           {/* TABS */}
//           <div style={styles.tabRow}>
//             {["overview", "heatmap", "trends", "governance", "forecast"].map((tab) => (
//               <button key={tab} style={styles.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
//                 {tab}
//               </button>
//             ))}
//           </div>

//           {/* ── OVERVIEW TAB ── */}
//           {activeTab === "overview" && (
//             <>
//               <div style={styles.grid2}>
//                 {/* Selected Model Deep Dive */}
//                 <div style={{
//                   ...styles.card,
//                   border: `1px solid ${RISK_CONFIG[selectedModel.risk_level].color}44`,
//                 }}>
//                   <div style={styles.cardTitle}>
//                     Selected Model — {selectedModel.name}
//                   </div>
//                   <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
//                     <RiskGauge value={animatedScores[selectedModel.model_id] ?? selectedModel.risk_index} />
//                     <div style={{ flex: 1 }}>
//                       <div style={{ marginBottom: 10 }}>
//                         <span style={{
//                           fontSize: 9, letterSpacing: 2,
//                           color: STATUS_CONFIG[selectedModel.status]?.color ?? "#888",
//                           background: `${STATUS_CONFIG[selectedModel.status]?.color}22`,
//                           padding: "3px 8px", borderRadius: 3, fontWeight: 700,
//                         }}>
//                           {STATUS_CONFIG[selectedModel.status]?.label} · {selectedModel.type}
//                         </span>
//                       </div>
//                       <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
//                         {selectedModel.unit}
//                       </div>
//                       {Object.entries(selectedModel.component_scores).map(([key, val]) => {
//                         const pct = Math.round(val * 100);
//                         const level = getRiskLevel(pct);
//                         return (
//                           <div key={key} style={{ marginBottom: 8 }}>
//                             <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
//                               <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>
//                                 {key.replace(/_/g, " ").toUpperCase()}
//                               </span>
//                               <span style={{ fontSize: 11, fontWeight: 700, color: RISK_CONFIG[level].color, fontFamily: "monospace" }}>
//                                 {pct}
//                               </span>
//                             </div>
//                             <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
//                               <div style={{
//                                 height: "100%", width: `${pct}%`,
//                                 background: RISK_CONFIG[level].color,
//                                 borderRadius: 3, transition: "width 1s",
//                               }} />
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   </div>
//                 </div>

//                 {/* Radar Chart */}
//                 <div style={styles.card}>
//                   <div style={styles.cardTitle}>Risk Component Radar</div>
//                   <ResponsiveContainer width="100%" height={220}>
//                     <RadarChart data={radarData}>
//                       <PolarGrid stroke="rgba(255,255,255,0.08)" />
//                       <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
//                       <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
//                       <Radar
//                         name="Risk" dataKey="value"
//                         stroke={RISK_CONFIG[selectedModel.risk_level].color}
//                         fill={RISK_CONFIG[selectedModel.risk_level].color}
//                         fillOpacity={0.2}
//                       />
//                     </RadarChart>
//                   </ResponsiveContainer>
//                 </div>
//               </div>

//               {/* Recent Governance Actions */}
//               <div style={styles.card}>
//                 <div style={styles.cardTitle}>Recent Governance Actions</div>
//                 {governanceActions.slice(0, 3).map((action) => (
//                   <div key={action.id} style={styles.actionRow(action.status)}>
//                     <div style={styles.actionHeader}>
//                       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                         <span style={{ fontSize: 16 }}>{ACTION_ICONS[action.action_type] ?? "📋"}</span>
//                         <span style={styles.actionType}>
//                           {action.action_type.replace(/_/g, " ").toUpperCase()}
//                         </span>
//                       </div>
//                       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//                         <span style={{
//                           fontSize: 9, fontWeight: 700,
//                           color: action.status === "executed" ? "#00E5A0" : "#FF8C42",
//                           background: action.status === "executed" ? "rgba(0,229,160,0.15)" : "rgba(255,140,66,0.15)",
//                           padding: "2px 8px", borderRadius: 3, letterSpacing: 1,
//                         }}>
//                           {action.status.replace(/_/g, " ").toUpperCase()}
//                         </span>
//                         <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
//                           {new Date(action.timestamp).toLocaleDateString()}
//                         </span>
//                       </div>
//                     </div>
//                     <div style={styles.actionModel}>{action.model_id} · Risk: {action.triggered_by_risk}</div>
//                     <div style={styles.actionReason}>{action.reason}</div>
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//           {/* ── HEATMAP TAB ── */}
//           {activeTab === "heatmap" && (
//             <div style={styles.card}>
//               <div style={styles.cardTitle}>Portfolio Risk Heatmap — All Models</div>
//               <div style={styles.heatmapGrid}>
//                 {models.map((m) => {
//                   const level = m.risk_level;
//                   const animated = animatedScores[m.model_id] ?? m.risk_index;
//                   return (
//                     <div
//                       key={m.model_id}
//                       style={styles.heatCell(level, selectedModel.model_id === m.model_id)}
//                       onClick={() => setSelectedModel(m)}
//                     >
//                       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
//                         <div style={styles.heatCellName}>{m.name}</div>
//                         <span style={{
//                           fontSize: 9, background: RISK_CONFIG[level].bg,
//                           color: RISK_CONFIG[level].color, padding: "2px 5px",
//                           borderRadius: 3, fontWeight: 700, letterSpacing: 1,
//                           border: `1px solid ${RISK_CONFIG[level].color}44`,
//                         }}>
//                           {m.type}
//                         </span>
//                       </div>
//                       <div style={styles.heatCellScore(level)}>{animated.toFixed(0)}</div>
//                       <div style={{ marginTop: 8, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: 2 }}>
//                         <div style={{
//                           height: "100%", width: `${animated}%`,
//                           background: RISK_CONFIG[level].color, borderRadius: 2,
//                         }} />
//                       </div>
//                       <div style={{ marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
//                         {m.unit}
//                       </div>
//                       <div style={{
//                         marginTop: 4, fontSize: 9,
//                         color: STATUS_CONFIG[m.status]?.color,
//                         fontWeight: 700, letterSpacing: 1,
//                       }}>
//                         {STATUS_CONFIG[m.status]?.label}
//                       </div>
//                       {/* Component mini-bars */}
//                       <div style={{ marginTop: 8, display: "flex", gap: 3 }}>
//                         {Object.values(m.component_scores).map((v, i) => (
//                           <div key={i} style={{
//                             flex: 1, height: 20, background: "rgba(0,0,0,0.3)",
//                             borderRadius: 2, overflow: "hidden",
//                             display: "flex", alignItems: "flex-end",
//                           }}>
//                             <div style={{
//                               width: "100%", height: `${v * 100}%`,
//                               background: RISK_CONFIG[getRiskLevel(v * 100)].color,
//                               opacity: 0.8,
//                             }} />
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>

//               {/* Legend */}
//               <div style={{ display: "flex", gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
//                 {Object.entries(RISK_CONFIG).map(([level, cfg]) => (
//                   <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
//                     <div style={{ width: 10, height: 10, borderRadius: 2, background: cfg.color }} />
//                     <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
//                       {cfg.label} ({level === "low" ? "0-30" : level === "moderate" ? "31-60" : level === "high" ? "61-80" : "81-100"})
//                     </span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           )}

//           {/* ── TRENDS TAB ── */}
//           {activeTab === "trends" && (
//             <>
//               <div style={styles.card}>
//                 <div style={styles.cardTitle}>30-Day Risk Index Trends — All Models</div>
//                 <ResponsiveContainer width="100%" height={280}>
//                   <LineChart data={allHistory.slice(-21)}>
//                     <CartesianGrid stroke="rgba(255,255,255,0.05)" />
//                     <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
//                       tickLine={false} interval={6} />
//                     <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
//                       tickLine={false} />
//                     <Tooltip content={<CustomTooltip />} />
//                     {models.map((m, i) => (
//                       <Line
//                         key={m.model_id}
//                         dataKey={m.model_id}
//                         stroke={MODEL_COLORS[i]}
//                         strokeWidth={selectedModel.model_id === m.model_id ? 2.5 : 1}
//                         dot={false}
//                         opacity={selectedModel.model_id === m.model_id ? 1 : 0.35}
//                         name={m.name}
//                       />
//                     ))}
//                     {/* Risk zone bands */}
//                     <CartesianGrid
//                       horizontalPoints={[30, 60, 80]}
//                       stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4"
//                     />
//                   </LineChart>
//                 </ResponsiveContainer>
//                 {/* Chart legend */}
//                 <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
//                   {models.map((m, i) => (
//                     <div key={m.model_id}
//                       style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
//                       onClick={() => setSelectedModel(m)}>
//                       <div style={{ width: 20, height: 2, background: MODEL_COLORS[i], borderRadius: 1 }} />
//                       <span style={{ fontSize: 10, color: selectedModel.model_id === m.model_id ? "#E2EBF4" : "rgba(255,255,255,0.4)" }}>
//                         {m.name}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             </>
//           )}

//           {/* ── GOVERNANCE TAB ── */}
//           {activeTab === "governance" && (
//             <div style={styles.card}>
//               <div style={styles.cardTitle}>Governance Actions Log — Audit Trail</div>
//               {governanceActions.map((action) => (
//                 <div key={action.id} style={{ ...styles.actionRow(action.status), padding: "14px 16px" }}>
//                   <div style={styles.actionHeader}>
//                     <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
//                       <span style={{ fontSize: 20 }}>{ACTION_ICONS[action.action_type] ?? "📋"}</span>
//                       <div>
//                         <div style={{ ...styles.actionType, fontSize: 12 }}>
//                           {action.action_type.replace(/_/g, " ").toUpperCase()}
//                         </div>
//                         <div style={styles.actionModel}>{action.model_id}</div>
//                       </div>
//                     </div>
//                     <div style={{ textAlign: "right" }}>
//                       <div style={{
//                         fontSize: 9, fontWeight: 700,
//                         color: action.status === "executed" ? "#00E5A0" : "#FF8C42",
//                         background: action.status === "executed" ? "rgba(0,229,160,0.15)" : "rgba(255,140,66,0.15)",
//                         padding: "3px 10px", borderRadius: 3, letterSpacing: 1, marginBottom: 4,
//                       }}>
//                         {action.status.replace(/_/g, " ").toUpperCase()}
//                       </div>
//                       <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
//                         {new Date(action.timestamp).toLocaleString()}
//                       </div>
//                     </div>
//                   </div>
//                   <div style={{ ...styles.actionReason, marginTop: 8 }}>{action.reason}</div>
//                   <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
//                     <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
//                       Risk at trigger: <span style={{ color: "#FF8C42", fontWeight: 700 }}>{action.triggered_by_risk}</span>
//                     </span>
//                     <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
//                       ID: EVT-{action.id.toString().padStart(6, "0")}
//                     </span>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* ── FORECAST TAB ── */}
//           {activeTab === "forecast" && (
//             <>
//               <div style={styles.grid2}>
//                 <div style={styles.card}>
//                   <div style={styles.cardTitle}>{selectedModel.name} — 14-Day History + Forecast</div>
//                   <ResponsiveContainer width="100%" height={220}>
//                     <AreaChart data={[
//                       ...selectedHistory.map((d) => ({ ...d, type: "actual" })),
//                       ...forecastPoints.map((d) => ({ date: d.date, actual: null, forecast: d.forecast }))
//                     ]}>
//                       <defs>
//                         <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
//                           <stop offset="0%" stopColor={RISK_CONFIG[selectedModel.risk_level].color} stopOpacity={0.3} />
//                           <stop offset="100%" stopColor={RISK_CONFIG[selectedModel.risk_level].color} stopOpacity={0} />
//                         </linearGradient>
//                         <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
//                           <stop offset="0%" stopColor="#7B61FF" stopOpacity={0.3} />
//                           <stop offset="100%" stopColor="#7B61FF" stopOpacity={0} />
//                         </linearGradient>
//                       </defs>
//                       <CartesianGrid stroke="rgba(255,255,255,0.05)" />
//                       <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} interval={3} />
//                       <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} />
//                       <Tooltip content={<CustomTooltip />} />
//                       <Area dataKey="actual" stroke={RISK_CONFIG[selectedModel.risk_level].color}
//                         fill="url(#areaGrad)" strokeWidth={2} dot={false} name="Actual Risk" connectNulls />
//                       <Area dataKey="forecast" stroke="#7B61FF" fill="url(#forecastGrad)"
//                         strokeWidth={2} strokeDasharray="5 3" dot={false} name="Forecast" />
//                     </AreaChart>
//                   </ResponsiveContainer>
//                 </div>
//                 <div style={styles.card}>
//                   <div style={styles.cardTitle}>Forecast Summary</div>
//                   <div style={{ marginBottom: 20 }}>
//                     <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Trend Direction</div>
//                     <div style={{ fontSize: 18, fontWeight: 800, color: "#F5C842" }}>
//                       ↗ INCREASING
//                     </div>
//                   </div>
//                   <div style={{ marginBottom: 20 }}>
//                     <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Next 3 Days Forecast</div>
//                     {forecastPoints.map((p, i) => (
//                       <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
//                         <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{p.date}</span>
//                         <span style={{
//                           fontSize: 12, fontWeight: 700, fontFamily: "monospace",
//                           color: RISK_CONFIG[getRiskLevel(p.forecast)].color,
//                         }}>{p.forecast}</span>
//                       </div>
//                     ))}
//                   </div>
//                   <div>
//                     <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Spike Risk (next 72h)</div>
//                     <div style={{
//                       fontSize: 13, fontWeight: 700,
//                       color: selectedModel.risk_index > 60 ? "#FF8C42" : "#F5C842",
//                     }}>
//                       {selectedModel.risk_index > 70 ? "🔴 HIGH" : selectedModel.risk_index > 40 ? "🟡 MODERATE" : "🟢 LOW"}
//                     </div>
//                   </div>
//                 </div>
//               </div>

//               {/* Portfolio Bar Chart */}
//               <div style={styles.card}>
//                 <div style={styles.cardTitle}>Portfolio Risk Distribution</div>
//                 <ResponsiveContainer width="100%" height={180}>
//                   <BarChart data={models.map((m) => ({
//                     name: m.name.split(" ").slice(0, 2).join(" "),
//                     risk: animatedScores[m.model_id] ?? m.risk_index,
//                     level: m.risk_level,
//                   }))}>
//                     <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
//                     <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} />
//                     <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} />
//                     <Tooltip content={<CustomTooltip />} />
//                     <Bar dataKey="risk" radius={[4, 4, 0, 0]} name="Risk Index">
//                       {models.map((m, i) => (
//                         <Cell key={m.model_id} fill={RISK_CONFIG[m.risk_level].color} opacity={0.85} />
//                       ))}
//                     </Bar>
//                   </BarChart>
//                 </ResponsiveContainer>
//               </div>
//             </>
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }
import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Cell
} from "recharts";

// ─────────────────────────────────────────────
// API CONFIG — point this at your FastAPI server
// ─────────────────────────────────────────────

const API_BASE = "https://aegisai-ta6m.onrender.com";

// Helper: derive a display-friendly "status" from governance actions + risk level
function deriveStatus(modelId, riskLevel, governanceActions) {
  const modelActions = (governanceActions || []).filter((a) => a.model_id === modelId);
  if (modelActions.some((a) => a.action_type === "freeze_model")) return "frozen";
  if (modelActions.some((a) => a.action_type === "escalate_to_human")) return "escalated";
  if (riskLevel === "moderate" || riskLevel === "high") return "monitoring";
  return "active";
}

// Helper: derive model type from component_scores keys
function deriveModelType(componentScores) {
  const keys = Object.keys(componentScores || {});
  return keys.some((k) => ["hallucination_score", "toxicity_score", "prompt_injection_risk", "data_leakage_risk"].includes(k))
    ? "LLM"
    : "ML";
}

// Helper: build merged risk history for multi-line trends chart
function buildAllHistory(riskHistory, models) {
  if (!riskHistory?.length || !models?.length) return [];
  // Group history by date bucket (per-day last value per model)
  const byDate = {};
  riskHistory.forEach(({ model_id, risk_index, timestamp }) => {
    const date = new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (!byDate[date]) byDate[date] = { date };
    byDate[date][model_id] = Math.round(risk_index * 10) / 10;
  });
  return Object.values(byDate).slice(-31);
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const RISK_CONFIG = {
  critical: { color: "#FF3B5C", bg: "rgba(255,59,92,0.15)", label: "CRITICAL", glow: "0 0 12px #FF3B5C66" },
  high: { color: "#FF8C42", bg: "rgba(255,140,66,0.15)", label: "HIGH", glow: "0 0 12px #FF8C4266" },
  moderate: { color: "#F5C842", bg: "rgba(245,200,66,0.15)", label: "MODERATE", glow: "0 0 12px #F5C84266" },
  low: { color: "#00E5A0", bg: "rgba(0,229,160,0.15)", label: "LOW", glow: "0 0 12px #00E5A066" },
};

const MODEL_COLORS = ["#7B61FF", "#00C4FF", "#FF6B9D", "#00E5A0", "#FF8C42", "#F5C842"];

const STATUS_CONFIG = {
  frozen: { label: "FROZEN", color: "#FF3B5C" },
  escalated: { label: "ESCALATED", color: "#FF8C42" },
  monitoring: { label: "MONITORING", color: "#F5C842" },
  active: { label: "ACTIVE", color: "#00E5A0" },
};

const ACTION_ICONS = {
  freeze_model: "⛔",
  escalate_to_human: "🚨",
  enable_strict_filtering: "🛡️",
  send_alert: "⚠️",
  trigger_retraining: "🔄",
};

// ─────────────────────────────────────────────
// RISK GAUGE COMPONENT
// ─────────────────────────────────────────────

function RiskGauge({ value, size = 140 }) {
  const level = value >= 81 ? "critical" : value >= 61 ? "high" : value >= 31 ? "moderate" : "low";
  const cfg = RISK_CONFIG[level];
  const angle = (value / 100) * 180 - 180;
  const cx = size / 2, cy = size * 0.62;
  const r = size * 0.38;

  const arcPath = (startDeg, endDeg, color, opacity = 1) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const x1 = cx + r * Math.cos(toRad(startDeg));
    const y1 = cy + r * Math.sin(toRad(startDeg));
    const x2 = cx + r * Math.cos(toRad(endDeg));
    const y2 = cy + r * Math.sin(toRad(endDeg));
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return (
      <path
        d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
        opacity={opacity}
      />
    );
  };

  // Needle
  const needleAngle = (value / 100) * 180 - 180;
  const nx = cx + (r - size * 0.05) * Math.cos((needleAngle * Math.PI) / 180);
  const ny = cy + (r - size * 0.05) * Math.sin((needleAngle * Math.PI) / 180);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={size} height={size * 0.75}>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {arcPath(-180, -90, "#1A3040", 0.5)}
        {arcPath(-90, 0, "#1A3040", 0.5)}
        {arcPath(-180, -108, "#00E5A0", 0.9)}
        {arcPath(-108, -54, "#F5C842", 0.9)}
        {arcPath(-54, -18, "#FF8C42", 0.9)}
        {arcPath(-18, 0, "#FF3B5C", 0.9)}
        {arcPath(-180, angle, cfg.color)}
        <line
          x1={cx} y1={cy}
          x2={nx} y2={ny}
          stroke={cfg.color}
          strokeWidth={size * 0.025}
          strokeLinecap="round"
          filter="url(#glow)"
        />
        <circle cx={cx} cy={cy} r={size * 0.04} fill={cfg.color} />
        <text x={cx} y={cy - size * 0.1} textAnchor="middle" fill={cfg.color}
          fontSize={size * 0.22} fontWeight="800" fontFamily="'Courier New', monospace">
          {Math.round(value)}
        </text>
        <text x={cx} y={cy - size * 0.28} textAnchor="middle"
          fill="rgba(255,255,255,0.4)" fontSize={size * 0.09} fontFamily="monospace">
          / 100
        </text>
      </svg>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 3,
        color: cfg.color, fontFamily: "monospace",
        padding: "3px 10px", background: cfg.bg,
        borderRadius: 3, marginTop: -8
      }}>
        {cfg.label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────

export default function AegisAIDashboard() {
  // ── API state ──
  const [models, setModels] = useState([]);
  const [governanceActions, setGovernanceActions] = useState([]);
  const [allHistory, setAllHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── UI state ──
  const [selectedModel, setSelectedModel] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [animatedScores, setAnimatedScores] = useState({});
  const [pulseActive, setPulseActive] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Derived KPIs ──
  const avgRisk = models.length
    ? Math.round(models.reduce((a, m) => a + m.risk_index, 0) / models.length * 10) / 10
    : 0;
  const criticalCount = models.filter((m) => m.risk_level === "critical").length;
  const complianceScore = Math.round(100 - avgRisk);

  // ── Fetch dashboard data from FastAPI ──
  const fetchDashboard = useCallback(async () => {
    try {
      const [summaryRes, govRes] = await Promise.all([
        fetch(`${API_BASE}/dashboard/summary`),
        fetch(`${API_BASE}/governance/actions`),
      ]);

      if (!summaryRes.ok) throw new Error(`API error: ${summaryRes.status}`);
      const summary = await summaryRes.json();
      const govData = govRes.ok ? await govRes.json() : { governance_actions: [] };

      const govActions = govData.governance_actions || [];

      // Enrich models with derived fields the backend doesn't return directly
      const enrichedModels = (summary.models || []).map((m) => ({
        ...m,
        name: m.model_id
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        type: deriveModelType(m.component_scores),
        unit: m.unit || "AI Division",
        status: deriveStatus(m.model_id, m.risk_level, govActions),
      }));

      const history = buildAllHistory(summary.risk_history || [], enrichedModels);

      setModels(enrichedModels);
      setGovernanceActions(govActions);
      setAllHistory(history);
      setLastRefresh(new Date());
      setError(null);

      // Keep selectedModel in sync with fresh data
      setSelectedModel((prev) => {
        const updated = enrichedModels.find((m) => m.model_id === prev?.model_id);
        return updated ?? enrichedModels[0] ?? null;
      });

      // Animate scores
      const targets = {};
      enrichedModels.forEach((m) => { targets[m.model_id] = m.risk_index; });
      const start = {};
      enrichedModels.forEach((m) => { start[m.model_id] = 0; });
      setAnimatedScores(start);
      let frame = 0;
      const total = 60;
      const iv = setInterval(() => {
        frame++;
        const ease = 1 - Math.pow(1 - Math.min(1, frame / total), 3);
        const updated = {};
        enrichedModels.forEach((m) => {
          updated[m.model_id] = Math.round(targets[m.model_id] * ease * 10) / 10;
        });
        setAnimatedScores(updated);
        if (frame >= total) clearInterval(iv);
      }, 20);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 45 seconds (matches backend evolution interval)
  useEffect(() => {
    fetchDashboard();
    const t = setInterval(fetchDashboard, 45000);
    return () => clearInterval(t);
  }, [fetchDashboard]);

  // Pulse interval
  useEffect(() => {
    const t = setInterval(() => setPulseActive((p) => !p), 1500);
    return () => clearInterval(t);
  }, []);

  // Loading / error screens
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#030B14", display: "flex", alignItems: "center", justifyContent: "center", color: "#00C4FF", fontFamily: "monospace", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🛡️</div>
      <div style={{ fontSize: 14, letterSpacing: 4 }}>AEGIS AI — CONNECTING TO API…</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{API_BASE}/dashboard/summary</div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "#030B14", display: "flex", alignItems: "center", justifyContent: "center", color: "#FF3B5C", fontFamily: "monospace", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontSize: 14, letterSpacing: 2 }}>API CONNECTION FAILED</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", maxWidth: 400, textAlign: "center" }}>{error}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Make sure your FastAPI backend is running at {API_BASE}</div>
      <button onClick={fetchDashboard} style={{ marginTop: 8, padding: "8px 20px", background: "rgba(255,59,92,0.15)", border: "1px solid #FF3B5C55", color: "#FF3B5C", borderRadius: 6, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
        RETRY
      </button>
    </div>
  );

  if (!selectedModel) return null;

  // Radar data for selected model
  const radarData = Object.entries(selectedModel.component_scores || {}).map(([key, val]) => ({
    metric: key.replace(/_/g, " ").replace("score", "").replace("risk", "").trim()
      .split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    value: Math.round(val * 100),
    fullMark: 100,
  }));

  // Heatmap cell risk level
  const getRiskLevel = (score) =>
    score >= 81 ? "critical" : score >= 61 ? "high" : score >= 31 ? "moderate" : "low";

  // Forecast (simple moving average using allHistory for selected model)
  const selectedHistory = allHistory.slice(-14).map((d) => ({
    date: d.date,
    actual: d[selectedModel.model_id] ?? null,
  })).filter((d) => d.actual !== null);
  const lastFive = selectedHistory.slice(-5).map((d) => d.actual);
  const forecastBase = lastFive.length
    ? lastFive.reduce((a, b) => a + b, 0) / lastFive.length
    : selectedModel.risk_index;
  const forecastPoints = [
    { date: "Day +1", forecast: Math.min(100, Math.round(forecastBase * 1.02 * 10) / 10) },
    { date: "Day +2", forecast: Math.min(100, Math.round(forecastBase * 1.04 * 10) / 10) },
    { date: "Day +3", forecast: Math.min(100, Math.round(forecastBase * 1.06 * 10) / 10) },
  ];

  const styles = {
    root: {
      minHeight: "100vh",
      background: "#030B14",
      color: "#E2EBF4",
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      overflow: "hidden",
    },
    header: {
      background: "linear-gradient(135deg, #040E1C 0%, #071828 100%)",
      borderBottom: "1px solid rgba(0,196,255,0.12)",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 64,
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    logo: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    shield: {
      width: 36, height: 36,
      background: "linear-gradient(135deg, #00C4FF, #7B61FF)",
      borderRadius: 8,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      boxShadow: "0 0 20px rgba(0,196,255,0.4)",
    },
    logoText: {
      fontSize: 20, fontWeight: 800,
      background: "linear-gradient(90deg, #00C4FF, #7B61FF)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: 1,
    },
    logoSub: {
      fontSize: 10, color: "rgba(255,255,255,0.4)",
      letterSpacing: 2, marginTop: -2,
    },
    statusBar: {
      display: "flex", alignItems: "center", gap: 20,
    },
    liveDot: {
      width: 8, height: 8, borderRadius: "50%",
      background: "#00E5A0",
      boxShadow: pulseActive ? "0 0 0 4px rgba(0,229,160,0.3)" : "none",
      transition: "box-shadow 0.5s",
    },
    liveLabel: {
      fontSize: 10, letterSpacing: 2, color: "#00E5A0", fontWeight: 700,
    },
    timestamp: {
      fontSize: 11, color: "rgba(255,255,255,0.35)",
    },
    layout: {
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      minHeight: "calc(100vh - 64px)",
    },
    sidebar: {
      background: "rgba(255,255,255,0.02)",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      padding: "20px 0",
    },
    sidebarTitle: {
      fontSize: 9, letterSpacing: 3, color: "rgba(255,255,255,0.3)",
      padding: "0 16px 12px",
      textTransform: "uppercase",
    },
    modelRow: (isSelected, level) => ({
      padding: "10px 16px",
      cursor: "pointer",
      borderLeft: `3px solid ${isSelected ? RISK_CONFIG[level].color : "transparent"}`,
      background: isSelected ? `${RISK_CONFIG[level].bg}` : "transparent",
      transition: "all 0.2s",
      marginBottom: 2,
    }),
    modelRowName: {
      fontSize: 11, fontWeight: 600, color: "#E2EBF4", marginBottom: 4,
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    },
    modelRowMeta: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    badge: (level) => ({
      fontSize: 9, fontWeight: 700, letterSpacing: 1,
      color: RISK_CONFIG[level].color,
      background: RISK_CONFIG[level].bg,
      padding: "2px 6px", borderRadius: 3,
    }),
    main: {
      overflow: "auto",
      padding: "24px",
      background: "#030B14",
    },
    statsRow: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 16,
      marginBottom: 24,
    },
    statCard: (accent) => ({
      background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
      border: `1px solid ${accent}22`,
      borderRadius: 12,
      padding: "16px 20px",
      position: "relative",
      overflow: "hidden",
    }),
    statAccentBar: (accent) => ({
      position: "absolute", top: 0, left: 0, right: 0,
      height: 2,
      background: `linear-gradient(90deg, ${accent}, transparent)`,
    }),
    statValue: (accent) => ({
      fontSize: 32, fontWeight: 800, color: accent, fontFamily: "monospace",
      lineHeight: 1.1,
    }),
    statLabel: {
      fontSize: 10, letterSpacing: 2, color: "rgba(255,255,255,0.4)",
      marginTop: 4, textTransform: "uppercase",
    },
    grid2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginBottom: 16,
    },
    grid3: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 16,
      marginBottom: 16,
    },
    card: {
      background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "20px",
    },
    cardTitle: {
      fontSize: 11, letterSpacing: 2, color: "rgba(255,255,255,0.5)",
      textTransform: "uppercase", marginBottom: 16, fontWeight: 700,
    },
    heatmapGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 8,
    },
    heatCell: (level, isSelected) => ({
      background: RISK_CONFIG[level].bg,
      border: `1px solid ${isSelected ? RISK_CONFIG[level].color : RISK_CONFIG[level].color + "44"}`,
      borderRadius: 8,
      padding: "12px",
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: isSelected ? RISK_CONFIG[level].glow : "none",
    }),
    heatCellName: {
      fontSize: 10, color: "rgba(255,255,255,0.7)", marginBottom: 6, fontWeight: 600,
    },
    heatCellScore: (level) => ({
      fontSize: 22, fontWeight: 800, color: RISK_CONFIG[level].color, fontFamily: "monospace",
    }),
    tabRow: {
      display: "flex", gap: 4, marginBottom: 24,
    },
    tab: (isActive) => ({
      padding: "8px 16px", borderRadius: 6, cursor: "pointer",
      fontSize: 11, letterSpacing: 1, fontWeight: 600,
      background: isActive ? "rgba(0,196,255,0.15)" : "transparent",
      color: isActive ? "#00C4FF" : "rgba(255,255,255,0.4)",
      border: isActive ? "1px solid rgba(0,196,255,0.3)" : "1px solid transparent",
      transition: "all 0.2s",
      textTransform: "uppercase",
    }),
    actionRow: (severity) => ({
      padding: "12px 14px",
      borderRadius: 8,
      background: severity === "executed"
        ? "rgba(255,255,255,0.03)"
        : "rgba(255,140,66,0.08)",
      border: severity === "executed"
        ? "1px solid rgba(255,255,255,0.07)"
        : "1px solid rgba(255,140,66,0.25)",
      marginBottom: 8,
    }),
    actionHeader: {
      display: "flex", alignItems: "center", justifyContent: "space-between",
      marginBottom: 4,
    },
    actionType: {
      fontSize: 11, fontWeight: 700, letterSpacing: 1,
      color: "#E2EBF4",
    },
    actionModel: {
      fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 4,
    },
    actionReason: {
      fontSize: 11, color: "rgba(255,255,255,0.6)", lineHeight: 1.5,
    },
    compBar: (pct) => ({
      height: 8, borderRadius: 4,
      background: `linear-gradient(90deg, #00E5A0 0%, ${pct > 50 ? "#F5C842" : "#FF3B5C"} 100%)`,
      width: `${pct}%`,
      transition: "width 1s ease",
    }),
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "#071828", border: "1px solid rgba(0,196,255,0.2)",
        borderRadius: 8, padding: "10px 14px", fontSize: 11,
      }}>
        <div style={{ color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: {p.value?.toFixed(1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.root}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.shield}>🛡️</div>
          <div>
            <div style={styles.logoText}>AEGIS<span style={{ opacity: 0.6 }}>AI</span></div>
            <div style={styles.logoSub}>UNIFIED AI RISK GOVERNANCE · BANKING</div>
          </div>
        </div>
        <div style={styles.statusBar}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={styles.liveDot} />
            <span style={styles.liveLabel}>LIVE</span>
          </div>
          <div style={styles.timestamp}>
            {lastRefresh.toLocaleTimeString()} · Auto-refresh 45s
          </div>
          <button
            onClick={fetchDashboard}
            style={{
              fontSize: 10, color: "#00C4FF", background: "rgba(0,196,255,0.08)",
              border: "1px solid rgba(0,196,255,0.25)", padding: "4px 10px",
              borderRadius: 4, letterSpacing: 1, cursor: "pointer", fontFamily: "monospace",
            }}
          >
            ↺ REFRESH
          </button>
          <div style={{
            fontSize: 10, color: "#00C4FF",
            border: "1px solid rgba(0,196,255,0.3)",
            padding: "4px 10px", borderRadius: 4, letterSpacing: 1,
          }}>
            SR 11-7 · ECOA · EU AI ACT
          </div>
        </div>
      </header>

      <div style={styles.layout}>
        {/* SIDEBAR - UPDATED WITH SEPARATE ML/LLM SECTIONS */}
        <nav style={styles.sidebar}>
          {/* Traditional ML Models */}
          <div style={styles.sidebarTitle}>📊 TRADITIONAL ML</div>
          {models.filter(m => m.type === 'ML').map((m) => {
            const level = m.risk_level;
            const animated = animatedScores[m.model_id] ?? 0;
            return (
              <div
                key={m.model_id}
                style={styles.modelRow(selectedModel.model_id === m.model_id, level)}
                onClick={() => setSelectedModel(m)}
              >
                <div style={styles.modelRowName}>{m.name}</div>
                <div style={styles.modelRowMeta}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{m.unit}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: RISK_CONFIG[level].color, fontFamily: "monospace" }}>
                      {animated.toFixed(0)}
                    </span>
                    <span style={styles.badge(level)}>{RISK_CONFIG[level].label}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* LLM Systems */}
          <div style={{ ...styles.sidebarTitle, marginTop: 20 }}>🤖 LLM SYSTEMS</div>
          {models.filter(m => m.type === 'LLM').map((m) => {
            const level = m.risk_level;
            const animated = animatedScores[m.model_id] ?? 0;
            return (
              <div
                key={m.model_id}
                style={styles.modelRow(selectedModel.model_id === m.model_id, level)}
                onClick={() => setSelectedModel(m)}
              >
                <div style={styles.modelRowName}>{m.name}</div>
                <div style={styles.modelRowMeta}>
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{m.unit}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: RISK_CONFIG[level].color, fontFamily: "monospace" }}>
                      {animated.toFixed(0)}
                    </span>
                    <span style={styles.badge(level)}>{RISK_CONFIG[level].label}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Sidebar compliance indicator */}
          <div style={{ padding: "20px 16px 0", borderTop: "1px solid rgba(255,255,255,0.06)", marginTop: 16 }}>
            <div style={styles.sidebarTitle}>Compliance Readiness</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: complianceScore > 60 ? "#00E5A0" : "#FF8C42", fontFamily: "monospace" }}>
              {complianceScore}%
            </div>
            <div style={{
              marginTop: 8, height: 6, borderRadius: 3,
              background: "rgba(255,255,255,0.08)", overflow: "hidden",
            }}>
              <div style={{
                height: "100%", width: `${complianceScore}%`,
                background: complianceScore > 60 ? "#00E5A0" : "#FF8C42",
                borderRadius: 3, transition: "width 1.5s ease",
              }} />
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 6, letterSpacing: 1 }}>
              PORTFOLIO COMPLIANCE
            </div>
          </div>
        </nav>

        {/* MAIN CONTENT */}
        <main style={styles.main}>
          {/* KPI CARDS */}
          <div style={styles.statsRow}>
            {[
              { label: "Avg Risk Index", value: avgRisk, accent: avgRisk > 60 ? "#FF8C42" : "#00C4FF", suffix: "" },
              { label: "Critical Models", value: criticalCount, accent: "#FF3B5C", suffix: "" },
              { label: "Total Models", value: models.length, accent: "#7B61FF", suffix: "" },
              { label: "Compliance Score", value: `${complianceScore}%`, accent: "#00E5A0", suffix: "" },
            ].map((kpi, i) => (
              <div key={i} style={styles.statCard(kpi.accent)}>
                <div style={styles.statAccentBar(kpi.accent)} />
                <div style={styles.statValue(kpi.accent)}>{kpi.value}</div>
                <div style={styles.statLabel}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* TABS */}
          <div style={styles.tabRow}>
            {["overview", "heatmap", "trends", "governance", "forecast"].map((tab) => (
              <button key={tab} style={styles.tab(activeTab === tab)} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === "overview" && (
            <>
              <div style={styles.grid2}>
                {/* Selected Model Deep Dive */}
                <div style={{
                  ...styles.card,
                  border: `1px solid ${RISK_CONFIG[selectedModel.risk_level].color}44`,
                }}>
                  <div style={styles.cardTitle}>
                    Selected Model — {selectedModel.name}
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
                    <RiskGauge value={animatedScores[selectedModel.model_id] ?? selectedModel.risk_index} />
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 10 }}>
                        <span style={{
                          fontSize: 9, letterSpacing: 2,
                          color: STATUS_CONFIG[selectedModel.status]?.color ?? "#888",
                          background: `${STATUS_CONFIG[selectedModel.status]?.color}22`,
                          padding: "3px 8px", borderRadius: 3, fontWeight: 700,
                        }}>
                          {STATUS_CONFIG[selectedModel.status]?.label} · {selectedModel.type}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
                        {selectedModel.unit}
                      </div>
                      {Object.entries(selectedModel.component_scores).map(([key, val]) => {
                        const pct = Math.round(val * 100);
                        const level = getRiskLevel(pct);
                        return (
                          <div key={key} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", letterSpacing: 0.5 }}>
                                {key.replace(/_/g, " ").toUpperCase()}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: RISK_CONFIG[level].color, fontFamily: "monospace" }}>
                                {pct}
                              </span>
                            </div>
                            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
                              <div style={{
                                height: "100%", width: `${pct}%`,
                                background: RISK_CONFIG[level].color,
                                borderRadius: 3, transition: "width 1s",
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Radar Chart */}
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Risk Component Radar</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.08)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                      <Radar
                        name="Risk" dataKey="value"
                        stroke={RISK_CONFIG[selectedModel.risk_level].color}
                        fill={RISK_CONFIG[selectedModel.risk_level].color}
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Governance Actions */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>Recent Governance Actions</div>
                {governanceActions.slice(0, 3).map((action) => (
                  <div key={action.id} style={styles.actionRow(action.status)}>
                    <div style={styles.actionHeader}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{ACTION_ICONS[action.action_type] ?? "📋"}</span>
                        <span style={styles.actionType}>
                          {action.action_type.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700,
                          color: action.status === "executed" ? "#00E5A0" : "#FF8C42",
                          background: action.status === "executed" ? "rgba(0,229,160,0.15)" : "rgba(255,140,66,0.15)",
                          padding: "2px 8px", borderRadius: 3, letterSpacing: 1,
                        }}>
                          {action.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                          {new Date(action.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div style={styles.actionModel}>{action.model_id} · Risk: {action.triggered_by_risk}</div>
                    <div style={styles.actionReason}>{action.reason}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── HEATMAP TAB ── */}
          {activeTab === "heatmap" && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Portfolio Risk Heatmap — All Models</div>
              <div style={styles.heatmapGrid}>
                {models.map((m) => {
                  const level = m.risk_level;
                  const animated = animatedScores[m.model_id] ?? m.risk_index;
                  return (
                    <div
                      key={m.model_id}
                      style={styles.heatCell(level, selectedModel.model_id === m.model_id)}
                      onClick={() => setSelectedModel(m)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={styles.heatCellName}>{m.name}</div>
                        <span style={{
                          fontSize: 9, background: RISK_CONFIG[level].bg,
                          color: RISK_CONFIG[level].color, padding: "2px 5px",
                          borderRadius: 3, fontWeight: 700, letterSpacing: 1,
                          border: `1px solid ${RISK_CONFIG[level].color}44`,
                        }}>
                          {m.type}
                        </span>
                      </div>
                      <div style={styles.heatCellScore(level)}>{animated.toFixed(0)}</div>
                      <div style={{ marginTop: 8, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: 2 }}>
                        <div style={{
                          height: "100%", width: `${animated}%`,
                          background: RISK_CONFIG[level].color, borderRadius: 2,
                        }} />
                      </div>
                      <div style={{ marginTop: 6, fontSize: 9, color: "rgba(255,255,255,0.4)" }}>
                        {m.unit}
                      </div>
                      <div style={{
                        marginTop: 4, fontSize: 9,
                        color: STATUS_CONFIG[m.status]?.color,
                        fontWeight: 700, letterSpacing: 1,
                      }}>
                        {STATUS_CONFIG[m.status]?.label}
                      </div>
                      {/* Component mini-bars */}
                      <div style={{ marginTop: 8, display: "flex", gap: 3 }}>
                        {Object.values(m.component_scores).map((v, i) => (
                          <div key={i} style={{
                            flex: 1, height: 20, background: "rgba(0,0,0,0.3)",
                            borderRadius: 2, overflow: "hidden",
                            display: "flex", alignItems: "flex-end",
                          }}>
                            <div style={{
                              width: "100%", height: `${v * 100}%`,
                              background: RISK_CONFIG[getRiskLevel(v * 100)].color,
                              opacity: 0.8,
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {Object.entries(RISK_CONFIG).map(([level, cfg]) => (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: cfg.color }} />
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                      {cfg.label} ({level === "low" ? "0-30" : level === "moderate" ? "31-60" : level === "high" ? "61-80" : "81-100"})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRENDS TAB ── */}
          {activeTab === "trends" && (
            <>
              <div style={styles.card}>
                <div style={styles.cardTitle}>30-Day Risk Index Trends — All Models</div>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={allHistory.slice(-21)}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      tickLine={false} interval={6} />
                    <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                      tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {models.map((m, i) => (
                      <Line
                        key={m.model_id}
                        dataKey={m.model_id}
                        stroke={MODEL_COLORS[i]}
                        strokeWidth={selectedModel.model_id === m.model_id ? 2.5 : 1}
                        dot={false}
                        opacity={selectedModel.model_id === m.model_id ? 1 : 0.35}
                        name={m.name}
                      />
                    ))}
                    {/* Risk zone bands */}
                    <CartesianGrid
                      horizontalPoints={[30, 60, 80]}
                      stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4"
                    />
                  </LineChart>
                </ResponsiveContainer>
                {/* Chart legend */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
                  {models.map((m, i) => (
                    <div key={m.model_id}
                      style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                      onClick={() => setSelectedModel(m)}>
                      <div style={{ width: 20, height: 2, background: MODEL_COLORS[i], borderRadius: 1 }} />
                      <span style={{ fontSize: 10, color: selectedModel.model_id === m.model_id ? "#E2EBF4" : "rgba(255,255,255,0.4)" }}>
                        {m.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── GOVERNANCE TAB ── */}
          {activeTab === "governance" && (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Governance Actions Log — Audit Trail</div>
              {governanceActions.map((action) => (
                <div key={action.id} style={{ ...styles.actionRow(action.status), padding: "14px 16px" }}>
                  <div style={styles.actionHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{ACTION_ICONS[action.action_type] ?? "📋"}</span>
                      <div>
                        <div style={{ ...styles.actionType, fontSize: 12 }}>
                          {action.action_type.replace(/_/g, " ").toUpperCase()}
                        </div>
                        <div style={styles.actionModel}>{action.model_id}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontSize: 9, fontWeight: 700,
                        color: action.status === "executed" ? "#00E5A0" : "#FF8C42",
                        background: action.status === "executed" ? "rgba(0,229,160,0.15)" : "rgba(255,140,66,0.15)",
                        padding: "3px 10px", borderRadius: 3, letterSpacing: 1, marginBottom: 4,
                      }}>
                        {action.status.replace(/_/g, " ").toUpperCase()}
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div style={{ ...styles.actionReason, marginTop: 8 }}>{action.reason}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 12 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                      Risk at trigger: <span style={{ color: "#FF8C42", fontWeight: 700 }}>{action.triggered_by_risk}</span>
                    </span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                      ID: EVT-{action.id.toString().padStart(6, "0")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── FORECAST TAB ── */}
          {activeTab === "forecast" && (
            <>
              <div style={styles.grid2}>
                <div style={styles.card}>
                  <div style={styles.cardTitle}>{selectedModel.name} — 14-Day History + Forecast</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={[
                      ...selectedHistory.map((d) => ({ ...d, type: "actual" })),
                      ...forecastPoints.map((d) => ({ date: d.date, actual: null, forecast: d.forecast }))
                    ]}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={RISK_CONFIG[selectedModel.risk_level].color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={RISK_CONFIG[selectedModel.risk_level].color} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7B61FF" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#7B61FF" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} interval={3} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area dataKey="actual" stroke={RISK_CONFIG[selectedModel.risk_level].color}
                        fill="url(#areaGrad)" strokeWidth={2} dot={false} name="Actual Risk" connectNulls />
                      <Area dataKey="forecast" stroke="#7B61FF" fill="url(#forecastGrad)"
                        strokeWidth={2} strokeDasharray="5 3" dot={false} name="Forecast" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={styles.card}>
                  <div style={styles.cardTitle}>Forecast Summary</div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Trend Direction</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#F5C842" }}>
                      ↗ INCREASING
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Next 3 Days Forecast</div>
                    {forecastPoints.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{p.date}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, fontFamily: "monospace",
                          color: RISK_CONFIG[getRiskLevel(p.forecast)].color,
                        }}>{p.forecast}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Spike Risk (next 72h)</div>
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: selectedModel.risk_index > 60 ? "#FF8C42" : "#F5C842",
                    }}>
                      {selectedModel.risk_index > 70 ? "🔴 HIGH" : selectedModel.risk_index > 40 ? "🟡 MODERATE" : "🟢 LOW"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Portfolio Bar Chart */}
              <div style={styles.card}>
                <div style={styles.cardTitle}>Portfolio Risk Distribution</div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={models.map((m) => ({
                    name: m.name.split(" ").slice(0, 2).join(" "),
                    risk: animatedScores[m.model_id] ?? m.risk_index,
                    level: m.risk_level,
                  }))}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 9 }} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="risk" radius={[4, 4, 0, 0]} name="Risk Index">
                      {models.map((m, i) => (
                        <Cell key={m.model_id} fill={RISK_CONFIG[m.risk_level].color} opacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}