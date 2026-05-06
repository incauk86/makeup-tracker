import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";
import { createClient } from "@supabase/supabase-js";

// ─── SUPABASE ─────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ABSENCE_TYPES = ["Sick Leave","Personal Emergency","Unauthorised Absence","Lateness","Early Departure","Other"];
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

const loadLS = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const saveLS = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

function ChangePasswordModal({ currentUser, allUsers, onSaveUsers, onClose }) {
  const [current,  setCurrent]  = useState("");
  const [next,     setNext]     = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState(false);

  const handle = async () => {
    setError("");
    if (current !== currentUser.password)      { setError("Current password is incorrect."); return; }
    if (next.length < 6)                        { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm)                       { setError("New passwords do not match."); return; }
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
            <Field label="Current Password">
              <input type="password" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="••••••••" style={iStyle}/>
            </Field>
            <Field label="New Password">
              <input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="Min. 6 characters" style={iStyle}/>
            </Field>
            <Field label="Confirm New Password">
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            </Field>
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
            {["Member","Absence Date","Type","Hours","Makeup Date","Authorised By","Status","Comments", canEdit&&"Actions"].filter(Boolean).map(h=>(
              <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontSize:"10px", fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.06em", whiteSpace:"nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e,i) => (
            <tr key={e.id} style={{ borderBottom:"1px solid #1e293b", background:i%2===0?"transparent":"#ffffff05" }}>
              <td style={{ padding:"10px 14px", fontWeight:600, whiteSpace:"nowrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                  <div style={{ width:"24px", height:"24px", borderRadius:"50%", background:`hsl(${(e.memberName||"?").charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"11px", fontWeight:700 }}>{(e.memberName||"?")[0]}</div>
                  {e.memberName}
                </div>
              </td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:"12px", color:"#94a3b8", whiteSpace:"nowrap" }}>{fmtDate(e.absenceDate)}</td>
              <td style={{ padding:"10px 14px", fontSize:"12px", color:"#cbd5e1", whiteSpace:"nowrap" }}>{e.absenceType}</td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontWeight:700, color:"#f59e0b", whiteSpace:"nowrap" }}>{e.hoursOwed}h</td>
              <td style={{ padding:"10px 14px", fontFamily:"monospace", fontSize:"12px", color:"#94a3b8", whiteSpace:"nowrap" }}>{fmtDate(e.makeupDate)}</td>
              <td style={{ padding:"10px 14px", fontSize:"12px", color:"#cbd5e1", whiteSpace:"nowrap" }}>{e.authorisedBy||"—"}</td>
              <td style={{ padding:"10px 14px", whiteSpace:"nowrap" }}><StatusBadge status={e.status}/></td>
              <td style={{ padding:"10px 14px", maxWidth:"160px", fontSize:"12px", color:"#64748b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={e.comments}>{e.comments||"—"}</td>
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
            <Field label="Email">
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@enroly.com" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            </Field>
            <Field label="Password">
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/>
            </Field>
            {error && <div style={{ color:"#ef4444", fontSize:"13px" }}>{error}</div>}
            <button onClick={handle} style={{ width:"100%", padding:"11px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>Sign In</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmployeeView({ currentUser, allEntries, allUsers, onSave, onSaveUsers, onLogout }) {
  const myEntries = allEntries.filter(e => e.userId===currentUser.id);
  const [view, setView]       = useState("new");
  const [form, setForm]       = useState(buildForm());
  const [toast, setToast]     = useState(null);
  const [showPwd, setShowPwd] = useState(false);

  function buildForm() { return { absenceDate:today(), absenceType:"Sick Leave", hoursOwed:"", makeupDate:"", comments:"", status:"Pending" }; }
  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const submit = () => {
    if (!form.absenceDate||!form.hoursOwed||!form.makeupDate) { showToast("Please fill in all required fields","error"); return; }
    onSave({ ...form, id:generateId(), userId:currentUser.id, memberName:currentUser.name, authorisedBy:"Pending approval", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
    showToast("Request submitted — your manager will be in touch.");
    setForm(buildForm());
    setView("history");
  };

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
        <div style={{ display:"flex", gap:"8px", marginBottom:"24px" }}>
          {[["new","📝 New Request"],["history","🕐 My History"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{ padding:"8px 16px", borderRadius:"9px", border:"none", cursor:"pointer", fontSize:"13px", fontWeight:600, background:view===v?"#f59e0b":"#1e293b", color:view===v?"#0f172a":"#94a3b8" }}>{l}</button>
          ))}
        </div>

        {view==="new" && (
          <Card>
            <h2 style={{ fontSize:"17px", fontWeight:700, marginBottom:"20px", color:"#f8fafc" }}>Submit a Makeup Time Request</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
              <Field label="Date of Absence *"><input type="date" value={form.absenceDate} onChange={e=>setForm({...form,absenceDate:e.target.value})} style={iStyle}/></Field>
              <Field label="Absence Type *">
                <select value={form.absenceType} onChange={e=>setForm({...form,absenceType:e.target.value})} style={sStyle}>
                  {ABSENCE_TYPES.map(t=><option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Hours Owed *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={form.hoursOwed} onChange={e=>setForm({...form,hoursOwed:e.target.value})} style={iStyle}/></Field>
              <Field label="Proposed Makeup Date *"><input type="date" value={form.makeupDate} onChange={e=>setForm({...form,makeupDate:e.target.value})} style={iStyle}/></Field>
              <div style={{ gridColumn:"1 / -1" }}>
                <Field label="Comments / Context">
                  <textarea rows={3} placeholder="Any additional details..." value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})} style={{ ...iStyle, resize:"vertical" }}/>
                </Field>
              </div>
            </div>
            <button onClick={submit} style={{ marginTop:"20px", padding:"10px 24px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>✅ Submit Request</button>
            <p style={{ marginTop:"12px", fontSize:"12px", color:"#64748b" }}>Your manager will review and confirm the arrangement with you directly.</p>
          </Card>
        )}

        {view==="history" && (
          <div>
            <h2 style={{ fontSize:"17px", fontWeight:700, marginBottom:"16px" }}>My Requests</h2>
            {myEntries.length===0 ? <Empty msg="No requests submitted yet"/> : (
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {[...myEntries].sort((a,b)=>b.absenceDate?.localeCompare(a.absenceDate)).map(e=>(
                  <Card key={e.id} style={{ padding:"16px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:"15px", marginBottom:"4px" }}>{fmtDate(e.absenceDate)} — {e.absenceType}</div>
                        <div style={{ fontSize:"12px", color:"#64748b" }}>
                          <span style={{ color:"#f59e0b", fontWeight:700 }}>{e.hoursOwed}h</span> owed · Makeup: {fmtDate(e.makeupDate)}
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
  const [form, setForm]                 = useState(buildEntryForm(null, currentUser));
  const [toast, setToast]               = useState(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [userForm, setUserForm]         = useState({ name:"", email:"", password:"", role:"employee" });
  const [userError, setUserError]       = useState("");
  const [showPwd, setShowPwd]           = useState(false);

  function buildEntryForm(member, cu) {
    return { userId:member?.id||"", memberName:member?.name||"", absenceDate:today(), absenceType:"Sick Leave", hoursOwed:"", makeupDate:"", authorisedBy:cu?.name||"", comments:"", status:"Pending", managerNotes:"" };
  }

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const employees = allUsers.filter(u=>u.role==="employee");
  const managers  = allUsers.filter(u=>["manager","admin"].includes(u.role));

  const handleSaveEntry = () => {
    if (!form.userId||!form.absenceDate||!form.hoursOwed) { showToast("Fill in all required fields","error"); return; }
    const isEdit = !!editEntry;
    const entry  = isEdit ? { ...editEntry, ...form, updatedAt:new Date().toISOString() } : { ...form, id:generateId(), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
    onSaveEntry(entry, isEdit);
    showToast(isEdit?"Entry updated":"Entry added");
    setEditEntry(null); setForm(buildEntryForm(null,currentUser)); setView(activeMember?"member":"log");
  };

  const openEdit = (entry) => { setForm({...entry}); setEditEntry(entry); setView("edit"); };
  const openAdd  = (member=null) => { setForm(buildEntryForm(member,currentUser)); setEditEntry(null); setView("add"); };
  const handleDelete = (id) => { if (!window.confirm("Delete this entry?")) return; onDeleteEntry(id); showToast("Deleted"); };

  const addUser = () => {
    setUserError("");
    if (!userForm.name||!userForm.email||!userForm.password) { setUserError("All fields are required."); return; }
    if (allUsers.find(u=>u.email.toLowerCase()===userForm.email.toLowerCase())) { setUserError("That email is already registered."); return; }
    onSaveUsers([...allUsers, { id:generateId(), ...userForm }]);
    setUserForm({ name:"", email:"", password:"", role:"employee" });
    showToast(`${userForm.name} added`);
  };

  const removeUser = (id) => {
    if (id===currentUser.id) { showToast("You can't remove yourself","error"); return; }
    if (!window.confirm("Remove this user?")) return;
    onSaveUsers(allUsers.filter(u=>u.id!==id));
    showToast("User removed");
  };

  const memberEntries   = (uid) => allEntries.filter(e=>e.userId===uid);
  const filteredEntries = filterStatus==="All" ? allEntries : allEntries.filter(e=>e.status===filterStatus);
  const totalHours      = allEntries.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedHours  = allEntries.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const pendingCount    = allEntries.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length;
  const memberSummary   = employees.map(u=>{ const me=memberEntries(u.id); return { name:u.name, total:me.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0), completed:me.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0), open:me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length, count:me.length }; }).filter(m=>m.count>0);
  const statusSummary   = STATUSES.map(s=>({ name:s, value:allEntries.filter(e=>e.status===s).length })).filter(s=>s.value>0);
  const monthlyMap      = {};
  allEntries.forEach(e=>{ const mo=e.absenceDate?.slice(0,7); if(!mo)return; if(!monthlyMap[mo])monthlyMap[mo]={month:mo,hours:0}; monthlyMap[mo].hours+=parseFloat(e.hoursOwed)||0; });
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
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"16px", marginBottom:"24px" }}>
              {[{label:"Total Entries",value:allEntries.length,icon:"📝",color:"#3b82f6"},{label:"Total Hours Owed",value:`${totalHours.toFixed(1)}h`,icon:"⏱",color:"#f59e0b"},{label:"Hours Recovered",value:`${completedHours.toFixed(1)}h`,icon:"✅",color:"#10b981"},{label:"Open Cases",value:pendingCount,icon:"🔴",color:"#ef4444"}].map(c=>(
                <div key={c.label} style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #334155", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:c.color }}/>
                  <div style={{ fontSize:"22px", marginBottom:"6px" }}>{c.icon}</div>
                  <div style={{ fontSize:"26px", fontWeight:700, color:c.color, fontFamily:"monospace" }}>{c.value}</div>
                  <div style={{ fontSize:"11px", color:"#64748b", textTransform:"uppercase", letterSpacing:"0.05em" }}>{c.label}</div>
                </div>
              ))}
            </div>
            {allEntries.length===0 ? <Empty msg="No entries yet — add one or wait for team submissions"/> : (
              <>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:"16px", marginBottom:"16px" }}>
                  <Card>
                    <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>Monthly Trend</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="label" tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                        <Line type="monotone" dataKey="hours" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill:"#f59e0b", r:4 }} name="Hours"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                  <Card>
                    <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>By Status</div>
                    <ResponsiveContainer width="100%" height={170}>
                      <PieChart>
                        <Pie data={statusSummary} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                          {statusSummary.map((s,i)=><Cell key={i} fill={STATUS_COLORS[s.name]||PIE_COLORS[i]}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                        <Legend wrapperStyle={{ fontSize:"11px" }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>
                {memberSummary.length>0 && (
                  <Card>
                    <div style={{ fontWeight:700, marginBottom:"16px", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.05em", color:"#94a3b8" }}>Hours by Team Member</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={memberSummary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="name" tick={{ fill:"#94a3b8", fontSize:12 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill:"#64748b", fontSize:11 }} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{ background:"#0f172a", border:"1px solid #334155", borderRadius:"8px", fontSize:"12px" }}/>
                        <Bar dataKey="total" fill="#f59e0b" name="Total Hours" radius={[4,4,0,0]}/>
                        <Bar dataKey="completed" fill="#10b981" name="Recovered" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {view==="log" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
              <h2 style={{ fontSize:"20px", fontWeight:700 }}>All Entries</h2>
              <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                {["All",...STATUSES].map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)} style={{ padding:"4px 10px", borderRadius:"9999px", border:"none", cursor:"pointer", fontSize:"11px", fontWeight:600, background:filterStatus===s?(STATUS_COLORS[s]||"#f59e0b"):"#1e293b", color:filterStatus===s?"#fff":"#94a3b8" }}>{s}</button>
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
                {employees.map(u=>{ const me=memberEntries(u.id); const hrs=me.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0); const open=me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length; return (
                  <div key={u.id} onClick={()=>setActiveMember(u)} style={{ background:"#1e293b", borderRadius:"14px", padding:"18px", border:"1px solid #334155", cursor:"pointer" }} onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b"} onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
                    <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:`hsl(${u.name.charCodeAt(0)*15},60%,40%)`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"16px", marginBottom:"10px" }}>{u.name[0]}</div>
                    <div style={{ fontWeight:700 }}>{u.name}</div>
                    <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>{me.length} entries · {hrs.toFixed(1)}h owed</div>
                    {open>0 && <div style={{ marginTop:"8px" }}><StatusBadge status="Pending"/><span style={{ fontSize:"11px", color:"#64748b", marginLeft:"4px" }}>{open} open</span></div>}
                    <button onClick={e=>{e.stopPropagation();openAdd(u);}} style={{ marginTop:"10px", padding:"4px 10px", borderRadius:"6px", border:"1px solid #334155", background:"transparent", color:"#94a3b8", fontSize:"11px", cursor:"pointer" }}>+ Add Entry</button>
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
              <button onClick={()=>openAdd(activeMember)} style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, background:"#10b981", color:"#fff" }}>+ Add Entry</button>
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
            </div>
            <Card style={{ maxWidth:"720px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                <Field label="Team Member *">
                  <select value={form.userId} onChange={e=>{ const u=employees.find(u=>u.id===e.target.value); setForm({...form,userId:e.target.value,memberName:u?.name||""}); }} style={sStyle}>
                    <option value="">Select member...</option>
                    {employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Absence Type *">
                  <select value={form.absenceType} onChange={e=>setForm({...form,absenceType:e.target.value})} style={sStyle}>
                    {ABSENCE_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Date of Absence *"><input type="date" value={form.absenceDate} onChange={e=>setForm({...form,absenceDate:e.target.value})} style={iStyle}/></Field>
                <Field label="Hours Owed *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={form.hoursOwed} onChange={e=>setForm({...form,hoursOwed:e.target.value})} style={iStyle}/></Field>
                <Field label="Makeup Date"><input type="date" value={form.makeupDate} onChange={e=>setForm({...form,makeupDate:e.target.value})} style={iStyle}/></Field>
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
                <button onClick={handleSaveEntry} style={{ padding:"10px 24px", borderRadius:"10px", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:700, background:"#f59e0b", color:"#0f172a" }}>{view==="edit"?"💾 Save Changes":"✅ Add Entry"}</button>
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
  const [entries, setEntries] = useState([]);
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.from("users").select("*");
      const { data: e } = await supabase.from("entries").select("*");
      if (u) setUsers(u.map(r=>({ id:r.id, email:r.email, password:r.password, name:r.name, role:r.role })));
      if (e) setEntries(e.map(r=>({ id:r.id, userId:r.user_id, memberName:r.member_name, absenceDate:r.absence_date, absenceType:r.absence_type, hoursOwed:r.hours_owed, makeupDate:r.makeup_date, authorisedBy:r.authorised_by, status:r.status, managerNotes:r.manager_notes, comments:r.comments, createdAt:r.created_at, updatedAt:r.updated_at })));
      setLoading(false);
    })();
  }, []);

  const saveUsers = useCallback(async (newUsers) => {
    setUsers(newUsers);
    for (const u of newUsers) {
      await supabase.from("users").upsert({ id:u.id, email:u.email, password:u.password, name:u.name, role:u.role });
    }
    const newIds = newUsers.map(u=>u.id);
    const removed = users.filter(u=>!newIds.includes(u.id));
    for (const u of removed) { await supabase.from("users").delete().eq("id", u.id); }
  }, [users]);

  const handleSaveEntry = useCallback(async (entry, isEdit) => {
    const row = { id:entry.id, user_id:entry.userId, member_name:entry.memberName, absence_date:entry.absenceDate, absence_type:entry.absenceType, hours_owed:entry.hoursOwed, makeup_date:entry.makeupDate, authorised_by:entry.authorisedBy, status:entry.status, manager_notes:entry.managerNotes, comments:entry.comments, updated_at:new Date().toISOString() };
    if (!isEdit) row.created_at = entry.createdAt;
    await supabase.from("entries").upsert(row);
    setEntries(prev => isEdit ? prev.map(e=>e.id===entry.id?entry:e) : [entry,...prev]);
  }, []);

  const handleDeleteEntry = useCallback(async (id) => {
    await supabase.from("entries").delete().eq("id", id);
    setEntries(prev => prev.filter(e=>e.id!==id));
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