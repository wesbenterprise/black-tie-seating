import { useState, useEffect, useRef, useCallback } from "react";
import { Save, Printer, ArrowLeft, Plus, Trash2, RotateCcw, Settings, X, ChevronDown, ChevronUp, UserPlus, Check, Search, Undo2, Redo2, Download, Moon, Sun, ZoomIn, ZoomOut, Copy } from "lucide-react";

/* ═══ THEME ═══ */
const LIGHT = {
  navy: "#1a2744", navyMed: "#2a4060", gold: "#c9a84c", goldLt: "#f5ecd7",
  goldPale: "#fdf8ee", bg: "#f5f3ee", white: "#fff", text: "#1f2937",
  muted: "#9ca3af", mutedDk: "#6b7280", border: "#e5e7eb",
  green: "#059669", red: "#dc2626", highlight: "#fef9c3", blueTint: "#e8edf4",
  sidebarBg: "#fff", cardBg: "#fff", inputBg: "#fff", headerBg: "#1a2744",
  tableBg: "#1a2744",
};
const DARK = {
  navy: "#0f1729", navyMed: "#1a2744", gold: "#d4b25e", goldLt: "#3a3222",
  goldPale: "#2a2418", bg: "#111827", white: "#1f2937", text: "#e5e7eb",
  muted: "#6b7280", mutedDk: "#9ca3af", border: "#374151",
  green: "#10b981", red: "#ef4444", highlight: "#3a3222", blueTint: "#1e293b",
  sidebarBg: "#1a2030", cardBg: "#1e293b", inputBg: "#1e293b", headerBg: "#0a101e",
  tableBg: "#2d3a52",
};

const TABLE_TAGS = [
  { label: "None", color: null },
  { label: "Head Table", color: "#b45309" },
  { label: "Family", color: "#059669" },
  { label: "Friends", color: "#2563eb" },
  { label: "Work", color: "#7c3aed" },
  { label: "Kids", color: "#db2777" },
  { label: "VIP", color: "#c9a84c" },
  { label: "Custom", color: "#6b7280" },
];

/* ═══ HELPERS ═══ */
function parseGuests(raw) {
  if (!raw.trim()) return [];
  return raw.split(/[\n\r]+/).map(l => l.replace(/^\s*\d+[\.\)\-:\s]+/, "").trim()).filter(s => s.length > 0);
}
function dedupeNames(names) {
  const freq = {}; names.forEach(n => (freq[n] = (freq[n] || 0) + 1));
  const idx = {};
  return names.map(n => { if (freq[n] === 1) return n; idx[n] = (idx[n] || 0) + 1; return `${n} (${idx[n]})`; });
}
function shuffleArr(a) { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function rectErr(sz, ends) {
  if (sz < 2 || sz > 30) return "Size: 2–30";
  if (ends < 0) return "Ends ≥ 0";
  const r = sz - 2 * ends;
  if (r < 0) return "Too many ends for this size";
  if (r > 0 && r % 2 !== 0) return "Won't divide evenly — adjust ends or size";
  return null;
}
function circErr(sz) { return (sz < 2 || sz > 30) ? "Size: 2–30" : null; }
function tblErr(t) { return t.shape === "circle" ? circErr(t.size) : rectErr(t.size, t.ends); }
function getRectLayout(sz, ends) {
  const rem = sz - 2 * ends;
  const side = rem > 0 ? rem / 2 : 0;
  let i = 0;
  return { top: Array.from({ length: side }, () => i++), right: Array.from({ length: ends }, () => i++), bottom: Array.from({ length: side }, () => i++), left: Array.from({ length: ends }, () => i++), side };
}
const sanKey = s => s.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60);

function smartShrink(oldSeats, newSize) {
  if (newSize >= oldSeats.length) return { seats: [...oldSeats, ...Array(newSize - oldSeats.length).fill(null)], bumped: [] };
  const toRemove = oldSeats.length - newSize;
  const result = [...oldSeats];
  let removed = 0;
  for (let i = result.length - 1; i >= 0 && removed < toRemove; i--) {
    if (!result[i]) { result.splice(i, 1); removed++; }
  }
  const bumped = [];
  while (result.length > newSize) { const g = result.pop(); if (g) bumped.push(g); }
  return { seats: result, bumped };
}

function setDragImage(e, text, C) {
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed", left: "-9999px", top: "-9999px",
    padding: "8px 18px", borderRadius: "20px",
    background: C.navy, color: C.gold, fontSize: "14px",
    fontWeight: "700", fontFamily: "'Georgia', serif",
    border: `2px solid ${C.gold}`, boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    whiteSpace: "nowrap", zIndex: 99999,
  });
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
  setTimeout(() => document.body.removeChild(el), 0);
}

/* ═══ GLOBAL STYLES ═══ */
const GLOBAL_CSS = `
@keyframes saveFadeIn { from { opacity:0 } to { opacity:1 } }
@keyframes savePop { 0% { transform:scale(0.5); opacity:0 } 50% { transform:scale(1.1) } 100% { transform:scale(1); opacity:1 } }
@keyframes beginPulse { 0% { transform: scale(1); } 30% { transform: scale(0.97); } 60% { transform: scale(1.02); box-shadow: 0 0 20px rgba(201,168,76,0.4); } 100% { transform: scale(1); opacity: 0.7; } }
@keyframes fadeSlide { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.6 } }
@media print { .noprint { display: none !important; } body { margin: 0; } }
`;

/* ═══ SAVE ANIMATION OVERLAY ═══ */
function SaveOverlay({ show, C }) {
  if (!show) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(26,39,68,0.6)", backdropFilter: "blur(4px)", animation: "saveFadeIn 0.2s ease-out" }}>
      <div style={{ background: C.cardBg, borderRadius: 16, padding: "32px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "savePop 0.4s ease-out" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.green, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={32} color="#fff" strokeWidth={3} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, fontFamily: "'Georgia', serif" }}>Saved!</div>
      </div>
    </div>
  );
}

/* ═══ SEAT PILL ═══ */
function Seat({ guest, isOver, isSelected, onDragStart, onDragOver, onDragLeave, onDrop, onClick, onContextMenu, C, style: extra }) {
  const empty = !guest;
  return (
    <div draggable={!empty} onDragStart={!empty ? onDragStart : undefined}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
      onContextMenu={onContextMenu}
      title={guest || "Empty seat"}
      style={{
        width: 100, minWidth: 100, height: 32, borderRadius: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontFamily: "'Georgia', 'Times New Roman', serif",
        fontWeight: guest ? 500 : 400, color: guest ? C.text : C.muted,
        background: isOver ? C.highlight : isSelected ? C.goldLt : empty ? C.inputBg : C.goldPale,
        border: isSelected ? `2px solid ${C.gold}` : empty ? `1px dashed ${C.muted}` : `1px solid ${C.gold}`,
        cursor: guest ? "grab" : "pointer", userSelect: "none",
        transition: "background 0.15s, border 0.15s", overflow: "hidden", whiteSpace: "nowrap",
        boxSizing: "border-box", padding: "0 8px", letterSpacing: 0.2,
        ...extra,
      }}
    >{guest || "+"}</div>
  );
}

/* ═══ QUICK +/- ═══ */
function QuickResize({ onMinus, onPlus, C }) {
  const qBtn = { width: 26, height: 26, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.cardBg, cursor: "pointer", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", color: C.text, lineHeight: 1 };
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 4 }}>
      <button onClick={onMinus} style={qBtn} title="Remove a seat">−</button>
      <button onClick={onPlus} style={qBtn} title="Add a seat">+</button>
    </div>
  );
}

