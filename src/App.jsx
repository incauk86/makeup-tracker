import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ABSENCE_TYPES = ["Sick Leave","Personal Emergency","Unauthorised Absence","Lateness","Early Departure","Holiday","Other"];
const TOIL_REASONS  = ["Project Deadline","Client Emergency","Weekend Work","Event Coverage","Training Delivery","Other"];
const STATUSES      = ["Pending","Scheduled","In Progress","Completed","Partially Completed","Cancelled"];
const PIE_COLORS    = ["#f59e0b","#3b82f6","#8b5cf6","#10b981","#06b6d4","#ef4444","#ec4899","#84cc16"];
const STATUS_COLORS = { "Pending":"#f59e0b","Scheduled":"#3b82f6","In Progress":"#8b5cf6","Completed":"#10b981","Partially Completed":"#06b6d4","Cancelled":"#ef4444" };

const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const today      = () => new Date().toISOString().split("T")[0];
const fmtDate    = (d) => { if (!d) return "—"; try { return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } };

const iStyle = { width:"100%", background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", padding:"9px 12px", color:"#f1f5f9", fontSize:"13px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" };
const sStyle = { ...iStyle, cursor:"pointer" };

const StatusBadge = ({ status }) => (
  <span style={{ background:(STATUS_COLORS[status]||"#888")+"22", color:STATUS_COLORS[status]||"#888", border:`1px solid ${STATUS_COLORS[status]||"#888"}55`, borderRadius:"9999px", padding:"2px 10px", fontSize:"11px", fontWeight:700, whiteSpace:"nowrap" }}>{status}</span>
);
const TypeBadge = ({ type }) => (
  <span style={{ background:type==="toil"?"#8b5cf622":"#f59e0b22", color:type==="toil"?"#8b5cf6":"#f59e0b", border:`1px solid ${type==="toil"?"#8b5cf6":"#f59e0b"}55`, borderRadius:"9999px", padding:"2px 8px", fontSize:"10px", fontWeight:700, whiteSpace:"nowrap" }}>{type==="toil"?"TOIL":"Makeup"}</span>
);
const Field = ({ label, children }) => (
  <div>
    <label style={{ display:"block", fontSize:"11px", fontWeight:600, color:"#94a3b8", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</label>
    {children}
  </div>
);
const Card = ({ children, style }) => (
  <div style={{ background:"#1e293b", borderRadius:"14px", padding:"20px", border:"1px solid #334155", ...style }}>{children}</div>
);
const Empty = ({ msg }) => (
  <div style={{ textAlign:"center", padding:"40px 0", color:"#64748b", fontSize:"14px" }}>
    <div style={{ fontSize:"32px", marginBottom:"8px" }}>📋</div>{msg}
  </div>
);

function ChangePasswordModal({ currentUser, allUsers, onSaveUsers, onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const handle = async () => {
    setError("");
    if (current !== currentUser.password) { setError("Current password is incorrect."); return; }
    if (next.length < 6)                  { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm)                 { setError("New passwords do not match."); return; }
    const updated = allUsers.map(u => u.id === currentUser.id ? { ...u, password: next } : u);
    await supabase.from("users").update({ password: next }).eq("id", currentUser.id);
    onSaveUsers(updated);
    currentUser.password = next;
    setSuccess(true);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#1e293b", borderRadius:"16px", padding:"28px", border:"1px solid #334155", width:"100%", maxWidth:"380px", margin:"0 24px" }} onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontWeight:700, fontSize:"17px", marginBottom:"4px", color:"#f8fafc" }}>Change Password</h3>
        <p style={{ fontSize:"12px", color:"#64748b", marginBottom:"20px" }}>Signed in as {currentUser.email}</p>
        {success ? (
          <div style={{ textAlign:"center", padding:"16px 0" }}>
            <div style={{ fontSize:"32px", marginBottom:"8px" }}>✅</div>
            <div style={{ fontWeight:600, color:"#10b981", marginBottom:"16px" }}>Password updated successfully</div>
            <button onClick={onClose} style={{ padding:"9px 24px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>Done</button>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            <Field label="Current Password"><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="••••••••" style={iStyle}/></Field>
            <Field label="New Password"><input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="Min. 6 characters" style={iStyle}/></Field>
            <Field label="Confirm New Password"><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            {error && <div style={{ color:"#ef4444", fontSize:"12px" }}>{error}</div>}
            <div style={{ display:"flex", gap:"8px", marginTop:"4px" }}>
              <button onClick={handle} style={{ flex:1, padding:"9px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>Update Password</button>
              <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:"9px", border:"1px solid #334155", cursor:"pointer", fontSize:"13px", fontWeight:600, background:"transparent", color:"#94a3b8" }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryTable({ entries, onEdit, onDelete, currentUser }) {
  const sorted  = [...entries].sort((a,b) => b.absenceDate?.localeCompare(a.absenceDate));
  const canEdit = ["admin","manager"].includes(currentUser.role);
  return (
    <div style={{ background:"#1e293b", borderRadius:"14px", border:"1px solid #334155", overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr style={{ background:"#0f172a", borderBottom:"1px solid #334155" }}>
            {["Type","Member","Date","Reason/Type","Hours","Makeup/TOIL Date","Authorised By","Status",canEdit&&"Actions"].filter(Boolean).map(h=>(
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:"10px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e,i) => (
            <tr key={e.id} style={{ borderBottom:"1px solid #1e293b", background:i%2===0?"transparent":"#ffffff05" }}>
              <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}><TypeBadge type={e.entryType}/></td>
              <td style={{ padding:"10px 14px", fontWeight:600, whiteSpace:"nowrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <div style={{ width:"24px", height:"24px", borderRadius:"50%", background:`hsl(${(e.memberName||"?").charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:700 }}>{(e.memberName||"?")[0]}</div>
                  {e.memberName}
                </div>
              </td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:"12px", color:"#94a3b8", whiteSpace:"nowrap" }}>{fmtDate(e.absenceDate)}</td>
              <td style={{ padding:"10px 14px", fontSize:"12px", color:"#cbd5e1", whiteSpace:"nowrap" }}>{e.absenceType}</td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontWeight:700, color:e.entryType==="toil"?"#8b5cf6":"#f59e0b", whiteSpace:"nowrap" }}>{e.hoursOwed}h</td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:"12px", color:"#94a3b8", whiteSpace:"nowrap" }}>{fmtDate(e.makeupDate)}</td>
              <td style={{ padding:"10px 14px", fontSize:"12px", color:"#cbd5e1", whiteSpace:"nowrap" }}>{e.authorisedBy||"—"}</td>
              <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}><StatusBadge status={e.status}/></td>
              {canEdit && (
                <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <button onClick={()=>onEdit(e)} style={{ padding:"4px 8px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"11px" }}>✏️</button>
                    <button onClick={()=>onDelete(e.id)} style={{ padding:"4px 8px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:"11px" }}>🗑</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoginPage({ onLogin, allUsers }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const handle = () => {
    const user = allUsers.find(u => u.email.toLowerCase()===email.toLowerCase() && u.password===password);
    if (user) onLogin(user);
    else setError("Email or password incorrect.");
  };
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans','Segoe UI',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{ width:"100%", maxWidth:"380px", padding:"0 24px" }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <div style={{ width:"56px", height:"56px", borderRadius:"14px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"26px", margin:"0 auto 16px" }}>⏱</div>
          <div style={{ fontWeight:700, fontSize:"22px", color:"#f8fafc" }}>Makeup Time Tracker</div>
          <div style={{ fontSize:"13px", color:"#64748b", marginTop:"4px" }}>Enroly Assessment Team</div>
        </div>
        <Card>
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@enroly.com" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            <Field label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            {error && <div style={{ color:"#ef4444", fontSize:"13px" }}>{error}</div>}
            <button onClick={handle} style={{ width:"100%", padding:"11px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>Sign In</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmployeeView({ currentUser, allEntries, allUsers, onSave, onSaveUsers, onLogout }) {
  const myEntries  = allEntries.filter(e => e.userId===currentUser.id);
  const [view, setView]             = useState("new");
  const [mode, setMode]             = useState("makeup"); // makeup | toil
  const [entries_list, setEntriesList] = useState([buildMakeupRow()]);
  const [toil_list, setToilList]    = useState([buildToilRow()]);
  const [toast, setToast]           = useState(null);
  const [showPwd, setShowPwd]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function buildMakeupRow() { return { id:generateId(), absenceDate:today(), absenceType:"Sick Leave", hoursOwed:"", makeupDate:"", comments:"" }; }
  function buildToilRow()   { return { id:generateId(), absenceDate:today(), absenceType:"Project Deadline", hoursOwed:"", makeupDate:"", comments:"" }; }

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const updateRow = (list,setList,idx,field,value) => setList(prev=>prev.map((r,i)=>i===idx?{...r,[field]:value}:r));
  const addMakeupRow = () => setEntriesList(prev=>[...prev,buildMakeupRow()]);
  const addToilRow   = () => setToilList(prev=>[...prev,buildToilRow()]);
  const removeMakeupRow = (idx) => { if(entries_list.length===1)return; setEntriesList(prev=>prev.filter((_,i)=>i!==idx)); };
  const removeToilRow   = (idx) => { if(toil_list.length===1)return; setToilList(prev=>prev.filter((_,i)=>i!==idx)); };

  const submitMakeup = async () => {
    const invalid = entries_list.find(r=>!r.absenceDate||!r.hoursOwed||!r.makeupDate);
    if (invalid) { showToast("Please fill in all required fields for each entry","error"); return; }
    setSubmitting(true);
    for (const row of entries_list) {
      await onSave({ ...row, id:generateId(), entryType:"makeup", userId:currentUser.id, memberName:currentUser.name, authorisedBy:"Pending approval", status:"Pending", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    }
    showToast(`${entries_list.length} request${entries_list.length>1?"s":""} submitted.`);
    setEntriesList([buildMakeupRow()]);
    setSubmitting(false);
    setView("history");
  };

  const submitToil = async () => {
    const invalid = toil_list.find(r=>!r.absenceDate||!r.hoursOwed);
    if (invalid) { showToast("Please fill in all required fields for each entry","error"); return; }
    setSubmitting(true);
    for (const row of toil_list) {
      await onSave({ ...row, id:generateId(), entryType:"toil", userId:currentUser.id, memberName:currentUser.name, authorisedBy:"Pending approval", status:"Pending", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    }
    showToast(`${toil_list.length} overtime request${toil_list.length>1?"s":""} logged.`);
    setToilList([buildToilRow()]);
    setSubmitting(false);
    setView("history");
  };

  const myMakeup = myEntries.filter(e=>e.entryType!=="toil");
  const myToil   = myEntries.filter(e=>e.entryType==="toil");

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#0f172a", minHeight:"100vh", color:"#f1f5f9", fontSize:"14px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {toast && <div style={{ position:"fixed", top:"16px", right:"16px", zIndex:9999, background:toast.type==="error"?"#ef4444":"#10b981", color:"#fff", borderRadius:"10px", padding:"10px 18px", fontSize:"13px", fontWeight:600 }}>{toast.msg}</div>}
      {showPwd && <ChangePasswordModal currentUser={currentUser} allUsers={allUsers} onSaveUsers={onSaveUsers} onClose={()=>setShowPwd(false)}/>}

      <div style={{ background:"#1e293b", borderBottom:"1px solid #334155", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"56px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px" }}>⏱</div>
          <span style={{ fontWeight:700, fontSize:"14px" }}>Makeup Time Tracker</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:`hsl(${currentUser.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700 }}>{currentUser.name[0]}</div>
          <span style={{ fontSize:"13px", color:"#94a3b8" }}>{currentUser.name}</span>
          <button onClick={()=>setShowPwd(true)} style={{ padding:"5px 10px", borderRadius:"7px", border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"12px" }}>🔑 Change Password</button>
          <button onClick={onLogout} style={{ padding:"5px 10px", borderRadius:"7px", border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:"12px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding:"24px", maxWidth:"680px", margin:"0 auto" }}>
        {/* Main nav */}
        <div style={{ display:"flex", gap:"8px", marginBottom:"24px" }}>
          {[["new","📝 New Entry"],["history","🕐 My History"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"8px 16px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, background:view===v?"#f59e0b":"#1e293b", color:view===v?"#0f172a":"#94a3b8" }}>{l}</button>
          ))}
        </div>

        {view==="new" && (
          <div>
            {/* Mode toggle */}
            <div style={{ display:"flex", gap:"0", marginBottom:"24px", background:"#1e293b", borderRadius:"10px", padding:"4px", border:"1px solid #334155" }}>
              <button onClick={()=>setMode("makeup")} style={{ flex:1, padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, background:mode==="makeup"?"#f59e0b":"transparent", color:mode==="makeup"?"#0f172a":"#94a3b8", transition:"all 0.15s" }}>
                ⏱ Make Up Time
              </button>
              <button onClick={()=>setMode("toil")} style={{ flex:1, padding:"8px 16px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, background:mode==="toil"?"#8b5cf6":"transparent", color:mode==="toil"?"#fff":"#94a3b8", transition:"all 0.15s" }}>
                🕐 Log Overtime (TOIL)
              </button>
            </div>

            {/* MAKEUP FORM */}
            {mode==="makeup" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
                  <div>
                    <h2 style={{ fontSize:"17px", fontWeight:700, color:"#f8fafc", margin:0 }}>Submit Makeup Time Requests</h2>
                    <p style={{ fontSize:"12px", color:"#64748b", margin:"4px 0 0" }}>For time you owe us — absences, lateness, etc.</p>
                  </div>
                  <button onClick={addMakeupRow} style={{ padding:"7px 14px", borderRadius:"8px", border:"1px dashed #334155", background:"transparent", color:"#f59e0b", cursor:"pointer", fontSize:"12px", fontWeight:600 }}>+ Add Another</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  {entries_list.map((row,idx)=>(
                    <Card key={row.id}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                        <span style={{ fontSize:"13px", fontWeight:700, color:"#94a3b8" }}>Absence {idx+1}</span>
                        {entries_list.length>1 && <button onClick={()=>removeMakeupRow(idx)} style={{ padding:"3px 8px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:"11px" }}>✕ Remove</button>}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                        <Field label="Date of Absence *"><input type="date" value={row.absenceDate} onChange={e=>updateRow(entries_list,setEntriesList,idx,"absenceDate",e.target.value)} style={iStyle}/></Field>
                        <Field label="Absence Type *">
                          <select value={row.absenceType} onChange={e=>updateRow(entries_list,setEntriesList,idx,"absenceType",e.target.value)} style={sStyle}>
                            {ABSENCE_TYPES.map(t=><option key={t}>{t}</option>)}
                          </select>
                        </Field>
                        <Field label="Hours Owed *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={row.hoursOwed} onChange={e=>updateRow(entries_list,setEntriesList,idx,"hoursOwed",e.target.value)} style={iStyle}/></Field>
                        <Field label="Proposed Makeup Date *"><input type="date" value={row.makeupDate} onChange={e=>updateRow(entries_list,setEntriesList,idx,"makeupDate",e.target.value)} style={iStyle}/></Field>
                        <div style={{ gridColumn:"1 / -1" }}>
                          <Field label="Comments"><textarea rows={2} placeholder="Any additional details..." value={row.comments} onChange={e=>updateRow(entries_list,setEntriesList,idx,"comments",e.target.value)} style={{ ...iStyle, resize:"vertical" }}/></Field>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{ marginTop:"20px", display:"flex", gap:"12px" }}>
                  <button onClick={submitMakeup} disabled={submitting} style={{ padding:"10px 24px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#f59e0b", color:"#0f172a", opacity:submitting?0.7:1 }}>
                    {submitting?"Submitting...":`✅ Submit ${entries_list.length>1?`${entries_list.length} Requests`:"Request"}`}
                  </button>
                  <button onClick={addMakeupRow} style={{ padding:"10px 16px", borderRadius:"10px", border:"1px dashed #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"13px" }}>+ Add Another</button>
                </div>
              </div>
            )}

            {/* TOIL FORM */}
            {mode==="toil" && (
              <div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
                  <div>
                    <h2 style={{ fontSize:"17px", fontWeight:700, color:"#f8fafc", margin:0 }}>Log Overtime (TOIL)</h2>
                    <p style={{ fontSize:"12px", color:"#64748b", margin:"4px 0 0" }}>For extra hours you've worked — we owe you this time back.</p>
                  </div>
                  <button onClick={addToilRow} style={{ padding:"7px 14px", borderRadius:"8px", border:"1px dashed #334155", background:"transparent", color:"#8b5cf6", cursor:"pointer", fontSize:"12px", fontWeight:600 }}>+ Add Another</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  {toil_list.map((row,idx)=>(
                    <Card key={row.id} style={{ border:"1px solid #8b5cf633" }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                        <span style={{ fontSize:"13px", fontWeight:700, color:"#8b5cf6" }}>Overtime Entry {idx+1}</span>
                        {toil_list.length>1 && <button onClick={()=>removeToilRow(idx)} style={{ padding:"3px 8px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:"11px" }}>✕ Remove</button>}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
                        <Field label="Date Worked *"><input type="date" value={row.absenceDate} onChange={e=>updateRow(toil_list,setToilList,idx,"absenceDate",e.target.value)} style={iStyle}/></Field>
                        <Field label="Reason *">
                          <select value={row.absenceType} onChange={e=>updateRow(toil_list,setToilList,idx,"absenceType",e.target.value)} style={sStyle}>
                            {TOIL_REASONS.map(t=><option key={t}>{t}</option>)}
                          </select>
                        </Field>
                        <Field label="Hours Worked Overtime *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 3" value={row.hoursOwed} onChange={e=>updateRow(toil_list,setToilList,idx,"hoursOwed",e.target.value)} style={iStyle}/></Field>
                        <Field label="Proposed TOIL Date (optional)"><input type="date" value={row.makeupDate} onChange={e=>updateRow(toil_list,setToilList,idx,"makeupDate",e.target.value)} style={iStyle}/></Field>
                        <div style={{ gridColumn:"1 / -1" }}>
                          <Field label="Notes"><textarea rows={2} placeholder="What were you working on? Any context for your manager..." value={row.comments} onChange={e=>updateRow(toil_list,setToilList,idx,"comments",e.target.value)} style={{ ...iStyle, resize:"vertical" }}/></Field>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{ marginTop:"20px", display:"flex", gap:"12px" }}>
                  <button onClick={submitToil} disabled={submitting} style={{ padding:"10px 24px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#8b5cf6", color:"#fff", opacity:submitting?0.7:1 }}>
                    {submitting?"Submitting...":`🕐 Log ${toil_list.length>1?`${toil_list.length} Entries`:"Overtime"}`}
                  </button>
                  <button onClick={addToilRow} style={{ padding:"10px 16px", borderRadius:"10px", border:"1px dashed #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"13px" }}>+ Add Another</button>
                </div>
                <p style={{ marginTop:"12px", fontSize:"12px", color:"#64748b" }}>Your manager will review and confirm. Once approved, you can use this time as leave.</p>
              </div>
            )}
          </div>
        )}

        {view==="history" && (
          <div>
            {/* Summary pills */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"20px" }}>
              <div style={{ background:"#1e293b", borderRadius:"12px", padding:"14px 16px", border:"1px solid #f59e0b44" }}>
                <div style={{ fontSize:"11px", color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"4px" }}>Hours I Owe</div>
                <div style={{ fontSize:"24px", fontWeight:700, fontFamily:"monospace", color:"#f59e0b" }}>{myMakeup.filter(e=>e.status!=="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h</div>
                <div style={{ fontSize:"11px", color:"#64748b", marginTop:"2px" }}>{myMakeup.length} entries</div>
              </div>
              <div style={{ background:"#1e293b", borderRadius:"12px", padding:"14px 16px", border:"1px solid #8b5cf644" }}>
                <div style={{ fontSize:"11px", color:"#8b5cf6", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"4px" }}>TOIL Owed to Me</div>
                <div style={{ fontSize:"24px", fontWeight:700, fontFamily:"monospace", color:"#8b5cf6" }}>{myToil.filter(e=>e.status!=="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h</div>
                <div style={{ fontSize:"11px", color:"#64748b", marginTop:"2px" }}>{myToil.length} entries</div>
              </div>
            </div>

            <h2 style={{ fontSize:"17px", fontWeight:700, marginBottom:"16px" }}>My Requests</h2>
            {myEntries.length===0 ? <Empty msg="No requests submitted yet"/> : (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {[...myEntries].sort((a,b)=>b.absenceDate?.localeCompare(a.absenceDate)).map(e=>(
                  <Card key={e.id} style={{ padding:"16px", borderColor:e.entryType==="toil"?"#8b5cf633":"#334155" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
                          <TypeBadge type={e.entryType}/>
                          <span style={{ fontWeight:700, fontSize:"14px" }}>{fmtDate(e.absenceDate)} — {e.absenceType}</span>
                        </div>
                        <div style={{ fontSize:"12px", color:"#64748b" }}>
                          <span style={{ color:e.entryType==="toil"?"#8b5cf6":"#f59e0b", fontWeight:700 }}>{e.hoursOwed}h</span>
                          {e.entryType==="toil" ? " overtime worked" : " owed"} {e.makeupDate ? `· ${e.entryType==="toil"?"TOIL":"Makeup"}: ${fmtDate(e.makeupDate)}` : ""}
                        </div>
                        {e.comments && <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>{e.comments}</div>}
                        {e.managerNotes && <div style={{ fontSize:"12px", color:"#94a3b8", marginTop:"6px", background:"#0f172a", borderRadius:"6px", padding:"6px 10px" }}>Manager note: {e.managerNotes}</div>}
                      </div>
                      <StatusBadge status={e.status}/>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ManagerView({ currentUser, allEntries, allUsers, onSaveEntry, onDeleteEntry, onSaveUsers, onLogout }) {
  const [view, setView]                 = useState("dashboard");
  const [activeMember, setActiveMember] = useState(null);
  const [editEntry, setEditEntry]       = useState(null);
  const [form, setForm]                 = useState(buildEntryForm(null,currentUser,"makeup"));
  const [toast, setToast]               = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType]     = useState("All");
  const [userForm, setUserForm]         = useState({ name:"", email:"", password:"", role:"employee" });
  const [userError, setUserError]       = useState("");
  const [showPwd, setShowPwd]           = useState(false);

  function buildEntryForm(member,cu,type="makeup") {
    return { userId:member?.id||"", memberName:member?.name||"", absenceDate:today(), absenceType:type==="toil"?"Project Deadline":"Sick Leave", hoursOwed:"", makeupDate:"", authorisedBy:cu?.name||"", comments:"", status:"Pending", managerNotes:"", entryType:type };
  }

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const employees = allUsers.filter(u=>u.role==="employee");
  const managers  = allUsers.filter(u=>["manager","admin"].includes(u.role));

  const handleSaveEntry = () => {
    if (!form.userId||!form.absenceDate||!form.hoursOwed) { showToast("Fill in all required fields","error"); return; }
    const isEdit = !!editEntry;
    const entry  = isEdit ? { ...editEntry, ...form, updatedAt:new Date().toISOString() } : { ...form, id:generateId(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    onSaveEntry(entry,isEdit);
    showToast(isEdit?"Entry updated":"Entry added");
    setEditEntry(null); setForm(buildEntryForm(null,currentUser,"makeup")); setView(activeMember?"member":"log");
  };

  const openEdit = (entry) => { setForm({...entry}); setEditEntry(entry); setView("edit"); };
  const openAdd  = (member=null,type="makeup") => { setForm(buildEntryForm(member,currentUser,type)); setEditEntry(null); setView("add"); };
  const handleDelete = (id) => { if(!window.confirm("Delete this entry?"))return; onDeleteEntry(id); showToast("Deleted"); };

  const addUser = () => {
    setUserError("");
    if (!userForm.name||!userForm.email||!userForm.password) { setUserError("All fields are required."); return; }
    if (allUsers.find(u=>u.email.toLowerCase()===userForm.email.toLowerCase())) { setUserError("That email is already registered."); return; }
    onSaveUsers([...allUsers,{ id:generateId(),...userForm }]);
    setUserForm({ name:"", email:"", password:"", role:"employee" });
    showToast(`${userForm.name} added`);
  };

  const removeUser = (id) => {
    if (id===currentUser.id) { showToast("You can't remove yourself","error"); return; }
    if (!window.confirm("Remove this user?")) return;
    onSaveUsers(allUsers.filter(u=>u.id!==id));
    showToast("User removed");
  };

  const memberEntries = (uid) => allEntries.filter(e=>e.userId===uid);
  const makeupEntries = allEntries.filter(e=>e.entryType!=="toil");
  const toilEntries   = allEntries.filter(e=>e.entryType==="toil");

  let filteredEntries = allEntries;
  if (filterType!=="All") filteredEntries = filteredEntries.filter(e=>e.entryType===filterType);
  if (filterStatus!=="All") filteredEntries = filteredEntries.filter(e=>e.status===filterStatus);

  const totalMakeupHours = makeupEntries.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const totalToilHours   = toilEntries.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedMakeup  = makeupEntries.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedToil    = toilEntries.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const pendingCount     = allEntries.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length;

  const memberSummary = employees.map(u=>{
    const me    = memberEntries(u.id);
    const mkup  = me.filter(e=>e.entryType!=="toil");
    const toil  = me.filter(e=>e.entryType==="toil");
    return {
      name: u.name,
      makeup: mkup.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0),
      toil:   toil.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0),
      open:   me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length,
      count:  me.length,
    };
  }).filter(m=>m.count>0);

  const statusSummary = STATUSES.map(s=>({ name:s, value:allEntries.filter(e=>e.status===s).length })).filter(s=>s.value>0);
  const monthlyMap    = {};
  allEntries.forEach(e=>{
    const mo=e.absenceDate?.slice(0,7); if(!mo)return;
    if(!monthlyMap[mo])monthlyMap[mo]={month:mo,makeup:0,toil:0};
    if(e.entryType==="toil") monthlyMap[mo].toil+=parseFloat(e.hoursOwed)||0;
    else monthlyMap[mo].makeup+=parseFloat(e.hoursOwed)||0;
  });
  const monthlyData = Object.values(monthlyMap).sort((a,b)=>a.month.localeCompare(b.month)).slice(-8).map(d=>({...d,label:new Date(d.month+"-01").toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}));

  const navItems = [["dashboard","📊 Dashboard"],["log","📋 All Entries"],["member","👥 By Member"],...(currentUser.role==="admin"?[["users","⚙️ Users"]]:[])];

  return (
    <div style={{ fontFamily:"'DM Sans','Segoe UI',sans-serif", background:"#0f172a", minHeight:"100vh", color:"#f1f5f9", fontSize:"14px" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {toast && <div style={{ position:"fixed", top:"16px", right:"16px", zIndex:9999, background:toast.type==="error"?"#ef4444":"#10b981", color:"#fff", borderRadius:"10px", padding:"10px 18px", fontSize:"13px", fontWeight:600, boxShadow:"0 4px 20px rgba(0,0,0,0.4)" }}>{toast.msg}</div>}
      {showPwd && <ChangePasswordModal currentUser={currentUser} allUsers={allUsers} onSaveUsers={onSaveUsers} onClose={()=>setShowPwd(false)}/>}

      <div style={{ background:"#1e293b", borderBottom:"1px solid #334155", padding:"0 24px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"56px", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:"linear-gradient(135deg,#f59e0b,#ef4444)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px" }}>⏱</div>
          <div>
            <div style={{ fontWeight:700, fontSize:"14px" }}>Makeup Time Tracker</div>
            <div style={{ fontSize:"10px", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em" }}>Enroly · {currentUser.role==="admin"?"Admin":"Manager"}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
          {navItems.map(([v,l])=>(
            <button key={v} onClick={()=>{setView(v);setActiveMember(null);}} style={{ padding:"6px 12px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:600, background:view===v?"#f59e0b":"transparent", color:view===v?"#0f172a":"#94a3b8" }}>{l}</button>
          ))}
          <button onClick={()=>openAdd()} style={{ padding:"6px 14px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"#10b981", color:"#fff" }}>+ New Entry</button>
          <div style={{ width:"1px", height:"20px", background:"#334155", margin:"0 4px" }}/>
          <div style={{ width:"28px", height:"28px", borderRadius:"50%", background:`hsl(${currentUser.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700 }}>{currentUser.name[0]}</div>
          <span style={{ fontSize:"13px", color:"#94a3b8" }}>{currentUser.name}</span>
          <button onClick={()=>setShowPwd(true)} style={{ padding:"5px 10px", borderRadius:"7px", border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:"12px" }}>🔑 Change Password</button>
          <button onClick={onLogout} style={{ padding:"5px 10px", borderRadius:"7px", border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:"12px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding:"24px", maxWidth:"1200px", margin:"0 auto" }}>

        {view==="dashboard" && (
          <div>
            <h2 style={{ fontSize:"20px", fontWeight:700, marginBottom:"20px" }}>Team Overview</h2>

            {/* KPI row */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", marginBottom:"16px" }}>
              {/* Makeup side */}
              <div style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #f59e0b44", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:"#f59e0b" }}/>
                <div style={{ fontSize:"11px", color:"#f59e0b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"8px" }}>⏱ Makeup Time</div>
                <div style={{ display:"flex", gap:"16px" }}>
                  <div>
                    <div style={{ fontSize:"22px", fontWeight:700, color:"#f59e0b", fontFamily:"monospace" }}>{totalMakeupHours.toFixed(1)}h</div>
                    <div style={{ fontSize:"11px", color:"#64748b" }}>Total owed to us</div>
                  </div>
                  <div>
                    <div style={{ fontSize:"22px", fontWeight:700, color:"#10b981", fontFamily:"monospace" }}>{completedMakeup.toFixed(1)}h</div>
                    <div style={{ fontSize:"11px", color:"#64748b" }}>Recovered</div>
                  </div>
                </div>
              </div>

              {/* TOIL side */}
              <div style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #8b5cf644", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:"#8b5cf6" }}/>
                <div style={{ fontSize:"11px", color:"#8b5cf6", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"8px" }}>🕐 TOIL (We Owe Team)</div>
                <div style={{ display:"flex", gap:"16px" }}>
                  <div>
                    <div style={{ fontSize:"22px", fontWeight:700, color:"#8b5cf6", fontFamily:"monospace" }}>{totalToilHours.toFixed(1)}h</div>
                    <div style={{ fontSize:"11px", color:"#64748b" }}>Total owed to team</div>
                  </div>
                  <div>
                    <div style={{ fontSize:"22px", fontWeight:700, color:"#10b981", fontFamily:"monospace" }}>{completedToil.toFixed(1)}h</div>
                    <div style={{ fontSize:"11px", color:"#64748b" }}>TOIL taken</div>
                  </div>
                </div>
              </div>

              {/* Open cases */}
              <div style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #334155", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:"#ef4444" }}/>
                <div style={{ fontSize:"11px", color:"#64748b", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"8px" }}>Open Cases</div>
                <div style={{ fontSize:"32px", fontWeight:700, color:"#ef4444", fontFamily:"monospace" }}>{pendingCount}</div>
                <div style={{ fontSize:"11px", color:"#64748b" }}>Awaiting action</div>
              </div>
            </div>

            {allEntries.length===0 ? <Empty msg="No entries yet"/> : (
              <>
                {/* Monthly trend — both types */}
                <Card style={{ marginBottom:"16px" }}>
                  <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>Monthly Hours — Makeup vs TOIL</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                      <XAxis dataKey="label" tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                      <Legend wrapperStyle={{ fontSize:"11px" }}/>
                      <Bar dataKey="makeup" fill="#f59e0b" name="Makeup (owed to us)" radius={[4,4,0,0]}/>
                      <Bar dataKey="toil" fill="#8b5cf6" name="TOIL (we owe team)" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Per member chart */}
                {memberSummary.length>0 && (
                  <Card style={{ marginBottom:"16px" }}>
                    <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>Makeup vs TOIL — By Team Member</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={memberSummary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:12 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                        <Legend wrapperStyle={{ fontSize:"11px" }}/>
                        <Bar dataKey="makeup" fill="#f59e0b" name="Makeup (owed to us)" radius={[4,4,0,0]}/>
                        <Bar dataKey="toil" fill="#8b5cf6" name="TOIL (we owe them)" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {/* Status pie */}
                <Card>
                  <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>By Status</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={statusSummary} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {statusSummary.map((s,i)=><Cell key={i} fill={STATUS_COLORS[s.name]||PIE_COLORS[i]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                      <Legend wrapperStyle={{ fontSize:"11px" }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </>
            )}
          </div>
        )}

        {view==="log" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
              <h2 style={{ fontSize:"20px", fontWeight:700 }}>All Entries</h2>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:"11px", color:"#64748b" }}>Type:</span>
                {["All","makeup","toil"].map(t=>(
                  <button key={t} onClick={()=>setFilterType(t)} style={{ padding:"4px 10px", borderRadius:"9999px", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:600, background:filterType===t?(t==="toil"?"#8b5cf6":t==="makeup"?"#f59e0b":"#475569"):"#1e293b", color:filterType===t?"#fff":"#94a3b8" }}>{t==="All"?"All":t==="toil"?"TOIL":"Makeup"}</button>
                ))}
                <span style={{ fontSize:"11px", color:"#64748b", marginLeft:"4px" }}>Status:</span>
                {["All",...STATUSES].map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)} style={{ padding:"4px 10px", borderRadius:"9999px", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:600, background:filterStatus===s?(STATUS_COLORS[s]||"#475569"):"#1e293b", color:filterStatus===s?"#fff":"#94a3b8" }}>{s}</button>
                ))}
              </div>
            </div>
            {filteredEntries.length===0 ? <Empty msg="No entries found"/> : <EntryTable entries={filteredEntries} onEdit={openEdit} onDelete={handleDelete} currentUser={currentUser}/>}
          </div>
        )}

        {view==="member" && !activeMember && (
          <div>
            <h2 style={{ fontSize:"20px", fontWeight:700, marginBottom:"20px" }}>By Team Member</h2>
            {employees.length===0 ? <Empty msg="No employee accounts yet — add them in ⚙️ Users"/> : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"14px" }}>
                {employees.map(u=>{ const me=memberEntries(u.id); const mkup=me.filter(e=>e.entryType!=="toil"); const toil=me.filter(e=>e.entryType==="toil"); const open=me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length; return (
                  <div key={u.id} onClick={()=>setActiveMember(u)} style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #334155", cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b"} onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
                    <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:`hsl(${u.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"16px", marginBottom:"10px" }}>{u.name[0]}</div>
                    <div style={{ fontWeight:700 }}>{u.name}</div>
                    <div style={{ fontSize:"12px", color:"#f59e0b", marginTop:"4px" }}>⏱ {mkup.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h makeup</div>
                    <div style={{ fontSize:"12px", color:"#8b5cf6", marginTop:"2px" }}>🕐 {toil.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h TOIL</div>
                    {open>0 && <div style={{ marginTop:"8px" }}><StatusBadge status="Pending"/><span style={{ fontSize:"11px", color:"#64748b", marginLeft:"4px" }}>{open} open</span></div>}
                    <div style={{ display:"flex", gap:"6px", marginTop:"10px" }}>
                      <button onClick={e=>{e.stopPropagation();openAdd(u,"makeup");}} style={{ flex:1, padding:"4px 6px", borderRadius:"6px", border:"1px solid #f59e0b44", background:"transparent", color:"#f59e0b", fontSize:"10px", cursor:"pointer" }}>+ Makeup</button>
                      <button onClick={e=>{e.stopPropagation();openAdd(u,"toil");}} style={{ flex:1, padding:"4px 6px", borderRadius:"6px", border:"1px solid #8b5cf644", background:"transparent", color:"#8b5cf6", fontSize:"10px", cursor:"pointer" }}>+ TOIL</button>
                    </div>
                  </div>
                ); })}
              </div>
            )}
          </div>
        )}

        {view==="member" && activeMember && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" }}>
              <button onClick={()=>setActiveMember(null)} style={{ background:"transparent", border:"1px solid #334155", color:"#94a3b8", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"12px" }}>← Back</button>
              <div style={{ width:"36px", height:"36px", borderRadius:"50%", background:`hsl(${activeMember.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{activeMember.name[0]}</div>
              <h2 style={{ fontSize:"20px", fontWeight:700, margin:0 }}>{activeMember.name}</h2>
              <div style={{ marginLeft:"auto", display:"flex", gap:"8px" }}>
                <button onClick={()=>openAdd(activeMember,"makeup")} style={{ padding:"7px 14px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>+ Makeup</button>
                <button onClick={()=>openAdd(activeMember,"toil")} style={{ padding:"7px 14px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"#8b5cf6", color:"#fff" }}>+ TOIL</button>
              </div>
            </div>
            {memberEntries(activeMember.id).length===0 ? <Empty msg={`No entries for ${activeMember.name} yet`}/> : <EntryTable entries={memberEntries(activeMember.id)} onEdit={openEdit} onDelete={handleDelete} currentUser={currentUser}/>}
          </div>
        )}

        {view==="users" && currentUser.role==="admin" && (
          <div>
            <h2 style={{ fontSize:"20px", fontWeight:700, marginBottom:"20px" }}>User Management</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px" }}>
              <Card>
                <h3 style={{ fontSize:"15px", fontWeight:700, marginBottom:"16px", color:"#f8fafc" }}>Add New User</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                  <Field label="Full Name"><input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="e.g. Christine Santos" style={iStyle}/></Field>
                  <Field label="Email"><input type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="e.g. christine@enroly.com" style={iStyle}/></Field>
                  <Field label="Temporary Password"><input type="text" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} placeholder="They can change this later" style={iStyle}/></Field>
                  <Field label="Role">
                    <select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})} style={sStyle}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Field>
                  {userError && <div style={{ color:"#ef4444", fontSize:"12px" }}>{userError}</div>}
                  <button onClick={addUser} style={{ padding:"9px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:700, background:"#10b981", color:"#fff" }}>Add User</button>
                </div>
              </Card>
              <Card>
                <h3 style={{ fontSize:"15px", fontWeight:700, marginBottom:"16px", color:"#f8fafc" }}>All Users ({allUsers.length})</h3>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {allUsers.map(u=>(
                    <div key={u.id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", background:"#0f172a", borderRadius:"10px", border:"1px solid #334155" }}>
                      <div style={{ width:"32px", height:"32px", borderRadius:"50%", background:`hsl(${u.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"13px" }}>{u.name[0]}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:"13px" }}>{u.name}</div>
                        <div style={{ fontSize:"11px", color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{u.email}</div>
                      </div>
                      <span style={{ fontSize:"11px", fontWeight:600, padding:"2px 8px", borderRadius:"9999px", background:u.role==="admin"?"#f59e0b22":u.role==="manager"?"#3b82f622":"#10b98122", color:u.role==="admin"?"#f59e0b":u.role==="manager"?"#3b82f6":"#10b981" }}>{u.role}</span>
                      {u.id!==currentUser.id && <button onClick={()=>removeUser(u.id)} style={{ padding:"4px 8px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:"11px" }}>✕</button>}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {(view==="add"||view==="edit") && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
              <button onClick={()=>setView(activeMember?"member":"log")} style={{ background:"transparent", border:"1px solid #334155", color:"#94a3b8", borderRadius:"8px", padding:"6px 12px", cursor:"pointer", fontSize:"12px" }}>← Back</button>
              <h2 style={{ fontSize:"20px", fontWeight:700, margin:0 }}>{view==="edit"?"Edit Entry":"New Entry"}</h2>
              {view==="add" && (
                <div style={{ display:"flex", gap:"0", background:"#0f172a", borderRadius:"8px", padding:"3px", border:"1px solid #334155" }}>
                  <button onClick={()=>setForm({...form,entryType:"makeup",absenceType:"Sick Leave"})} style={{ padding:"5px 12px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:600, background:form.entryType!=="toil"?"#f59e0b":"transparent", color:form.entryType!=="toil"?"#0f172a":"#94a3b8" }}>Makeup</button>
                  <button onClick={()=>setForm({...form,entryType:"toil",absenceType:"Project Deadline"})} style={{ padding:"5px 12px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:600, background:form.entryType==="toil"?"#8b5cf6":"transparent", color:form.entryType==="toil"?"#fff":"#94a3b8" }}>TOIL</button>
                </div>
              )}
            </div>
            <Card style={{ maxWidth:"720px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                <Field label="Team Member *">
                  <select value={form.userId} onChange={e=>{ const u=employees.find(u=>u.id===e.target.value); setForm({...form,userId:e.target.value,memberName:u?.name||""}); }} style={sStyle}>
                    <option value="">Select member...</option>
                    {employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label={form.entryType==="toil"?"Reason *":"Absence Type *"}>
                  <select value={form.absenceType} onChange={e=>setForm({...form,absenceType:e.target.value})} style={sStyle}>
                    {(form.entryType==="toil"?TOIL_REASONS:ABSENCE_TYPES).map(t=><option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label={form.entryType==="toil"?"Date Worked *":"Date of Absence *"}><input type="date" value={form.absenceDate} onChange={e=>setForm({...form,absenceDate:e.target.value})} style={iStyle}/></Field>
                <Field label={form.entryType==="toil"?"Hours Worked Overtime *":"Hours Owed *"}><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={form.hoursOwed} onChange={e=>setForm({...form,hoursOwed:e.target.value})} style={iStyle}/></Field>
                <Field label={form.entryType==="toil"?"Proposed TOIL Date":"Makeup Date"}><input type="date" value={form.makeupDate} onChange={e=>setForm({...form,makeupDate:e.target.value})} style={iStyle}/></Field>
                <Field label="Authorised By">
                  <select value={form.authorisedBy} onChange={e=>setForm({...form,authorisedBy:e.target.value})} style={sStyle}>
                    <option value="">Select...</option>
                    {managers.map(u=><option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={sStyle}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Manager Notes"><input type="text" placeholder="e.g. Agreed to split across two days" value={form.managerNotes||""} onChange={e=>setForm({...form,managerNotes:e.target.value})} style={iStyle}/></Field>
                <div style={{ gridColumn:"1 / -1" }}>
                  <Field label="Comments"><textarea rows={3} value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})} style={{ ...iStyle, resize:"vertical" }}/></Field>
                </div>
              </div>
              <div style={{ marginTop:"20px", display:"flex", gap:"10px" }}>
                <button onClick={handleSaveEntry} style={{ padding:"10px 24px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:form.entryType==="toil"?"#8b5cf6":"#f59e0b", color:form.entryType==="toil"?"#fff":"#0f172a" }}>{view==="edit"?"💾 Save Changes":"✅ Add Entry"}</button>
                <button onClick={()=>setView(activeMember?"member":"log")} style={{ padding:"10px 18px", borderRadius:"10px", border:"1px solid #334155", cursor:"pointer", fontSize:"14px", fontWeight:600, background:"transparent", color:"#94a3b8" }}>Cancel</button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [entries, setEntries]         = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from("users").select("*");
      const { data: e } = await supabase.from("entries").select("*");
      if (u) setUsers(u.map(r=>({ id:r.id, email:r.email, password:r.password, name:r.name, role:r.role })));
      if (e) setEntries(e.map(r=>({ id:r.id, userId:r.user_id, memberName:r.member_name, absenceDate:r.absence_date, absenceType:r.absence_type, hoursOwed:r.hours_owed, makeupDate:r.makeup_date, authorisedBy:r.authorised_by, status:r.status, managerNotes:r.manager_notes, comments:r.comments, entryType:r.entry_type||"makeup", createdAt:r.created_at, updatedAt:r.updated_at })));
      setLoading(false);
    })();

    const toEntry = r => ({ id:r.id, userId:r.user_id, memberName:r.member_name, absenceDate:r.absence_date, absenceType:r.absence_type, hoursOwed:r.hours_owed, makeupDate:r.makeup_date, authorisedBy:r.authorised_by, status:r.status, managerNotes:r.manager_notes, comments:r.comments, entryType:r.entry_type||"makeup", createdAt:r.created_at, updatedAt:r.updated_at });

    const channel = supabase
      .channel("entries-live")
      .on("postgres_changes", { event:"*", schema:"public", table:"entries" }, (payload) => {
        if (payload.eventType==="INSERT") { const entry=toEntry(payload.new); setEntries(prev=>prev.find(e=>e.id===entry.id)?prev:[entry,...prev]); }
        if (payload.eventType==="UPDATE") { const entry=toEntry(payload.new); setEntries(prev=>prev.map(e=>e.id===entry.id?entry:e)); }
        if (payload.eventType==="DELETE") { setEntries(prev=>prev.filter(e=>e.id!==payload.old.id)); }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const saveUsers = useCallback(async (newUsers) => {
    setUsers(newUsers);
    for (const u of newUsers) { await supabase.from("users").upsert({ id:u.id, email:u.email, password:u.password, name:u.name, role:u.role }); }
    const newIds  = newUsers.map(u=>u.id);
    const removed = users.filter(u=>!newIds.includes(u.id));
    for (const u of removed) { await supabase.from("users").delete().eq("id",u.id); }
  }, [users]);

  const handleSaveEntry = useCallback(async (entry, isEdit) => {
    const row = { id:entry.id, user_id:entry.userId, member_name:entry.memberName, absence_date:entry.absenceDate, absence_type:entry.absenceType, hours_owed:entry.hoursOwed, makeup_date:entry.makeupDate, authorised_by:entry.authorisedBy, status:entry.status, manager_notes:entry.managerNotes, comments:entry.comments, entry_type:entry.entryType||"makeup", updated_at:new Date().toISOString() };
    if (!isEdit) row.created_at = entry.createdAt;
    await supabase.from("entries").upsert(row);
    setEntries(prev=>isEdit?prev.map(e=>e.id===entry.id?entry:e):[entry,...prev]);
  }, []);

  const handleDeleteEntry = useCallback(async (id) => {
    await supabase.from("entries").delete().eq("id",id);
    setEntries(prev=>prev.filter(e=>e.id!==id));
  }, []);

  const handleLogout = () => setCurrentUser(null);

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", color:"#f1f5f9", fontFamily:"sans-serif", fontSize:"16px" }}>
      Loading...
    </div>
  );

  if (!currentUser) return <LoginPage onLogin={setCurrentUser} allUsers={users}/>;
  if (currentUser.role==="employee") return <EmployeeView currentUser={currentUser} allEntries={entries} allUsers={users} onSave={e=>handleSaveEntry(e,false)} onSaveUsers={saveUsers} onLogout={handleLogout}/>;
  return <ManagerView currentUser={currentUser} allEntries={entries} allUsers={users} onSaveEntry={handleSaveEntry} onDeleteEntry={handleDeleteEntry} onSaveUsers={saveUsers} onLogout={handleLogout}/>;
}