/* ═══ TABLE INTERIOR LABEL ═══ */
function TableLabel({ name, seated, total, tag, C, isDragging }) {
  const avail = total - seated;
  return (
    <>
      {tag && <div style={{ fontSize: 8, letterSpacing: 1, textTransform: "uppercase", color: tag.color || C.goldLt, fontWeight: 700, fontFamily: "system-ui", marginBottom: 1 }}>{tag.label}</div>}
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.5, fontFamily: "'Georgia', serif", color: C.gold }}>{name}</div>
      <div style={{ fontSize: 11, color: C.goldLt, marginTop: 1, fontFamily: "system-ui, sans-serif", opacity: 0.85 }}>{total} top</div>
      <div style={{
        fontSize: 10, marginTop: 1, fontFamily: "system-ui, sans-serif",
        color: avail > 0 ? (isDragging ? "#4ade80" : C.goldLt) : C.green,
        fontWeight: avail === 0 ? 600 : (isDragging && avail > 0 ? 700 : 400),
        opacity: 0.9,
        animation: isDragging && avail > 0 ? "pulse 1s infinite" : "none",
      }}>
        {avail > 0 ? `${avail} open` : "Full"}
      </div>
    </>
  );
}

/* ═══ CIRCLE TABLE ═══ */
function CircleTableVisual({ table, selected, overTarget, onDragStartSeat, onDragOverSeat, onDragLeaveSeat, onDropSeat, onSeatClick, onSeatContext, onEditClick, onQuickResize, isDragOver, onTableDragStart, onTableDragOver, onTableDrop, C, isDragging }) {
  const n = table.size;
  const seated = table.seats.filter(Boolean).length;
  const avail = n - seated;
  const radius = Math.max(64, n * 13);
  const boxSize = radius * 2 + 120;
  const tagObj = table.tag ? TABLE_TAGS.find(t => t.label === table.tag) : null;

  const seat = (idx, angle) => {
    const x = boxSize / 2 + (radius + 4) * Math.cos(angle) - 50;
    const y = boxSize / 2 + (radius + 4) * Math.sin(angle) - 16;
    return (
      <Seat key={idx} guest={table.seats[idx]} C={C}
        isOver={overTarget?.type === "seat" && overTarget.tid === table.id && overTarget.sid === idx}
        isSelected={selected?.from === "table" && selected.tableId === table.id && selected.seatIdx === idx}
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/seat", "1"); setDragImage(e, table.seats[idx], C); onDragStartSeat(table.id, idx); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOverSeat(table.id, idx); }}
        onDragLeave={onDragLeaveSeat} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropSeat(table.id, idx); }}
        onClick={(e) => { e.stopPropagation(); onSeatClick(table.id, idx); }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (table.seats[idx]) onSeatContext(table.id, idx); }}
        style={{ position: "absolute", left: x, top: y }}
      />
    );
  };

  return (
    <div draggable onDragStart={(e) => { if (!e.dataTransfer.types.includes("text/seat")) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/table", String(table.id)); setDragImage(e, `↔ ${table.name}`, C); onTableDragStart(table.id); } }}
      onDragOver={(e) => { e.preventDefault(); onTableDragOver(table.id); }}
      onDrop={(e) => { e.preventDefault(); onTableDrop(table.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onEditClick(table.id); }}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 16, gap: 2, padding: 8, borderRadius: 12,
        background: isDragOver ? C.blueTint : "transparent",
        border: isDragOver ? `2px dashed ${C.gold}` : isDragging && avail > 0 ? `2px solid rgba(74,222,128,0.3)` : "2px solid transparent",
        transition: "all 0.15s", cursor: "grab",
        boxShadow: isDragging && avail > 0 ? "0 0 12px rgba(74,222,128,0.15)" : "none",
      }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6, fontFamily: "'Georgia', serif" }}>
        {tagObj?.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tagObj.color, display: "inline-block" }} />}
        {table.name} <span style={{ fontWeight: 400, color: C.mutedDk, fontSize: 12 }}>({seated}/{n})</span>
        <button onClick={(e) => { e.stopPropagation(); onEditClick(table.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedDk, padding: 2, display: "flex" }}><Settings size={14} /></button>
      </div>
      <div style={{ position: "relative", width: boxSize, height: boxSize }}>
        <div style={{
          position: "absolute", left: boxSize / 2 - radius, top: boxSize / 2 - radius,
          width: radius * 2, height: radius * 2, borderRadius: "50%",
          background: tagObj?.color ? `color-mix(in srgb, ${tagObj.color} 30%, ${C.tableBg})` : C.tableBg,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <TableLabel name={table.name} seated={seated} total={n} tag={tagObj} C={C} isDragging={isDragging} />
        </div>
        {Array.from({ length: n }, (_, i) => seat(i, (2 * Math.PI * i) / n - Math.PI / 2))}
      </div>
      <QuickResize C={C} onMinus={(e) => { e?.stopPropagation(); onQuickResize(table.id, -1); }} onPlus={(e) => { e?.stopPropagation(); onQuickResize(table.id, 1); }} />
    </div>
  );
}

/* ═══ RECT TABLE ═══ */
function RectTableVisual({ table, selected, overTarget, onDragStartSeat, onDragOverSeat, onDragLeaveSeat, onDropSeat, onSeatClick, onSeatContext, onEditClick, onQuickResize, isDragOver, onTableDragStart, onTableDragOver, onTableDrop, C, isDragging }) {
  const lay = getRectLayout(table.size, table.ends);
  const seated = table.seats.filter(Boolean).length;
  const avail = table.size - seated;
  const sw = Math.max(lay.side * 108, 110);
  const sh = Math.max(table.ends * 40, 50);
  const tagObj = table.tag ? TABLE_TAGS.find(t => t.label === table.tag) : null;

  const seat = (idx) => (
    <Seat key={idx} guest={table.seats[idx]} C={C}
      isOver={overTarget?.type === "seat" && overTarget.tid === table.id && overTarget.sid === idx}
      isSelected={selected?.from === "table" && selected.tableId === table.id && selected.seatIdx === idx}
      onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/seat", "1"); setDragImage(e, table.seats[idx], C); onDragStartSeat(table.id, idx); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); onDragOverSeat(table.id, idx); }}
      onDragLeave={onDragLeaveSeat} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropSeat(table.id, idx); }}
      onClick={(e) => { e.stopPropagation(); onSeatClick(table.id, idx); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (table.seats[idx]) onSeatContext(table.id, idx); }}
    />
  );

  return (
    <div draggable onDragStart={(e) => { if (!e.dataTransfer.types.includes("text/seat")) { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/table", String(table.id)); setDragImage(e, `↔ ${table.name}`, C); onTableDragStart(table.id); } }}
      onDragOver={(e) => { e.preventDefault(); onTableDragOver(table.id); }}
      onDrop={(e) => { e.preventDefault(); onTableDrop(table.id); }}
      onDoubleClick={(e) => { e.stopPropagation(); onEditClick(table.id); }}
      style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 16, gap: 4, padding: 8, borderRadius: 12,
        background: isDragOver ? C.blueTint : "transparent",
        border: isDragOver ? `2px dashed ${C.gold}` : isDragging && avail > 0 ? `2px solid rgba(74,222,128,0.3)` : "2px solid transparent",
        transition: "all 0.15s", cursor: "grab",
        boxShadow: isDragging && avail > 0 ? "0 0 12px rgba(74,222,128,0.15)" : "none",
      }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.text, display: "flex", alignItems: "center", gap: 6, fontFamily: "'Georgia', serif" }}>
        {tagObj?.color && <span style={{ width: 8, height: 8, borderRadius: "50%", background: tagObj.color, display: "inline-block" }} />}
        {table.name} <span style={{ fontWeight: 400, color: C.mutedDk, fontSize: 12 }}>({seated}/{table.size})</span>
        <button onClick={(e) => { e.stopPropagation(); onEditClick(table.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedDk, padding: 2, display: "flex" }}><Settings size={14} /></button>
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>{lay.top.map(seat)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {lay.left.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lay.left.map(seat)}</div>}
        <div style={{
          width: sw, height: sh, borderRadius: 8,
          background: tagObj?.color ? `color-mix(in srgb, ${tagObj.color} 30%, ${C.tableBg})` : C.tableBg,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <TableLabel name={table.name} seated={seated} total={table.size} tag={tagObj} C={C} isDragging={isDragging} />
        </div>
        {lay.right.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>{lay.right.map(seat)}</div>}
      </div>
      <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>{lay.bottom.map(seat)}</div>
      <QuickResize C={C} onMinus={(e) => { e?.stopPropagation(); onQuickResize(table.id, -1); }} onPlus={(e) => { e?.stopPropagation(); onQuickResize(table.id, 1); }} />
    </div>
  );
}

/* ═══ TABLE EDIT MODAL ═══ */
function TableEditModal({ table, onSave, onDelete, onClose, tableCount, C }) {
  const [name, setName] = useState(table.name);
  const [shape, setShape] = useState(table.shape);
  const [size, setSize] = useState(table.size);
  const [ends, setEnds] = useState(table.ends);
  const [tag, setTag] = useState(table.tag || "None");
  const err = shape === "circle" ? circErr(size) : rectErr(size, ends);
  const side = !err && shape === "rect" ? (size - 2 * ends) / 2 : null;
  const lblSt = { display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 };
  const inpSt = { display: "block", width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: C.inputBg, color: C.text };
  const numSt = { width: 56, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, textAlign: "center", background: C.inputBg, outline: "none", color: C.text };
  const rowSt = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" };
  const tabAct = { padding: "8px 16px", borderRadius: 6, border: `2px solid ${C.gold}`, background: C.navy, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 };
  const tabIn = { padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.cardBg, color: C.mutedDk, cursor: "pointer", fontSize: 13 };
  const qBtn = { width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.cardBg, cursor: "pointer", fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", color: C.text, lineHeight: 1 };
  const priBtn = { display: "block", width: "100%", padding: "14px 0", marginTop: 18, background: C.navy, color: C.gold, border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5 };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cardBg, borderRadius: 12, padding: 24, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: C.text, fontFamily: "'Georgia', serif" }}>Edit Table</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedDk }}><X size={18} /></button>
        </div>
        <label style={lblSt}>Table Name</label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...inpSt, marginBottom: 14 }} />

        <label style={lblSt}>Tag</label>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 14 }}>
          {TABLE_TAGS.map(t => (
            <button key={t.label} onClick={() => setTag(t.label)}
              style={{
                padding: "4px 10px", borderRadius: 12, fontSize: 11, cursor: "pointer", fontWeight: 500,
                background: tag === t.label ? (t.color || C.navy) : C.inputBg,
                color: tag === t.label ? "#fff" : C.mutedDk,
                border: tag === t.label ? "2px solid transparent" : `1px solid ${C.border}`,
              }}>{t.label}</button>
          ))}
        </div>

        <label style={lblSt}>Shape</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button onClick={() => setShape("rect")} style={shape === "rect" ? tabAct : tabIn}>▬ Rectangle</button>
          <button onClick={() => setShape("circle")} style={shape === "circle" ? tabAct : tabIn}>● Circle</button>
        </div>
        <div style={rowSt}><label style={{ fontSize: 14, color: C.text }}>Seats</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setSize(s => Math.max(2, s - 1))} style={qBtn}>−</button>
            <input type="number" min={2} max={30} value={size} onChange={e => setSize(+e.target.value || 2)} style={numSt} />
            <button onClick={() => setSize(s => Math.min(30, s + 1))} style={qBtn}>+</button>
          </div>
        </div>
        {shape === "rect" && (
          <div style={rowSt}><label style={{ fontSize: 14, color: C.text }}>Per End</label>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => setEnds(e => Math.max(0, e - 1))} style={qBtn}>−</button>
              <input type="number" min={0} max={10} value={ends} onChange={e => setEnds(+e.target.value || 0)} style={numSt} />
              <button onClick={() => setEnds(e => Math.min(10, e + 1))} style={qBtn}>+</button>
            </div>
          </div>
        )}
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 6 }}>⚠ {err}</div>}
        {!err && shape === "rect" && side != null && <div style={{ fontSize: 12, color: C.mutedDk, marginTop: 6, fontStyle: "italic" }}>Layout: {ends > 0 ? `${ends} per end, ` : ""}{side} per long side{ends === 0 ? " (no ends)" : ""}{ends > 0 && side === ends ? " — it's a square!" : ""}</div>}
        {!err && shape === "circle" && <div style={{ fontSize: 12, color: C.mutedDk, marginTop: 6, fontStyle: "italic" }}>{size} seats around a round table</div>}
        {size < table.size && (() => {
          const { bumped } = smartShrink(table.seats, size);
          return bumped.length > 0 ? (
            <div style={{ fontSize: 12, color: C.gold, marginTop: 6, background: C.highlight, padding: "6px 10px", borderRadius: 6 }}>⚠ Will unseat {bumped.length} guest(s)</div>
          ) : (<div style={{ fontSize: 12, color: C.green, marginTop: 6 }}>✓ Only empty seats will be removed</div>);
        })()}
        <button disabled={!!err} onClick={() => { if (!err) onSave({ name, shape, size, ends, tag: tag === "None" ? null : tag }); }} style={{ ...priBtn, opacity: err ? 0.5 : 1 }}>Apply Changes</button>
        {tableCount > 1 && (
          <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
            style={{ color: C.red, marginTop: 12, width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 0", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>
            <Trash2 size={14} /> Delete This Table
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══ SAVE MODAL ═══ */
function SaveModal({ eventName, onSave, onClose, C }) {
  const [vName, setVName] = useState("");
  const lblSt = { display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 };
  const inpSt = { display: "block", width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: C.inputBg, color: C.text };
  const priBtn = { display: "block", width: "100%", padding: "14px 0", marginTop: 16, background: C.navy, color: C.gold, border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.cardBg, borderRadius: 12, padding: 24, width: "100%", maxWidth: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 16, color: C.text, fontFamily: "'Georgia', serif" }}>Save Version</h3>
        <p style={{ fontSize: 13, color: C.mutedDk, margin: "0 0 16px" }}>Save under <strong>{eventName || "this event"}</strong></p>
        <label style={lblSt}>Version Name</label>
        <input value={vName} onChange={e => setVName(e.target.value)} placeholder="e.g. Option A, Draft 2, Final" style={inpSt} autoFocus
          onKeyDown={e => { if (e.key === "Enter" && vName.trim()) onSave(vName.trim()); }} />
        <button disabled={!vName.trim()} onClick={() => onSave(vName.trim())} style={{ ...priBtn, opacity: !vName.trim() ? 0.5 : 1 }}>Save</button>
        <button onClick={onClose} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.mutedDk, fontSize: 13, fontWeight: 500, padding: "4px 0", marginTop: 8, width: "100%", justifyContent: "center" }}>Cancel</button>
      </div>
    </div>
  );
}

/* ═══ PRINT: MINI TABLE VISUALS ═══ */
function PrintCircle({ table }) {
  const n = table.size; const seated = table.seats.filter(Boolean).length;
  const r = Math.max(36, n * 7); const box = r * 2 + 80;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#1a2744" }}>{table.name} ({seated}/{n})</div>
      <div style={{ position: "relative", width: box, height: box }}>
        <div style={{ position: "absolute", left: box / 2 - r, top: box / 2 - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "#1a2744", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#c9a84c", fontSize: 9, fontWeight: 600 }}>{table.name}</div>
          <div style={{ color: "#f5ecd7", fontSize: 8 }}>{n} top</div>
        </div>
        {Array.from({ length: n }, (_, i) => {
          const a = (2 * Math.PI * i) / n - Math.PI / 2;
          const x = box / 2 + (r + 2) * Math.cos(a) - 30;
          const y = box / 2 + (r + 2) * Math.sin(a) - 10;
          const g = table.seats[i];
          return <div key={i} style={{ position: "absolute", left: x, top: y, width: 60, height: 20, borderRadius: 10, background: g ? "#fdf8ee" : "#fff", border: g ? "1px solid #c9a84c" : "1px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: g ? 500 : 400, color: g ? "#1a2744" : "#9ca3af", overflow: "hidden", whiteSpace: "nowrap" }}>{g || ""}</div>;
        })}
      </div>
    </div>
  );
}
function PrintRect({ table }) {
  const lay = getRectLayout(table.size, table.ends); const seated = table.seats.filter(Boolean).length;
  const sw = Math.max(lay.side * 66, 66); const sh = Math.max(table.ends * 24, 24);
  const pill = (idx) => { const g = table.seats[idx]; return <div key={idx} style={{ width: 60, height: 20, borderRadius: 10, background: g ? "#fdf8ee" : "#fff", border: g ? "1px solid #c9a84c" : "1px dashed #9ca3af", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: g ? 500 : 400, color: g ? "#1a2744" : "#9ca3af", overflow: "hidden", whiteSpace: "nowrap" }}>{g || ""}</div>; };
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", margin: 8, gap: 3 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#1a2744" }}>{table.name} ({seated}/{table.size})</div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>{lay.top.map(pill)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        {lay.left.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{lay.left.map(pill)}</div>}
        <div style={{ width: sw, height: sh, background: "#1a2744", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#c9a84c", fontSize: 8, fontWeight: 600 }}>{table.name}</div>
          <div style={{ color: "#f5ecd7", fontSize: 7 }}>{table.size} top</div>
        </div>
        {lay.right.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>{lay.right.map(pill)}</div>}
      </div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center" }}>{lay.bottom.map(pill)}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark] = useState(false);
  const C = dark ? DARK : LIGHT;

  const [phase, setPhase] = useState("setup");
  const [eventName, setEventName] = useState("");
  const [guestText, setGuestText] = useState("");
  const [tblMode, setTblMode] = useState("uniform");
  const [uShape, setUShape] = useState("rect");
  const [uCnt, setUCnt] = useState(5);
  const [uSz, setUSz] = useState(8);
  const [uEnds, setUEnds] = useState(1);
  const [custom, setCustom] = useState([{ name: "Table 1", size: 8, ends: 1, shape: "rect" }]);
  const [tables, setTables] = useState([]);
  const [unseated, setUnseated] = useState([]);
  const [selected, setSelected] = useState(null);
  const [over, setOver] = useState(null);
  const [editTid, setEditTid] = useState(null);
  const [showSave, setShowSave] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [addGuestText, setAddGuestText] = useState("");
  const [saved, setSaved] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [showSaveAnim, setShowSaveAnim] = useState(false);
  const [expandedEvt, setExpandedEvt] = useState(null);
  const [setupError, setSetupError] = useState("");
  const [beginAnim, setBeginAnim] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [zoom, setZoom] = useState(1);
  const [printMode, setPrintMode] = useState("combined");
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef(null);
  const tableDragRef = useRef(null);
  const [tableDragOver, setTableDragOver] = useState(null);

  /* ═══ UNDO/REDO ═══ */
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [histVer, setHistVer] = useState(0);

  const pushHistory = useCallback(() => {
    historyRef.current.push({ tables: JSON.parse(JSON.stringify(tables)), unseated: [...unseated] });
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    setHistVer(v => v + 1);
  }, [tables, unseated]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    futureRef.current.push({ tables: JSON.parse(JSON.stringify(tables)), unseated: [...unseated] });
    const prev = historyRef.current.pop();
    setTables(prev.tables); setUnseated(prev.unseated); setSelected(null);
    setHistVer(v => v + 1);
  }, [tables, unseated]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    historyRef.current.push({ tables: JSON.parse(JSON.stringify(tables)), unseated: [...unseated] });
    const next = futureRef.current.pop();
    setTables(next.tables); setUnseated(next.unseated); setSelected(null);
    setHistVer(v => v + 1);
  }, [tables, unseated]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  /* ═══ PERSISTENCE ═══ */
  useEffect(() => { loadSavedList(); }, []);

  const SAVE_PREFIX = "beps-";
  const loadSavedList = async () => {
    try {
      const r = await window.storage.list(SAVE_PREFIX);
      if (!r?.keys?.length) { setSaved([]); return; }
      const items = [];
      for (const k of r.keys) { try { const d = await window.storage.get(k); if (d) { const p = JSON.parse(d.value); items.push({ key: k, event: p.eventName, version: p.versionName, date: p.savedAt }); } } catch (e) {} }
      items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setSaved(items);
      if (items.length > 0 && !expandedEvt) setExpandedEvt("__all__");
    } catch (e) { setSaved([]); }
  };

  const saveEvent = async (versionName) => {
    const ev = eventName || "Untitled";
    const key = SAVE_PREFIX + sanKey(ev) + "--" + sanKey(versionName);
    try {
      await window.storage.set(key, JSON.stringify({ eventName: ev, versionName, tables, unseated, savedAt: new Date().toISOString() }));
      setShowSave(false); setShowSaveAnim(true);
      setTimeout(() => setShowSaveAnim(false), 1400);
      loadSavedList();
    } catch (e) { setSaveMsg("Save failed"); setTimeout(() => setSaveMsg(""), 3000); }
  };

  const loadEvent = async (key) => {
    try { const d = await window.storage.get(key); if (d) { const p = JSON.parse(d.value); setEventName(p.eventName || ""); setTables(p.tables || []); setUnseated(p.unseated || []); setSelected(null); historyRef.current = []; futureRef.current = []; setPhase("seating"); } } catch (e) {} };

  const deleteEvent = async (key) => { try { await window.storage.delete(key); loadSavedList(); } catch (e) {} };

  const duplicateEvent = async (key) => {
    try {
      const d = await window.storage.get(key);
      if (d) {
        const p = JSON.parse(d.value);
        const newVer = p.versionName + " (copy)";
        const newKey = SAVE_PREFIX + sanKey(p.eventName) + "--" + sanKey(newVer);
        await window.storage.set(newKey, JSON.stringify({ ...p, versionName: newVer, savedAt: new Date().toISOString() }));
        loadSavedList();
      }
    } catch (e) {}
  };

  const exportJSON = () => {
    const data = { eventName, tables, unseated, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${sanKey(eventName || "seating")}-export.json`; a.click();
    URL.revokeObjectURL(url);
  };

  /* ═══ SETUP ═══ */
  const beginSeating = () => {
    setSetupError("");
    const raw = parseGuests(guestText);
    if (!raw.length) { setSetupError("Add at least one guest name."); return; }
    const guests = dedupeNames(raw);
    let tbls;
    if (tblMode === "uniform") {
      if (uShape === "rect") { const err = rectErr(uSz, uEnds); if (err) { setSetupError("Table config error: " + err); return; } }
      else { const err = circErr(uSz); if (err) { setSetupError("Table config error: " + err); return; } }
      tbls = Array.from({ length: uCnt }, (_, i) => ({ id: i + 1, name: `Table ${i + 1}`, size: uSz, ends: uShape === "rect" ? uEnds : 0, shape: uShape, seats: Array(uSz).fill(null), tag: null }));
    } else {
      tbls = [];
      for (let i = 0; i < custom.length; i++) {
        const t = custom[i], err = tblErr(t);
        if (err) { setSetupError(`${t.name}: ${err}`); return; }
        tbls.push({ id: i + 1, name: t.name, size: t.size, ends: t.shape === "rect" ? t.ends : 0, shape: t.shape, seats: Array(t.size).fill(null), tag: null });
      }
    }
    setBeginAnim(true);
    setTimeout(() => { setTables(tbls); setUnseated(guests); setSelected(null); historyRef.current = []; futureRef.current = []; setPhase("seating"); setBeginAnim(false); }, 600);
  };

  /* ═══ TABLE OPERATIONS (with history) ═══ */
  const resizeTable = (tid, delta) => {
    pushHistory();
    setTables(prev => prev.map(t => {
      if (t.id !== tid) return t;
      const newSize = Math.max(2, Math.min(30, t.size + delta));
      if (newSize === t.size) return t;
      const testErr = t.shape === "circle" ? circErr(newSize) : rectErr(newSize, t.ends);
      if (testErr) {
        if (t.shape === "rect" && delta < 0) {
          let newEnds = t.ends;
          while (newEnds > 0 && rectErr(newSize, newEnds)) newEnds--;
          if (!rectErr(newSize, newEnds)) {
            const { seats, bumped } = smartShrink(t.seats, newSize);
            if (bumped.length) setUnseated(u => [...u, ...bumped]);
            return { ...t, size: newSize, ends: newEnds, seats };
          }
        }
        return t;
      }
      if (delta > 0) return { ...t, size: newSize, seats: [...t.seats, null] };
      const { seats, bumped } = smartShrink(t.seats, newSize);
      if (bumped.length) setUnseated(u => [...u, ...bumped]);
      return { ...t, size: newSize, seats };
    }));
  };

  const applyTableEdit = (tid, changes) => {
    pushHistory();
    setTables(prev => prev.map(t => {
      if (t.id !== tid) return t;
      const nt = { ...t, name: changes.name, shape: changes.shape, ends: changes.shape === "rect" ? changes.ends : 0, tag: changes.tag };
      if (changes.size === t.size) { nt.seats = [...t.seats]; nt.size = changes.size; }
      else if (changes.size > t.size) { nt.size = changes.size; nt.seats = [...t.seats, ...Array(changes.size - t.size).fill(null)]; }
      else { nt.size = changes.size; const { seats, bumped } = smartShrink(t.seats, changes.size); nt.seats = seats; if (bumped.length) setUnseated(u => [...u, ...bumped]); }
      return nt;
    }));
    setEditTid(null);
  };

  const deleteTable = (tid) => {
    pushHistory();
    const t = tables.find(x => x.id === tid);
    setEditTid(null);
    setTimeout(() => {
      if (t) { const bumped = t.seats.filter(Boolean); if (bumped.length) setUnseated(u => [...u, ...bumped]); }
      setTables(prev => prev.filter(x => x.id !== tid));
    }, 0);
  };

  const addNewTable = () => {
    pushHistory();
    const maxId = tables.reduce((m, t) => Math.max(m, t.id), 0);
    setTables(prev => [...prev, { id: maxId + 1, name: `Table ${maxId + 1}`, size: 8, ends: 1, shape: "rect", seats: Array(8).fill(null), tag: null }]);
  };

  const addGuestsFromSeating = () => {
    const raw = parseGuests(addGuestText);
    if (!raw.length) return;
    pushHistory();
    const existing = new Set([...unseated, ...tables.flatMap(t => t.seats.filter(Boolean))]);
    const newGuests = dedupeNames(raw).filter(n => !existing.has(n));
    if (newGuests.length) setUnseated(u => [...u, ...newGuests]);
    setAddGuestText(""); setShowAddGuest(false);
  };

  /* ═══ TABLE DRAG (swap positions) ═══ */
  const handleTableDragStart = (tid) => { tableDragRef.current = tid; };
  const handleTableDragOver = (tid) => { if (tableDragRef.current && tableDragRef.current !== tid) setTableDragOver(tid); };
  const handleTableDrop = (tid) => {
    const srcId = tableDragRef.current;
    if (!srcId || srcId === tid) { tableDragRef.current = null; setTableDragOver(null); return; }
    pushHistory();
    setTables(prev => {
      const next = [...prev];
      const srcIdx = next.findIndex(t => t.id === srcId);
      const dstIdx = next.findIndex(t => t.id === tid);
      if (srcIdx === -1 || dstIdx === -1) return prev;
      [next[srcIdx], next[dstIdx]] = [next[dstIdx], next[srcIdx]];
      return next;
    });
    tableDragRef.current = null; setTableDragOver(null);
  };

  /* ═══ GUEST PLACEMENT (with history) ═══ */
  const placeGuest = (name, srcTid, srcSid, dstTid, dstSid) => {
    pushHistory();
    setTables(prev => {
      const next = prev.map(t => ({ ...t, seats: [...t.seats] }));
      const dst = next.find(t => t.id === dstTid);
      const occ = dst.seats[dstSid];
      dst.seats[dstSid] = name;
      if (srcTid != null) { next.find(t => t.id === srcTid).seats[srcSid] = occ; }
      else { setUnseated(u => { let r = u.filter(n => n !== name); if (occ) r.push(occ); return r; }); }
      return next;
    });
  };

  const unseatGuest = (tid, sid) => {
    pushHistory();
    setTables(prev => {
      const next = prev.map(t => ({ ...t, seats: [...t.seats] }));
      const tbl = next.find(t => t.id === tid);
      const g = tbl.seats[sid]; if (g) { tbl.seats[sid] = null; setUnseated(u => [...u, g]); }
      return next;
    });
  };

  const handleSeatClick = (tid, sid) => {
    const tbl = tables.find(t => t.id === tid), occ = tbl.seats[sid];
    if (!selected) { if (occ) setSelected({ from: "table", tableId: tid, seatIdx: sid, name: occ }); }
    else if (selected.from === "unseated") { placeGuest(selected.name, null, null, tid, sid); setSelected(null); }
    else if (selected.from === "table") {
      if (selected.tableId === tid && selected.seatIdx === sid) setSelected(null);
      else { placeGuest(selected.name, selected.tableId, selected.seatIdx, tid, sid); setSelected(null); }
    }
  };

  const handleSeatContext = (tid, sid) => { unseatGuest(tid, sid); };

  const handleUnseatedClick = (name) => {
    if (!selected) setSelected({ from: "unseated", name });
    else if (selected.from === "unseated" && selected.name === name) setSelected(null);
    else if (selected.from === "unseated") setSelected({ from: "unseated", name });
    else if (selected.from === "table") { unseatGuest(selected.tableId, selected.seatIdx); setSelected(null); }
  };

  const dStartU = (name) => { dragRef.current = { from: "unseated", name }; tableDragRef.current = null; setIsDragging(true); };
  const dStartS = (tid, sid) => { const t = tables.find(t2 => t2.id === tid); dragRef.current = { from: "table", tableId: tid, seatIdx: sid, name: t.seats[sid] }; tableDragRef.current = null; setIsDragging(true); };
  const dOverS = (tid, sid) => setOver({ type: "seat", tid, sid });
  const dLeaveS = () => setOver(null);
  const dDropS = (tid, sid) => {
    const s = dragRef.current; if (!s) return;
    if (s.from === "unseated") placeGuest(s.name, null, null, tid, sid);
    else placeGuest(s.name, s.tableId, s.seatIdx, tid, sid);
    dragRef.current = null; setOver(null); setSelected(null); setIsDragging(false);
  };
  const dDropU = () => {
    const s = dragRef.current;
    if (s?.from === "table") unseatGuest(s.tableId, s.seatIdx);
    dragRef.current = null; setOver(null); setIsDragging(false);
  };

  const randomAssign = () => {
    pushHistory();
    const sh = shuffleArr(unseated);
    const nt = tables.map(t => ({ ...t, seats: [...t.seats] }));
    let i = 0;
    for (const t of nt) for (let s = 0; s < t.seats.length && i < sh.length; s++) if (!t.seats[s]) t.seats[s] = sh[i++];
    setTables(nt); setUnseated(sh.slice(i)); setSelected(null);
  };

  const clearAll = () => {
    pushHistory();
    const all = []; tables.forEach(t => t.seats.forEach(s => { if (s) all.push(s); }));
    setTables(tables.map(t => ({ ...t, seats: Array(t.size).fill(null) }))); setUnseated(u => [...u, ...all]); setSelected(null);
  };

  /* ═══ COMPUTED ═══ */
  const totalSeated = tables.reduce((s, t) => s + t.seats.filter(Boolean).length, 0);
  const totalGuests = totalSeated + unseated.length;
  const totalSeats = tables.reduce((s, t) => s + t.size, 0);
  const setupErrU = tblMode === "uniform" ? (uShape === "rect" ? rectErr(uSz, uEnds) : circErr(uSz)) : null;
  const guestCount = parseGuests(guestText).length;
  const setupSeats = tblMode === "uniform" ? uCnt * uSz : custom.reduce((s, t) => s + t.size, 0);
  const uniSide = !setupErrU && tblMode === "uniform" && uShape === "rect" ? (uSz - 2 * uEnds) / 2 : null;
  const editTable = editTid != null ? tables.find(t => t.id === editTid) : null;
  const savedByEvent = {};
  saved.forEach(s => { (savedByEvent[s.event] = savedByEvent[s.event] || []).push(s); });
  const filteredUnseated = searchQ ? unseated.filter(n => n.toLowerCase().includes(searchQ.toLowerCase())) : unseated;

  /* ═══ STYLE HELPERS ═══ */
  const lblSt = { display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 };
  const inpSt = { display: "block", width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box", background: C.inputBg, color: C.text };
  const numSt = { width: 56, padding: "6px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, textAlign: "center", background: C.inputBg, outline: "none", color: C.text };
  const cardSt = { background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginTop: 8 };
  const rowSt = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" };
  const tabAct = { padding: "8px 16px", borderRadius: 6, border: `2px solid ${C.gold}`, background: C.navy, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500 };
  const tabIn = { padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.cardBg, color: C.mutedDk, cursor: "pointer", fontSize: 13 };
  const priBtn = { display: "block", width: "100%", padding: "14px 0", marginTop: 24, background: C.navy, color: C.gold, border: "none", borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: "pointer", letterSpacing: 0.5 };
  const lnkBtn = { display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.text, fontSize: 13, fontWeight: 500, padding: "4px 0" };
  const hdrBtnSt = { display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#fff", cursor: "pointer", fontSize: 12 };

  /* ═══════ PRINT ═══════ */
  if (phase === "print") return (
    <div style={{ background: "#fff", color: "#1f2937", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{GLOBAL_CSS}</style>
      <div className="noprint" style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={() => window.print()} style={{ padding: "10px 24px", background: "#1a2744", color: "#c9a84c", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Printer size={16} /> Print</button>
        <button onClick={() => setPhase("seating")} style={{ padding: "10px 20px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 14 }}>← Back</button>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
          {["combined", "visual", "list"].map(m => (
            <button key={m} onClick={() => setPrintMode(m)}
              style={{ padding: "8px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 500, textTransform: "capitalize", background: printMode === m ? "#1a2744" : "#fff", color: printMode === m ? "#c9a84c" : "#6b7280", border: printMode === m ? "2px solid #1a2744" : "1px solid #e5e7eb" }}>
              {m}
            </button>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#c9a84c", textTransform: "uppercase" }}>Barnett Event Planning Services</div>
        <h1 style={{ fontSize: 28, color: "#1a2744", margin: "6px 0" }}>{eventName || "Seating Chart"}</h1>
        <div style={{ width: 60, height: 2, background: "#c9a84c", margin: "8px auto" }} />
        <p style={{ color: "#6b7280", fontSize: 13 }}>{totalSeated} of {totalGuests} guests seated · {tables.length} tables</p>
      </div>

      {(printMode === "combined" || printMode === "visual") && (
        <>
          {printMode === "combined" && <h2 style={{ fontSize: 18, color: "#1a2744", borderBottom: "2px solid #c9a84c", paddingBottom: 6, marginBottom: 16 }}>Table View</h2>}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", marginBottom: 40 }}>
            {tables.map(t => t.shape === "circle" ? <PrintCircle key={t.id} table={t} /> : <PrintRect key={t.id} table={t} />)}
          </div>
        </>
      )}

      {(printMode === "combined" || printMode === "list") && (
        <>
          {printMode === "combined" && <h2 style={{ fontSize: 18, color: "#1a2744", borderBottom: "2px solid #c9a84c", paddingBottom: 6, marginBottom: 16, pageBreakBefore: "auto" }}>List View</h2>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
            {tables.map(t => (
              <div key={t.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 14, pageBreakInside: "avoid" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#1a2744", borderBottom: "2px solid #c9a84c", paddingBottom: 6, marginBottom: 8 }}>
                  {t.name} <span style={{ fontWeight: 400, fontSize: 13, color: "#6b7280" }}>({t.seats.filter(Boolean).length}/{t.size} · {t.shape === "circle" ? "Round" : "Rect"})</span>
                </div>
                {t.seats.map((s, i) => (
                  <div key={i} style={{ fontSize: 14, padding: "3px 0", color: s ? "#1f2937" : "#9ca3af" }}>{i + 1}. {s || "— empty —"}</div>
                ))}
              </div>
            ))}
          </div>
          {unseated.length > 0 && (
            <div style={{ marginTop: 28, border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#1a2744", marginBottom: 8 }}>Unseated ({unseated.length})</div>
              <div style={{ columnCount: 3, fontSize: 14 }}>{unseated.map(n => <div key={n} style={{ padding: "2px 0" }}>{n}</div>)}</div>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 40, textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", letterSpacing: 0.3 }}>Vibe Coded by WesB at a fancy gala</p>
      </div>
    </div>
  );

  /* ═══════ SETUP ═══════ */
  if (phase === "setup") return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={() => setDark(!dark)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.mutedDk }}>
              {dark ? <Sun size={14} /> : <Moon size={14} />} {dark ? "Light" : "Dark"}
            </button>
          </div>
          <div style={{ color: C.gold, fontSize: 20, marginBottom: 2 }}>✦</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: 0, letterSpacing: 0.5, fontFamily: "'Georgia', serif" }}>Barnett Event Planning Services</h1>
          <div style={{ width: 60, height: 2, background: C.gold, margin: "10px auto 0" }} />
          <p style={{ color: C.mutedDk, fontSize: 14, marginTop: 8 }}>Seating Chart Planner</p>
        </div>

        {Object.keys(savedByEvent).length > 0 && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12, marginTop: -12 }}>
              <button onClick={() => setExpandedEvt(expandedEvt != null ? null : "__all__")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: C.mutedDk, fontSize: 13, padding: "4px 0" }}>
                📂 Saved Events ({saved.length})
                {expandedEvt != null ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
            {expandedEvt != null && (
              <div style={{ marginBottom: 24, animation: "fadeSlide 0.2s ease-out" }}>
                {Object.entries(savedByEvent).map(([evt, versions]) => (
                  <div key={evt} style={{ marginBottom: 8, border: `1px solid ${C.border}`, borderRadius: 8, background: C.cardBg, overflow: "hidden" }}>
                    <button onClick={() => setExpandedEvt(expandedEvt === evt ? "__all__" : evt)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 14px", background: expandedEvt === evt ? C.goldPale : "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: C.text, fontFamily: "'Georgia', serif" }}>
                      <span>{evt}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontWeight: 400, color: C.mutedDk, fontSize: 12, fontFamily: "system-ui" }}>
                        {versions.length} ver. {expandedEvt === evt ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    </button>
                    {expandedEvt === evt && versions.map(v => (
                      <div key={v.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px 8px 22px", borderTop: `1px solid ${C.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v.version}</div>
                          {v.date && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{new Date(v.date).toLocaleString()}</div>}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => loadEvent(v.key)} style={{ padding: "5px 14px", background: C.navy, color: C.gold, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Open</button>
                          <button onClick={() => duplicateEvent(v.key)} title="Duplicate" style={{ padding: "5px 8px", background: "none", color: C.mutedDk, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}><Copy size={12} /></button>
                          <button onClick={() => deleteEvent(v.key)} style={{ padding: "5px 8px", background: "none", color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <label style={lblSt}>Event Name</label>
        <input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Holiday Dinner 2026" style={inpSt} />
        <label style={{ ...lblSt, marginTop: 20 }}>Guest List <span style={{ fontWeight: 400, color: C.mutedDk }}>(one name per line)</span></label>
        <textarea value={guestText} onChange={e => setGuestText(e.target.value)} placeholder={"John Smith\nJane Doe\nBob Jones\n..."} rows={7} style={{ ...inpSt, resize: "vertical", fontFamily: "inherit" }} />
        {guestCount > 0 && <div style={{ fontSize: 13, color: C.green, marginTop: 4 }}>✓ {guestCount} guest{guestCount !== 1 ? "s" : ""} found</div>}
        <div style={{ marginTop: 24, marginBottom: 8 }}>
          <label style={lblSt}>Table Configuration</label>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={() => setTblMode("uniform")} style={tblMode === "uniform" ? tabAct : tabIn}>All Same Size</button>
            <button onClick={() => setTblMode("custom")} style={tblMode === "custom" ? tabAct : tabIn}>Different Sizes</button>
          </div>
        </div>
        {tblMode === "uniform" ? (
          <div style={cardSt}>
            <div style={{ ...rowSt, marginBottom: 8 }}><span style={{ fontSize: 14 }}>Shape</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setUShape("rect")} style={uShape === "rect" ? tabAct : tabIn}>▬ Rectangle</button>
                <button onClick={() => setUShape("circle")} style={uShape === "circle" ? tabAct : tabIn}>● Round</button>
              </div>
            </div>
            <div style={rowSt}><span style={{ fontSize: 14 }}>Number of tables</span><input type="number" min={1} max={30} value={uCnt} onChange={e => setUCnt(Math.max(1, +e.target.value || 1))} style={numSt} /></div>
            <div style={rowSt}><span style={{ fontSize: 14 }}>Seats per table</span><input type="number" min={2} max={30} value={uSz} onChange={e => setUSz(+e.target.value || 4)} style={numSt} /></div>
            {uShape === "rect" && <div style={rowSt}><span style={{ fontSize: 14 }}>Seats per end</span><input type="number" min={0} max={10} value={uEnds} onChange={e => setUEnds(+e.target.value || 0)} style={numSt} /></div>}
            {setupErrU && <div style={{ color: C.red, fontSize: 12, marginTop: 4 }}>⚠ {setupErrU}</div>}
            {!setupErrU && uShape === "rect" && uniSide != null && <div style={{ fontSize: 12, color: C.mutedDk, marginTop: 6, fontStyle: "italic" }}>Layout: {uEnds > 0 ? `${uEnds} per end, ` : ""}{uniSide} per long side{uEnds === 0 ? " (no ends)" : ""}{uEnds > 0 && uniSide === uEnds ? " — it's a square!" : ""}</div>}
            {!setupErrU && uShape === "circle" && <div style={{ fontSize: 12, color: C.mutedDk, marginTop: 6, fontStyle: "italic" }}>{uSz} seats around a round table</div>}
            <div style={{ marginTop: 8, fontSize: 13, color: C.mutedDk, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              {uCnt} table{uCnt !== 1 ? "s" : ""} × {uSz} seats = <strong>{setupSeats}</strong> total seats
              {guestCount > 0 && <span style={{ color: setupSeats >= guestCount ? C.green : C.red, marginLeft: 8 }}>{setupSeats >= guestCount ? "✓" : "⚠"} {guestCount} guests</span>}
            </div>
          </div>
        ) : (
          <div style={cardSt}>
            {custom.map((t, i) => {
              const err = tblErr(t);
              return (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <input value={t.name} onChange={e => setCustom(c => c.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...numSt, width: 90, textAlign: "left" }} placeholder="Name" />
                  <button onClick={() => setCustom(c => c.map((x, j) => j === i ? { ...x, shape: x.shape === "rect" ? "circle" : "rect" } : x))}
                    style={{ padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer", fontSize: 11, color: C.text }}>{t.shape === "circle" ? "● Round" : "▬ Rectangle"}</button>
                  <span style={{ fontSize: 12, color: C.mutedDk }}>Seats</span>
                  <input type="number" min={2} max={30} value={t.size} onChange={e => setCustom(c => c.map((x, j) => j === i ? { ...x, size: +e.target.value || 4 } : x))} style={{ ...numSt, width: 48 }} />
                  {t.shape === "rect" && <><span style={{ fontSize: 12, color: C.mutedDk }}>Ends</span>
                    <input type="number" min={0} max={10} value={t.ends} onChange={e => setCustom(c => c.map((x, j) => j === i ? { ...x, ends: +e.target.value || 0 } : x))} style={{ ...numSt, width: 48 }} /></>}
                  {custom.length > 1 && <button onClick={() => setCustom(c => c.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: C.red, padding: 4 }}><Trash2 size={14} /></button>}
                  {err && <span style={{ fontSize: 11, color: C.red, width: "100%" }}>⚠ {err}</span>}
                </div>
              );
            })}
            <button onClick={() => setCustom(c => [...c, { name: `Table ${c.length + 1}`, size: 8, ends: 1, shape: "rect" }])} style={lnkBtn}><Plus size={14} /> Add Table</button>
            <div style={{ marginTop: 8, fontSize: 13, color: C.mutedDk, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
              {custom.length} table{custom.length !== 1 ? "s" : ""}, <strong>{setupSeats}</strong> total seats
              {guestCount > 0 && <span style={{ color: setupSeats >= guestCount ? C.green : C.red, marginLeft: 8 }}>{setupSeats >= guestCount ? "✓" : "⚠"} {guestCount} guests</span>}
            </div>
          </div>
        )}

        {setupError && <div style={{ marginTop: 16, padding: "10px 14px", background: dark ? "#3b1212" : "#fef2f2", border: `1px solid ${C.red}`, borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 500 }}>⚠ {setupError}</div>}

        {(() => {
          const ts = tblMode === "uniform" ? uCnt * uSz : custom.reduce((s, t) => s + t.size, 0);
          const gc = parseGuests(guestText).length;
          return gc > ts && gc > 0 && !setupError ? (
            <div style={{ marginTop: 16, padding: "10px 14px", background: C.highlight, border: `1px solid ${C.gold}`, borderRadius: 8, color: C.text, fontSize: 13 }}>
              ⚠ {gc} guests but only {ts} seats — some guests will remain unseated
            </div>
          ) : null;
        })()}

        <button onClick={beginSeating} disabled={beginAnim}
          style={{ ...priBtn, animation: beginAnim ? "beginPulse 0.6s ease-out" : "none", opacity: beginAnim ? 0.8 : 1, transition: "opacity 0.2s" }}>
          {beginAnim ? "Loading..." : "Begin Seating →"}
        </button>

        <div style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: C.muted, fontStyle: "italic", letterSpacing: 0.3 }}>Vibe Coded by WesB at a fancy gala</p>
        </div>
      </div>
    </div>
  );

  /* ═══════ SEATING ═══════ */
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg, fontFamily: "system-ui, -apple-system, sans-serif", color: C.text }}
      onClick={() => { setSelected(null); setTableDragOver(null); }}
      onDragEnd={() => { tableDragRef.current = null; setTableDragOver(null); dragRef.current = null; setOver(null); setIsDragging(false); }}>

      <style>{GLOBAL_CSS}</style>
      <SaveOverlay show={showSaveAnim} C={C} />

      {/* Header */}
      <div style={{ background: C.headerBg, color: "#fff", padding: "10px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: C.gold, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Georgia', serif" }}>Barnett Event Planning Services</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Georgia', serif" }}>{eventName || "Seating Chart"}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={e => { e.stopPropagation(); undo(); }} disabled={historyRef.current.length === 0} style={{ ...hdrBtnSt, opacity: historyRef.current.length === 0 ? 0.4 : 1 }} title="Undo (Ctrl+Z)"><Undo2 size={13} /></button>
            <button onClick={e => { e.stopPropagation(); redo(); }} disabled={futureRef.current.length === 0} style={{ ...hdrBtnSt, opacity: futureRef.current.length === 0 ? 0.4 : 1 }} title="Redo (Ctrl+Y)"><Redo2 size={13} /></button>
            <button onClick={e => { e.stopPropagation(); setShowSave(true); }} style={hdrBtnSt} title="Save version"><Save size={13} /> Save</button>
            <button onClick={e => { e.stopPropagation(); loadSavedList(); setShowLoad(true); }} style={hdrBtnSt} title="Load saved version">📂 Load</button>
            <button onClick={e => { e.stopPropagation(); exportJSON(); }} style={hdrBtnSt} title="Export as JSON"><Download size={13} /> Export</button>
            <button onClick={e => { e.stopPropagation(); setPhase("print"); }} style={hdrBtnSt} title="Print view"><Printer size={13} /> Print</button>
            <button onClick={e => { e.stopPropagation(); addNewTable(); }} style={hdrBtnSt} title="Add a new table"><Plus size={13} /> Table</button>
            <button onClick={e => { e.stopPropagation(); randomAssign(); }} style={hdrBtnSt} title="Randomly assign unseated guests">🎲</button>
            <button onClick={e => { e.stopPropagation(); clearAll(); }} style={hdrBtnSt} title="Clear all seats"><RotateCcw size={13} /></button>
            <button onClick={e => { e.stopPropagation(); setDark(!dark); }} style={hdrBtnSt} title={dark ? "Switch to light mode" : "Switch to dark mode"}>{dark ? <Sun size={13} /> : <Moon size={13} />}</button>
            <button onClick={e => { e.stopPropagation(); setPhase("setup"); }} style={hdrBtnSt} title="Back to setup"><ArrowLeft size={13} /> Setup</button>
          </div>
        </div>
        <div style={{ fontSize: 12, marginTop: 6, color: C.goldLt }}>
          {totalSeated} of {totalGuests} guests seated · {totalSeats} total seats · {tables.length} tables
          {saveMsg && <span style={{ marginLeft: 12, color: C.gold, fontWeight: 600 }}>{saveMsg}</span>}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Unseated sidebar */}
        <div style={{ width: 210, minWidth: 210, borderRight: `1px solid ${C.border}`, background: C.sidebarBg, display: "flex", flexDirection: "column", flexShrink: 0 }}
          onDragOver={e => { e.preventDefault(); setOver({ type: "unseated" }); }}
          onDragLeave={() => setOver(null)}
          onDrop={e => { e.preventDefault(); dDropU(); }}>
          <div style={{ padding: "10px 14px", fontWeight: 600, fontSize: 14, color: C.text, borderBottom: `1px solid ${C.border}`, background: C.goldPale, flexShrink: 0, fontFamily: "'Georgia', serif", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Unseated ({unseated.length})</span>
            <button onClick={(e) => { e.stopPropagation(); setShowAddGuest(true); }} title="Add guest" style={{ background: "none", border: "none", cursor: "pointer", color: C.text, display: "flex", padding: 2 }}><UserPlus size={16} /></button>
          </div>

          {/* Search */}
          <div style={{ padding: "6px 8px", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 8, top: 7, color: C.muted }} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search guests..."
                style={{ width: "100%", padding: "6px 8px 6px 28px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, outline: "none", boxSizing: "border-box", background: C.inputBg, color: C.text }} />
              {searchQ && <button onClick={() => setSearchQ("")} style={{ position: "absolute", right: 6, top: 5, background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14 }}>×</button>}
            </div>
          </div>

          {/* Add guest inline */}
          {showAddGuest && (
            <div style={{ padding: 8, borderBottom: `1px solid ${C.border}`, background: C.highlight }} onClick={e => e.stopPropagation()}>
              <textarea value={addGuestText} onChange={e => setAddGuestText(e.target.value)}
                placeholder="One name per line..." rows={3}
                style={{ width: "100%", padding: "6px 8px", border: `1px solid ${C.gold}`, borderRadius: 6, fontSize: 12, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", background: C.inputBg, color: C.text }}
                autoFocus onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addGuestsFromSeating(); } }} />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={addGuestsFromSeating} style={{ flex: 1, padding: "5px 0", background: C.navy, color: C.gold, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                <button onClick={() => { setShowAddGuest(false); setAddGuestText(""); }} style={{ flex: 1, padding: "5px 0", background: C.cardBg, color: C.mutedDk, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflow: "auto", padding: 8, background: over?.type === "unseated" ? C.highlight : "transparent", transition: "background 0.15s" }}
            onClick={e => { e.stopPropagation(); if (selected?.from === "table") { unseatGuest(selected.tableId, selected.seatIdx); setSelected(null); } }}>
            {filteredUnseated.length === 0 && !showAddGuest && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>{searchQ ? "No matches" : totalSeated === totalGuests && totalGuests > 0 ? "All guests seated! 🎉" : "No unseated guests"}</div>}
            {filteredUnseated.map(name => (
              <div key={name} draggable
                onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/seat", "1"); setDragImage(e, name, C); dStartU(name); }}
                onClick={e => { e.stopPropagation(); handleUnseatedClick(name); }}
                style={{
                  padding: "7px 10px", marginBottom: 3, borderRadius: 6, fontSize: 13, cursor: "grab", userSelect: "none",
                  fontFamily: "'Georgia', serif",
                  background: selected?.from === "unseated" && selected.name === name ? C.goldLt : C.bg,
                  border: selected?.from === "unseated" && selected.name === name ? `2px solid ${C.gold}` : "1px solid transparent",
                  color: C.text,
                }}>{name}</div>
            ))}
          </div>
        </div>

        {/* Tables canvas */}
        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {/* Zoom controls */}
          <div style={{ position: "sticky", top: 8, right: 8, zIndex: 10, display: "flex", justifyContent: "flex-end", padding: "0 12px", gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.cardBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.text }}><ZoomOut size={14} /></button>
            <button onClick={() => setZoom(1)} style={{ padding: "0 8px", height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.cardBg, cursor: "pointer", fontSize: 11, color: C.mutedDk, minWidth: 44 }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${C.border}`, background: C.cardBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.text }}><ZoomIn size={14} /></button>
          </div>
          <div style={{ padding: 20, display: "flex", flexWrap: "wrap", alignContent: "flex-start", justifyContent: "center", transform: `scale(${zoom})`, transformOrigin: "top center", minHeight: "100%" }}>
            {tables.map(t => t.shape === "circle" ? (
              <CircleTableVisual key={t.id} table={t} selected={selected} overTarget={over} C={C} isDragging={isDragging}
                onDragStartSeat={dStartS} onDragOverSeat={dOverS} onDragLeaveSeat={dLeaveS} onDropSeat={dDropS}
                onSeatClick={handleSeatClick} onSeatContext={handleSeatContext} onEditClick={setEditTid}
                onQuickResize={(tid, d) => resizeTable(tid, d)} isDragOver={tableDragOver === t.id}
                onTableDragStart={handleTableDragStart} onTableDragOver={handleTableDragOver} onTableDrop={handleTableDrop} />
            ) : (
              <RectTableVisual key={t.id} table={t} selected={selected} overTarget={over} C={C} isDragging={isDragging}
                onDragStartSeat={dStartS} onDragOverSeat={dOverS} onDragLeaveSeat={dLeaveS} onDropSeat={dDropS}
                onSeatClick={handleSeatClick} onSeatContext={handleSeatContext} onEditClick={setEditTid}
                onQuickResize={(tid, d) => resizeTable(tid, d)} isDragOver={tableDragOver === t.id}
                onTableDragStart={handleTableDragStart} onTableDragOver={handleTableDragOver} onTableDrop={handleTableDrop} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding: "8px 20px", background: C.cardBg, borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, textAlign: "center", flexShrink: 0 }}>
        💡 Click or drag to seat · Right-click to unseat · ⚙ or double-click to edit · Ctrl+Z undo
        <span style={{ float: "right", fontStyle: "italic" }}>Vibe Coded by WesB at a fancy gala</span>
      </div>

      {editTable && <TableEditModal table={editTable} tableCount={tables.length} C={C}
        onSave={(ch) => applyTableEdit(editTable.id, ch)}
        onDelete={() => deleteTable(editTable.id)}
        onClose={() => setEditTid(null)} />}
      {showSave && <SaveModal eventName={eventName} onSave={saveEvent} onClose={() => setShowSave(false)} C={C} />}
      {showLoad && (() => {
        const byEvt = {};
        saved.forEach(s => { (byEvt[s.event] = byEvt[s.event] || []).push(s); });
        return (
          <div onClick={() => setShowLoad(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: C.cardBg, borderRadius: 12, padding: 24, width: "100%", maxWidth: 440, maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: C.text, fontFamily: "'Georgia', serif" }}>Load Saved Seating</h3>
                <button onClick={() => setShowLoad(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.mutedDk }}><X size={18} /></button>
              </div>
              {saved.length === 0 && <p style={{ color: C.muted, fontSize: 14, textAlign: "center", padding: 20 }}>No saved versions yet</p>}
              {Object.entries(byEvt).map(([evt, versions]) => (
                <div key={evt} style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: C.goldPale, fontWeight: 600, fontSize: 14, color: C.text, fontFamily: "'Georgia', serif" }}>{evt}</div>
                  {versions.map(v => (
                    <div key={v.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderTop: `1px solid ${C.border}` }}>
                      <div>
                        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{v.version}</div>
                        {v.date && <div style={{ fontSize: 11, color: C.muted }}>{new Date(v.date).toLocaleString()}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => { loadEvent(v.key); setShowLoad(false); }} style={{ padding: "5px 14px", background: C.navy, color: C.gold, border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Load</button>
                        <button onClick={() => duplicateEvent(v.key)} title="Duplicate" style={{ padding: "5px 8px", background: "none", color: C.mutedDk, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}><Copy size={12} /></button>
                        <button onClick={() => deleteEvent(v.key)} style={{ padding: "5px 8px", background: "none", color: C.red, border: `1px solid ${C.red}`, borderRadius: 6, fontSize: 11, cursor: "pointer" }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
