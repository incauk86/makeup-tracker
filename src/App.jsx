import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const ABSENCE_TYPES   = ["Sick Leave","Personal Emergency","Unauthorised Absence","Lateness","Early Departure","Holiday","Other"];
const TOIL_REASONS    = ["Project Deadline","Client Emergency","Weekend Work","Event Coverage","Training Delivery","Other"];
const PAID_OT_REASONS = ["Weekend Work","Project Deadline","Client Emergency","Event Coverage","Training Delivery","Other"];
const PAYMENT_RATES   = ["Standard (1x)","Time and a half (1.5x)","Double time (2x)"];
const STATUSES        = ["Pending","Scheduled","In Progress","Completed","Partially Completed","Cancelled"];
const STATUS_COLORS   = {"Pending":"#f59e0b","Scheduled":"#3b82f6","In Progress":"#8b5cf6","Completed":"#10b981","Partially Completed":"#06b6d4","Cancelled":"#ef4444"};

// ── UTILITIES ────────────────────────────────────────────────────────────────
const generateId  = () => `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const today       = () => new Date().toISOString().split("T")[0];
const fmtDate     = (d) => { if (!d) return "—"; try { return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d; } };
const fmtDateTime = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleString("en-GB",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); } catch { return d; } };
const genTempPwd  = () => Math.random().toString(36).slice(2,5).toUpperCase() + Math.floor(1000+Math.random()*9000);

const exportToCSV = (data, filename) => {
  if (!data.length) return;
  const headers = ["ID","Member","Date","Hours","Type","Reason","Makeup/TOIL Date","Payment Rate","Status","Authorised By","Manager Notes","Comments","Submitted"];
  const rows = data.map(e => [
    e.id, e.memberName, e.absenceDate, e.hoursOwed,
    e.entryType==="paid"?"Paid OT":e.entryType==="toil"?"TOIL":"Makeup",
    e.absenceType, e.makeupDate||"", e.paymentRate||"",
    e.status, e.authorisedBy||"", e.managerNotes||"", e.comments||"", e.createdAt||""
  ].map(v=>`"${String(v||"").replace(/"/g,'""')}"`).join(","));
  const csv  = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=filename+".csv"; a.click();
  URL.revokeObjectURL(url);
};

const notifyManagers = async (allUsers, entry) => {
  const svcId=import.meta.env.VITE_EMAILJS_SERVICE_ID, tplId=import.meta.env.VITE_EMAILJS_TEMPLATE_ID, pubKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  if (!svcId) return;
  const typeLabel = entry.entryType==="paid"?"Paid Overtime":entry.entryType==="toil"?"TOIL":"Makeup Time";
  for (const m of allUsers.filter(u=>["manager","admin"].includes(u.role))) {
    try {
      await fetch("https://api.emailjs.com/api/v1.0/email/send",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({service_id:svcId,template_id:tplId,user_id:pubKey,template_params:{
          to_email:m.email, to_name:m.name,
          subject:`New ${typeLabel} request — ${entry.memberName}`,
          message:`${entry.memberName} submitted a ${typeLabel} request.\n\nDate: ${entry.absenceDate}\nHours: ${entry.hoursOwed}h\nReason: ${entry.absenceType}\nMakeup date: ${entry.makeupDate||"TBC"}\nNotes: ${entry.comments||"None"}\n\nLog in to review and approve.`
        }})});
    } catch(e) { console.warn("Email skipped:",e); }
  }
};

const notifyEmployee = async (user, entry, newStatus, managerName) => {
  const svcId=import.meta.env.VITE_EMAILJS_SERVICE_ID, tplId=import.meta.env.VITE_EMAILJS_TEMPLATE_ID, pubKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  if (!svcId||!user?.email) return;
  const typeLabel = entry.entryType==="paid"?"Paid Overtime":entry.entryType==="toil"?"TOIL":"Makeup Time";
  try {
    await fetch("https://api.emailjs.com/api/v1.0/email/send",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({service_id:svcId,template_id:tplId,user_id:pubKey,template_params:{
        to_email:user.email, to_name:user.name,
        subject:`Your ${typeLabel} request has been ${newStatus.toLowerCase()}`,
        message:`Hi ${user.name},\n\nYour ${typeLabel} request has been ${newStatus.toLowerCase()} by ${managerName}.\n\nDate: ${entry.absenceDate}\nHours: ${entry.hoursOwed}h\n${entry.managerNotes?"Manager note: "+entry.managerNotes+"\n":""}\nLog in for full details.`
      }})});
  } catch(e) { console.warn("Email skipped:",e); }
};

// ── STYLE OBJECTS ────────────────────────────────────────────────────────────
const iStyle = {width:"100%",background:"#0f172a",border:"1px solid #334155",borderRadius:"8px",padding:"9px 12px",color:"#f1f5f9",fontSize:"13px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const sStyle = {...iStyle,cursor:"pointer"};

// ── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const StatusBadge = ({status}) => (
  <span style={{background:(STATUS_COLORS[status]||"#888")+"22",color:STATUS_COLORS[status]||"#888",border:`1px solid ${STATUS_COLORS[status]||"#888"}55`,borderRadius:"9999px",padding:"2px 10px",fontSize:"11px",fontWeight:700,whiteSpace:"nowrap"}}>{status}</span>
);
const TypeBadge = ({type}) => {
  const c={toil:{bg:"#8b5cf622",color:"#8b5cf6",border:"#8b5cf655",label:"TOIL"},paid:{bg:"#10b98122",color:"#10b981",border:"#10b98155",label:"Paid OT"},makeup:{bg:"#f59e0b22",color:"#f59e0b",border:"#f59e0b55",label:"Makeup"}}[type]||{bg:"#f59e0b22",color:"#f59e0b",border:"#f59e0b55",label:"Makeup"};
  return <span style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,borderRadius:"9999px",padding:"2px 8px",fontSize:"10px",fontWeight:700,whiteSpace:"nowrap"}}>{c.label}</span>;
};
const Field = ({label,children}) => (
  <div><label style={{display:"block",fontSize:"11px",fontWeight:600,color:"#94a3b8",marginBottom:"6px",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>{children}</div>
);
const Card = ({children,style}) => (
  <div style={{background:"#1e293b",borderRadius:"14px",padding:"20px",border:"1px solid #334155",...style}}>{children}</div>
);
const Empty = ({msg}) => (
  <div style={{textAlign:"center",padding:"40px 0",color:"#64748b",fontSize:"14px"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>📋</div>{msg}</div>
);
const MiniPanel = ({children,style}) => (
  <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155",...style}}>{children}</div>
);
const PanelTitle = ({children}) => (
  <div style={{fontSize:"10px",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"12px"}}>{children}</div>
);

// ── CHANGE PASSWORD MODAL ────────────────────────────────────────────────────
function ChangePasswordModal({currentUser,allUsers,onSaveUsers,onClose}) {
  const [current,setCurrent]=useState(""), [next,setNext]=useState(""), [confirm,setConfirm]=useState(""), [error,setError]=useState(""), [success,setSuccess]=useState(false);
  const handle = async () => {
    setError("");
    if (current!==currentUser.password) { setError("Current password is incorrect."); return; }
    if (next.length<6) { setError("New password must be at least 6 characters."); return; }
    if (next!==confirm) { setError("New passwords do not match."); return; }
    const updated = allUsers.map(u=>u.id===currentUser.id?{...u,password:next}:u);
    await supabase.from("users").update({password:next}).eq("id",currentUser.id);
    onSaveUsers(updated); currentUser.password=next; setSuccess(true);
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#1e293b",borderRadius:"16px",padding:"28px",border:"1px solid #334155",width:"100%",maxWidth:"380px",margin:"0 24px"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontWeight:700,fontSize:"17px",marginBottom:"4px",color:"#f8fafc"}}>Change Password</h3>
        <p style={{fontSize:"12px",color:"#64748b",marginBottom:"20px"}}>Signed in as {currentUser.email}</p>
        {success ? (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:"32px",marginBottom:"8px"}}>✅</div>
            <div style={{fontWeight:600,color:"#10b981",marginBottom:"16px"}}>Password updated</div>
            <button onClick={onClose} style={{padding:"9px 24px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"#f59e0b",color:"#0f172a"}}>Done</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <Field label="Current Password"><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} placeholder="••••••••" style={iStyle}/></Field>
            <Field label="New Password"><input type="password" value={next} onChange={e=>setNext(e.target.value)} placeholder="Min. 6 characters" style={iStyle}/></Field>
            <Field label="Confirm New Password"><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            {error && <div style={{color:"#ef4444",fontSize:"12px"}}>{error}</div>}
            <div style={{display:"flex",gap:"8px",marginTop:"4px"}}>
              <button onClick={handle} style={{flex:1,padding:"9px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"#f59e0b",color:"#0f172a"}}>Update Password</button>
              <button onClick={onClose} style={{padding:"9px 16px",borderRadius:"9px",border:"1px solid #334155",cursor:"pointer",fontSize:"13px",fontWeight:600,background:"transparent",color:"#94a3b8"}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── RESET PASSWORD MODAL (admin) ─────────────────────────────────────────────
function ResetPasswordModal({targetUser,allUsers,onSaveUsers,onClose}) {
  const [done,setDone]=useState(false), [tempPwd,setTempPwd]=useState(""), [copied,setCopied]=useState(false);
  const handle = async () => {
    const pwd = genTempPwd();
    setTempPwd(pwd);
    const updated = allUsers.map(u=>u.id===targetUser.id?{...u,password:pwd}:u);
    await supabase.from("users").update({password:pwd}).eq("id",targetUser.id);
    onSaveUsers(updated);
    setDone(true);
  };
  const copy = () => { navigator.clipboard.writeText(tempPwd); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#1e293b",borderRadius:"16px",padding:"28px",border:"1px solid #334155",width:"100%",maxWidth:"380px",margin:"0 24px"}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontWeight:700,fontSize:"17px",marginBottom:"4px",color:"#f8fafc"}}>Reset Password</h3>
        <p style={{fontSize:"12px",color:"#64748b",marginBottom:"20px"}}>Reset password for <strong style={{color:"#f1f5f9"}}>{targetUser.name}</strong> ({targetUser.email})</p>
        {done ? (
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <div style={{background:"#0f172a",borderRadius:"10px",padding:"14px 16px",border:"1px solid #10b98133"}}>
              <div style={{fontSize:"11px",color:"#10b981",fontWeight:700,marginBottom:"8px",textTransform:"uppercase",letterSpacing:".06em"}}>Temporary password</div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <code style={{fontSize:"20px",fontWeight:700,color:"#f8fafc",letterSpacing:"0.1em",flex:1}}>{tempPwd}</code>
                <button onClick={copy} style={{padding:"6px 12px",borderRadius:"7px",border:"1px solid #334155",background:"transparent",color:copied?"#10b981":"#94a3b8",cursor:"pointer",fontSize:"12px",fontWeight:600}}>
                  {copied?"✓ Copied":"Copy"}
                </button>
              </div>
            </div>
            <p style={{fontSize:"12px",color:"#64748b",lineHeight:1.5}}>Share this with {targetUser.name} securely. They can change it after signing in using the Change Password option.</p>
            <button onClick={onClose} style={{padding:"9px 24px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"#f59e0b",color:"#0f172a"}}>Done</button>
          </div>
        ) : (
          <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
            <div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:"9px",padding:"10px 14px",fontSize:"12px",color:"#f59e0b"}}>
              This will immediately replace their current password with a randomly generated one.
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button onClick={handle} style={{flex:1,padding:"9px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"#3b82f6",color:"#fff"}}>Generate & Reset</button>
              <button onClick={onClose} style={{padding:"9px 16px",borderRadius:"9px",border:"1px solid #334155",cursor:"pointer",fontSize:"13px",fontWeight:600,background:"transparent",color:"#94a3b8"}}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ENTRY TABLE ──────────────────────────────────────────────────────────────
function EntryTable({entries,onEdit,onDelete,currentUser}) {
  const sorted  = [...entries].sort((a,b)=>b.absenceDate?.localeCompare(a.absenceDate));
  const canEdit = ["admin","manager"].includes(currentUser.role);
  return (
    <div style={{background:"#1e293b",borderRadius:"14px",border:"1px solid #334155",overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:"#0f172a",borderBottom:"1px solid #334155"}}>
            {["Type","Member","Date","Reason/Type","Hours","Makeup/TOIL Date","Payment Rate","Authorised By","Status",canEdit&&"Actions"].filter(Boolean).map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:"10px",fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e,i)=>(
            <tr key={e.id} style={{borderBottom:"1px solid #1e293b",background:i%2===0?"transparent":"#ffffff05"}}>
              <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}><TypeBadge type={e.entryType}/></td>
              <td style={{padding:"10px 14px",fontWeight:600,whiteSpace:"nowrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                  <div style={{width:"24px",height:"24px",borderRadius:"50%",background:`hsl(${(e.memberName||"?").charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:700}}>{(e.memberName||"?")[0]}</div>
                  {e.memberName}
                </div>
              </td>
              <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:"12px",color:"#94a3b8",whiteSpace:"nowrap"}}>{fmtDate(e.absenceDate)}</td>
              <td style={{padding:"10px 14px",fontSize:"12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>{e.absenceType}</td>
              <td style={{padding:"10px 14px",fontFamily:"monospace",fontWeight:700,color:e.entryType==="toil"?"#8b5cf6":e.entryType==="paid"?"#10b981":"#f59e0b",whiteSpace:"nowrap"}}>{e.hoursOwed}h</td>
              <td style={{padding:"10px 14px",fontFamily:"monospace",fontSize:"12px",color:"#94a3b8",whiteSpace:"nowrap"}}>{fmtDate(e.makeupDate)}</td>
              <td style={{padding:"10px 14px",fontSize:"12px",color:"#64748b",whiteSpace:"nowrap"}}>{e.paymentRate||"—"}</td>
              <td style={{padding:"10px 14px",fontSize:"12px",color:"#cbd5e1",whiteSpace:"nowrap"}}>{e.authorisedBy||"—"}</td>
              <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}><StatusBadge status={e.status}/></td>
              {canEdit && (
                <td style={{padding:"10px 14px",whiteSpace:"nowrap"}}>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={()=>onEdit(e)} style={{padding:"4px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:"11px"}}>✏️</button>
                    <button onClick={()=>onDelete(e.id)} style={{padding:"4px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px"}}>🗑</button>
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

// ── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({onLogin,allUsers}) {
  const [email,setEmail]=useState(""), [password,setPassword]=useState(""), [error,setError]=useState("");
  const handle = () => {
    const user = allUsers.find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.password===password);
    if (user) onLogin(user); else setError("Email or password incorrect.");
  };
  return (
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:"380px",padding:"0 24px"}}>
        <div style={{textAlign:"center",marginBottom:"32px"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"14px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",margin:"0 auto 16px"}}>⏱</div>
          <div style={{fontWeight:700,fontSize:"22px",color:"#f8fafc"}}>Makeup Time Tracker</div>
          <div style={{fontSize:"13px",color:"#64748b",marginTop:"4px"}}>Enroly Assessment Team</div>
        </div>
        <Card>
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@enroly.com" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            <Field label="Password"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={iStyle} onKeyDown={e=>e.key==="Enter"&&handle()}/></Field>
            {error && <div style={{color:"#ef4444",fontSize:"13px"}}>{error}</div>}
            <button onClick={handle} style={{width:"100%",padding:"11px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:"#f59e0b",color:"#0f172a"}}>Sign In</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── EMPLOYEE VIEW ────────────────────────────────────────────────────────────
function EmployeeView({currentUser,allEntries,allUsers,onSave,onSaveUsers,onLogout}) {
  const myEntries = allEntries.filter(e=>e.userId===currentUser.id);
  const [view,setView]         = useState("new");
  const [mode,setMode]         = useState("makeup");
  const [makeupList,setMakeup] = useState([buildMakeupRow()]);
  const [toilList,setToil]     = useState([buildToilRow()]);
  const [paidList,setPaid]     = useState([buildPaidRow()]);
  const [toast,setToast]       = useState(null);
  const [showPwd,setShowPwd]   = useState(false);
  const [submitting,setSub]    = useState(false);

  function buildMakeupRow(){ return {id:generateId(),absenceDate:today(),absenceType:"Sick Leave",hoursOwed:"",makeupDate:"",comments:""}; }
  function buildToilRow()  { return {id:generateId(),absenceDate:today(),absenceType:"Project Deadline",hoursOwed:"",makeupDate:"",comments:""}; }
  function buildPaidRow()  { return {id:generateId(),absenceDate:today(),absenceType:"Weekend Work",hoursOwed:"",paymentRate:"Standard (1x)",comments:""}; }

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const updateRow = (list,setList,idx,field,val) => setList(prev=>prev.map((r,i)=>i===idx?{...r,[field]:val}:r));

  const submitEntries = async (list, entryType, validate) => {
    const invalid = list.find(validate);
    if (invalid) { showToast("Please fill in all required fields","error"); return; }
    setSub(true);
    for (const row of list) {
      const entry = {...row,id:generateId(),entryType,userId:currentUser.id,memberName:currentUser.name,authorisedBy:"Pending approval",status:"Pending",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      await onSave(entry);
      await notifyManagers(allUsers, entry);
    }
    showToast(`${list.length} request${list.length>1?"s":""} submitted.`);
    if (entryType==="makeup") setMakeup([buildMakeupRow()]);
    else if (entryType==="toil") setToil([buildToilRow()]);
    else setPaid([buildPaidRow()]);
    setSub(false);
    setView("history");
  };

  const myMakeup = myEntries.filter(e=>e.entryType!=="toil"&&e.entryType!=="paid");
  const myToil   = myEntries.filter(e=>e.entryType==="toil");
  const myPaid   = myEntries.filter(e=>e.entryType==="paid");

  const modeStyle = (m,activeColor) => ({flex:1,padding:"8px 10px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:600,fontFamily:"inherit",background:mode===m?activeColor:"transparent",color:mode===m?(m==="makeup"?"#0f172a":"#fff"):"#94a3b8",transition:"all .15s"});

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#0f172a",minHeight:"100vh",color:"#f1f5f9",fontSize:"14px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {toast && <div style={{position:"fixed",top:"16px",right:"16px",zIndex:9999,background:toast.type==="error"?"#ef4444":"#10b981",color:"#fff",borderRadius:"10px",padding:"10px 18px",fontSize:"13px",fontWeight:600}}>{toast.msg}</div>}
      {showPwd && <ChangePasswordModal currentUser={currentUser} allUsers={allUsers} onSaveUsers={onSaveUsers} onClose={()=>setShowPwd(false)}/>}

      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"56px",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"30px",height:"30px",borderRadius:"8px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>⏱</div>
          <span style={{fontWeight:700,fontSize:"14px"}}>Makeup Time Tracker</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"28px",height:"28px",borderRadius:"50%",background:`hsl(${currentUser.name.charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700}}>{currentUser.name[0]}</div>
          <span style={{fontSize:"13px",color:"#94a3b8"}}>{currentUser.name}</span>
          <button onClick={()=>setShowPwd(true)} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:"12px"}}>🔑 Change Password</button>
          <button onClick={onLogout} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:"12px"}}>Sign out</button>
        </div>
      </div>

      <div style={{padding:"24px",maxWidth:"680px",margin:"0 auto"}}>
        <div style={{display:"flex",gap:"8px",marginBottom:"24px"}}>
          {[["new","📝 New Entry"],["history","🕐 My History"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"8px 16px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:600,background:view===v?"#f59e0b":"#1e293b",color:view===v?"#0f172a":"#94a3b8"}}>{l}</button>
          ))}
        </div>

        {view==="new" && (
          <div>
            {/* 3-way mode toggle */}
            <div style={{display:"flex",gap:"0",marginBottom:"24px",background:"#1e293b",borderRadius:"10px",padding:"4px",border:"1px solid #334155"}}>
              <button onClick={()=>setMode("makeup")} style={modeStyle("makeup","#f59e0b")}>⏱ Make up time</button>
              <button onClick={()=>setMode("toil")}   style={modeStyle("toil","#8b5cf6")}>🕐 TOIL (time off in lieu)</button>
              <button onClick={()=>setMode("paid")}   style={modeStyle("paid","#10b981")}>💰 Paid overtime</button>
            </div>

            {/* MAKEUP FORM */}
            {mode==="makeup" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                  <div><h2 style={{fontSize:"17px",fontWeight:700,color:"#f8fafc",margin:0}}>Submit Makeup Time Requests</h2>
                  <p style={{fontSize:"12px",color:"#64748b",margin:"4px 0 0"}}>For time you owe us — absences, lateness, etc.</p></div>
                  <button onClick={()=>setMakeup(p=>[...p,buildMakeupRow()])} style={{padding:"7px 14px",borderRadius:"8px",border:"1px dashed #334155",background:"transparent",color:"#f59e0b",cursor:"pointer",fontSize:"12px",fontWeight:600}}>+ Add Another</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  {makeupList.map((row,idx)=>(
                    <Card key={row.id}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                        <span style={{fontSize:"13px",fontWeight:700,color:"#94a3b8"}}>Absence {idx+1}</span>
                        {makeupList.length>1 && <button onClick={()=>setMakeup(p=>p.filter((_,i)=>i!==idx))} style={{padding:"3px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px"}}>✕ Remove</button>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                        <Field label="Date of Absence *"><input type="date" value={row.absenceDate} onChange={e=>updateRow(makeupList,setMakeup,idx,"absenceDate",e.target.value)} style={iStyle}/></Field>
                        <Field label="Absence Type *"><select value={row.absenceType} onChange={e=>updateRow(makeupList,setMakeup,idx,"absenceType",e.target.value)} style={sStyle}>{ABSENCE_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
                        <Field label="Hours Owed *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={row.hoursOwed} onChange={e=>updateRow(makeupList,setMakeup,idx,"hoursOwed",e.target.value)} style={iStyle}/></Field>
                        <Field label="Proposed Makeup Date *"><input type="date" value={row.makeupDate} onChange={e=>updateRow(makeupList,setMakeup,idx,"makeupDate",e.target.value)} style={iStyle}/></Field>
                        <div style={{gridColumn:"1 / -1"}}><Field label="Comments"><textarea rows={2} placeholder="Any additional details..." value={row.comments} onChange={e=>updateRow(makeupList,setMakeup,idx,"comments",e.target.value)} style={{...iStyle,resize:"vertical"}}/></Field></div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{marginTop:"20px",display:"flex",gap:"12px"}}>
                  <button onClick={()=>submitEntries(makeupList,"makeup",r=>!r.absenceDate||!r.hoursOwed||!r.makeupDate)} disabled={submitting} style={{padding:"10px 24px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:"#f59e0b",color:"#0f172a",opacity:submitting?0.7:1}}>
                    {submitting?"Submitting...":"✅ Submit Request"+( makeupList.length>1?"s":"")}
                  </button>
                  <button onClick={()=>setMakeup(p=>[...p,buildMakeupRow()])} style={{padding:"10px 16px",borderRadius:"10px",border:"1px dashed #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:"13px"}}>+ Add Another</button>
                </div>
              </div>
            )}

            {/* TOIL FORM */}
            {mode==="toil" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                  <div><h2 style={{fontSize:"17px",fontWeight:700,color:"#f8fafc",margin:0}}>Log Overtime (TOIL)</h2>
                  <p style={{fontSize:"12px",color:"#64748b",margin:"4px 0 0"}}>Extra hours worked — we owe you this time back as leave.</p></div>
                  <button onClick={()=>setToil(p=>[...p,buildToilRow()])} style={{padding:"7px 14px",borderRadius:"8px",border:"1px dashed #334155",background:"transparent",color:"#8b5cf6",cursor:"pointer",fontSize:"12px",fontWeight:600}}>+ Add Another</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  {toilList.map((row,idx)=>(
                    <Card key={row.id} style={{border:"1px solid #8b5cf633"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                        <span style={{fontSize:"13px",fontWeight:700,color:"#8b5cf6"}}>Overtime Entry {idx+1}</span>
                        {toilList.length>1 && <button onClick={()=>setToil(p=>p.filter((_,i)=>i!==idx))} style={{padding:"3px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px"}}>✕ Remove</button>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                        <Field label="Date Worked *"><input type="date" value={row.absenceDate} onChange={e=>updateRow(toilList,setToil,idx,"absenceDate",e.target.value)} style={iStyle}/></Field>
                        <Field label="Reason *"><select value={row.absenceType} onChange={e=>updateRow(toilList,setToil,idx,"absenceType",e.target.value)} style={sStyle}>{TOIL_REASONS.map(t=><option key={t}>{t}</option>)}</select></Field>
                        <Field label="Hours Worked Overtime *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 3" value={row.hoursOwed} onChange={e=>updateRow(toilList,setToil,idx,"hoursOwed",e.target.value)} style={iStyle}/></Field>
                        <Field label="Proposed TOIL Date (optional)"><input type="date" value={row.makeupDate} onChange={e=>updateRow(toilList,setToil,idx,"makeupDate",e.target.value)} style={iStyle}/></Field>
                        <div style={{gridColumn:"1 / -1"}}><Field label="Notes"><textarea rows={2} placeholder="What were you working on?" value={row.comments} onChange={e=>updateRow(toilList,setToil,idx,"comments",e.target.value)} style={{...iStyle,resize:"vertical"}}/></Field></div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{marginTop:"20px",display:"flex",gap:"12px"}}>
                  <button onClick={()=>submitEntries(toilList,"toil",r=>!r.absenceDate||!r.hoursOwed)} disabled={submitting} style={{padding:"10px 24px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:"#8b5cf6",color:"#fff",opacity:submitting?0.7:1}}>
                    {submitting?"Submitting...":"🕐 Log TOIL"+(toilList.length>1?" Entries":"")}
                  </button>
                </div>
                <p style={{marginTop:"12px",fontSize:"12px",color:"#64748b"}}>Your manager will review. Once approved, you can use this time as leave.</p>
              </div>
            )}

            {/* PAID OVERTIME FORM */}
            {mode==="paid" && (
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                  <div><h2 style={{fontSize:"17px",fontWeight:700,color:"#f8fafc",margin:0}}>Log Paid Overtime</h2>
                  <p style={{fontSize:"12px",color:"#64748b",margin:"4px 0 0"}}>Weekend work or extra hours to be compensated financially, not as leave.</p></div>
                  <button onClick={()=>setPaid(p=>[...p,buildPaidRow()])} style={{padding:"7px 14px",borderRadius:"8px",border:"1px dashed #334155",background:"transparent",color:"#10b981",cursor:"pointer",fontSize:"12px",fontWeight:600}}>+ Add Another</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
                  {paidList.map((row,idx)=>(
                    <Card key={row.id} style={{border:"1px solid #10b98133"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
                        <span style={{fontSize:"13px",fontWeight:700,color:"#10b981"}}>Paid Overtime Entry {idx+1}</span>
                        {paidList.length>1 && <button onClick={()=>setPaid(p=>p.filter((_,i)=>i!==idx))} style={{padding:"3px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px"}}>✕ Remove</button>}
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
                        <Field label="Date Worked *"><input type="date" value={row.absenceDate} onChange={e=>updateRow(paidList,setPaid,idx,"absenceDate",e.target.value)} style={iStyle}/></Field>
                        <Field label="Reason *"><select value={row.absenceType} onChange={e=>updateRow(paidList,setPaid,idx,"absenceType",e.target.value)} style={sStyle}>{PAID_OT_REASONS.map(t=><option key={t}>{t}</option>)}</select></Field>
                        <Field label="Hours Worked *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={row.hoursOwed} onChange={e=>updateRow(paidList,setPaid,idx,"hoursOwed",e.target.value)} style={iStyle}/></Field>
                        <Field label="Payment Rate"><select value={row.paymentRate} onChange={e=>updateRow(paidList,setPaid,idx,"paymentRate",e.target.value)} style={sStyle}>{PAYMENT_RATES.map(t=><option key={t}>{t}</option>)}</select></Field>
                        <div style={{gridColumn:"1 / -1"}}><Field label="Notes"><textarea rows={2} placeholder="What were you working on? Any context for your manager..." value={row.comments} onChange={e=>updateRow(paidList,setPaid,idx,"comments",e.target.value)} style={{...iStyle,resize:"vertical"}}/></Field></div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div style={{marginTop:"20px",display:"flex",gap:"12px"}}>
                  <button onClick={()=>submitEntries(paidList,"paid",r=>!r.absenceDate||!r.hoursOwed)} disabled={submitting} style={{padding:"10px 24px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:"#10b981",color:"#fff",opacity:submitting?0.7:1}}>
                    {submitting?"Submitting...":"💰 Log Paid Overtime"+(paidList.length>1?` (${paidList.length})`:"") }
                  </button>
                </div>
                <p style={{marginTop:"12px",fontSize:"12px",color:"#64748b"}}>Your manager will review and confirm payment. This will not be added as leave.</p>
              </div>
            )}
          </div>
        )}

        {view==="history" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"20px"}}>
              <div style={{background:"#1e293b",borderRadius:"12px",padding:"14px 16px",border:"1px solid #f59e0b44"}}>
                <div style={{fontSize:"11px",color:"#f59e0b",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Hours I Owe</div>
                <div style={{fontSize:"24px",fontWeight:700,fontFamily:"monospace",color:"#f59e0b"}}>{myMakeup.filter(e=>e.status!=="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h</div>
                <div style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{myMakeup.length} entries</div>
              </div>
              <div style={{background:"#1e293b",borderRadius:"12px",padding:"14px 16px",border:"1px solid #8b5cf644"}}>
                <div style={{fontSize:"11px",color:"#8b5cf6",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>TOIL Owed to Me</div>
                <div style={{fontSize:"24px",fontWeight:700,fontFamily:"monospace",color:"#8b5cf6"}}>{myToil.filter(e=>e.status!=="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h</div>
                <div style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{myToil.length} entries</div>
              </div>
              <div style={{background:"#1e293b",borderRadius:"12px",padding:"14px 16px",border:"1px solid #10b98144"}}>
                <div style={{fontSize:"11px",color:"#10b981",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"4px"}}>Paid OT Logged</div>
                <div style={{fontSize:"24px",fontWeight:700,fontFamily:"monospace",color:"#10b981"}}>{myPaid.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h</div>
                <div style={{fontSize:"11px",color:"#64748b",marginTop:"2px"}}>{myPaid.length} entries</div>
              </div>
            </div>
            <h2 style={{fontSize:"17px",fontWeight:700,marginBottom:"16px"}}>My Requests</h2>
            {myEntries.length===0 ? <Empty msg="No requests submitted yet"/> : (
              <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                {[...myEntries].sort((a,b)=>b.absenceDate?.localeCompare(a.absenceDate)).map(e=>(
                  <Card key={e.id} style={{padding:"16px",borderColor:e.entryType==="toil"?"#8b5cf633":e.entryType==="paid"?"#10b98133":"#334155"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
                          <TypeBadge type={e.entryType}/>
                          <span style={{fontWeight:700,fontSize:"14px"}}>{fmtDate(e.absenceDate)} — {e.absenceType}</span>
                        </div>
                        <div style={{fontSize:"12px",color:"#64748b"}}>
                          <span style={{color:e.entryType==="toil"?"#8b5cf6":e.entryType==="paid"?"#10b981":"#f59e0b",fontWeight:700}}>{e.hoursOwed}h</span>
                          {e.entryType==="paid"?" paid overtime":(e.entryType==="toil"?" overtime worked":" owed")}
                          {e.entryType==="paid"&&e.paymentRate?` · ${e.paymentRate}`:""}
                          {e.makeupDate&&e.entryType!=="paid"?` · ${e.entryType==="toil"?"TOIL":"Makeup"}: ${fmtDate(e.makeupDate)}`:""}
                        </div>
                        {e.comments && <div style={{fontSize:"12px",color:"#64748b",marginTop:"4px"}}>{e.comments}</div>}
                        {e.managerNotes && <div style={{fontSize:"12px",color:"#94a3b8",marginTop:"6px",background:"#0f172a",borderRadius:"6px",padding:"6px 10px"}}>Manager note: {e.managerNotes}</div>}
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

// ── MANAGER VIEW ─────────────────────────────────────────────────────────────
function ManagerView({currentUser,allEntries,allUsers,onSaveEntry,onDeleteEntry,onSaveUsers,onLogout}) {
  const [view,setView]               = useState("dashboard");
  const [activeMember,setActiveMember] = useState(null);
  const [editEntry,setEditEntry]     = useState(null);
  const [form,setForm]               = useState(buildEntryForm(null,currentUser,"makeup"));
  const [toast,setToast]             = useState(null);
  const [filterStatus,setFilterStatus] = useState("All");
  const [filterType,setFilterType]   = useState("All");
  const [userForm,setUserForm]       = useState({name:"",email:"",password:"",role:"employee"});
  const [userError,setUserError]     = useState("");
  const [showPwd,setShowPwd]         = useState(false);
  const [resetTarget,setResetTarget] = useState(null);
  const [exportFilter,setExportFilter] = useState({member:"all",status:"all",from:"",to:""});

  function buildEntryForm(member,cu,type="makeup") {
    return {userId:member?.id||"",memberName:member?.name||"",absenceDate:today(),absenceType:type==="toil"?"Project Deadline":type==="paid"?"Weekend Work":"Sick Leave",hoursOwed:"",makeupDate:"",paymentRate:"Standard (1x)",authorisedBy:cu?.name||"",comments:"",status:"Pending",managerNotes:"",entryType:type};
  }

  const showToast = (msg,type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const employees = allUsers.filter(u=>u.role==="employee");
  const managers  = allUsers.filter(u=>["manager","admin"].includes(u.role));

  // Dashboard computed values
  const todayStr   = today();
  const nextWeekDt = new Date(); nextWeekDt.setDate(nextWeekDt.getDate()+7);
  const nextWeekStr = nextWeekDt.toISOString().split("T")[0];
  const thisMonth   = new Date().toISOString().slice(0,7);

  const pendingQueue   = allEntries.filter(e=>e.status==="Pending").sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  const overdueEntries = allEntries.filter(e=>e.makeupDate&&e.makeupDate<todayStr&&!["Completed","Cancelled"].includes(e.status));
  const upcomingEntries= allEntries.filter(e=>e.makeupDate&&e.makeupDate>=todayStr&&e.makeupDate<=nextWeekStr&&!["Completed","Cancelled"].includes(e.status)).sort((a,b)=>a.makeupDate.localeCompare(b.makeupDate));
  const recentActivity = [...allEntries].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,8);
  const paidThisMonth  = allEntries.filter(e=>e.entryType==="paid"&&e.absenceDate?.startsWith(thisMonth)).reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedMonth = allEntries.filter(e=>e.status==="Completed"&&(e.updatedAt||e.createdAt)?.startsWith(thisMonth)).length;

  const makeupEntries = allEntries.filter(e=>e.entryType!=="toil"&&e.entryType!=="paid");
  const toilEntries   = allEntries.filter(e=>e.entryType==="toil");
  const totalMakeupHours = makeupEntries.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const totalToilHours   = toilEntries.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedMakeup  = makeupEntries.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const completedToil    = toilEntries.filter(e=>e.status==="Completed").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0);
  const pendingCount     = allEntries.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length;

  const memberSummary = employees.map(u=>{
    const me=allEntries.filter(e=>e.userId===u.id);
    return {name:u.name,makeup:me.filter(e=>e.entryType!=="toil"&&e.entryType!=="paid").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0),toil:me.filter(e=>e.entryType==="toil").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0),paid:me.filter(e=>e.entryType==="paid").reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0),open:me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length,count:me.length};
  }).filter(m=>m.count>0);

  const statusSummary = STATUSES.map(s=>({name:s,value:allEntries.filter(e=>e.status===s).length})).filter(s=>s.value>0);
  const monthlyMap={};
  allEntries.forEach(e=>{const mo=e.absenceDate?.slice(0,7);if(!mo)return;if(!monthlyMap[mo])monthlyMap[mo]={month:mo,makeup:0,toil:0,paid:0};if(e.entryType==="toil")monthlyMap[mo].toil+=parseFloat(e.hoursOwed)||0;else if(e.entryType==="paid")monthlyMap[mo].paid+=parseFloat(e.hoursOwed)||0;else monthlyMap[mo].makeup+=parseFloat(e.hoursOwed)||0;});
  const monthlyData = Object.values(monthlyMap).sort((a,b)=>a.month.localeCompare(b.month)).slice(-8).map(d=>({...d,label:new Date(d.month+"-01").toLocaleDateString("en-GB",{month:"short",year:"2-digit"})}));

  const quickApprove = async (entry) => {
    const updated={...entry,status:"Approved",authorisedBy:currentUser.name,updatedAt:new Date().toISOString()};
    await onSaveEntry(updated,true);
    const emp=allUsers.find(u=>u.id===entry.userId);
    if(emp) await notifyEmployee(emp,updated,"Approved",currentUser.name);
    showToast(`${entry.memberName}'s request approved`);
  };
  const quickReject = async (entry) => {
    const updated={...entry,status:"Cancelled",authorisedBy:currentUser.name,updatedAt:new Date().toISOString()};
    await onSaveEntry(updated,true);
    const emp=allUsers.find(u=>u.id===entry.userId);
    if(emp) await notifyEmployee(emp,updated,"Rejected",currentUser.name);
    showToast(`${entry.memberName}'s request rejected`);
  };

  const handleSaveEntry = async () => {
    if (!form.userId||!form.absenceDate||!form.hoursOwed) { showToast("Fill in all required fields","error"); return; }
    const isEdit=!!editEntry;
    const entry=isEdit?{...editEntry,...form,updatedAt:new Date().toISOString()}:{...form,id:generateId(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await onSaveEntry(entry,isEdit);
    if (!isEdit) await notifyManagers(allUsers,entry);
    if (isEdit&&["Approved","Cancelled"].includes(form.status)) {
      const emp=allUsers.find(u=>u.id===entry.userId);
      if(emp) await notifyEmployee(emp,entry,form.status,currentUser.name);
    }
    showToast(isEdit?"Entry updated":"Entry added");
    setEditEntry(null); setForm(buildEntryForm(null,currentUser,"makeup")); setView(activeMember?"member":"log");
  };

  const openEdit = (entry) => { setForm({...entry}); setEditEntry(entry); setView("edit"); };
  const openAdd  = (member=null,type="makeup") => { setForm(buildEntryForm(member,currentUser,type)); setEditEntry(null); setView("add"); };
  const handleDelete = (id) => { if(!window.confirm("Delete this entry?"))return; onDeleteEntry(id); showToast("Deleted"); };

  const memberEntries = (uid) => allEntries.filter(e=>e.userId===uid);

  let filteredEntries = allEntries;
  if (filterType!=="All") filteredEntries=filteredEntries.filter(e=>e.entryType===filterType);
  if (filterStatus!=="All") filteredEntries=filteredEntries.filter(e=>e.status===filterStatus);

  // Export handler
  const handleExport = () => {
    let data=[...allEntries];
    if(exportFilter.member!=="all") data=data.filter(e=>e.memberName===exportFilter.member||e.userId===exportFilter.member);
    if(exportFilter.status!=="all") data=data.filter(e=>e.status===exportFilter.status);
    if(exportFilter.from) data=data.filter(e=>e.absenceDate>=exportFilter.from);
    if(exportFilter.to)   data=data.filter(e=>e.absenceDate<=exportFilter.to);
    if(!data.length){showToast("No entries match these filters","error");return;}
    exportToCSV(data, `makeup-tracker-export-${todayStr}`);
    showToast(`Exported ${data.length} entries`);
  };

  const addUser = () => {
    setUserError("");
    if (!userForm.name||!userForm.email||!userForm.password){setUserError("All fields are required.");return;}
    if (allUsers.find(u=>u.email.toLowerCase()===userForm.email.toLowerCase())){setUserError("That email is already registered.");return;}
    onSaveUsers([...allUsers,{id:generateId(),...userForm}]);
    setUserForm({name:"",email:"",password:"",role:"employee"});
    showToast(`${userForm.name} added`);
  };
  const removeUser = (id) => {
    if(id===currentUser.id){showToast("You can't remove yourself","error");return;}
    if(!window.confirm("Remove this user?"))return;
    onSaveUsers(allUsers.filter(u=>u.id!==id));
    showToast("User removed");
  };
  const canResetUser = (u) => {
    if(u.id===currentUser.id) return false;
    if(currentUser.role==="admin") return true;
    if(currentUser.role==="manager"&&u.role==="employee") return true;
    return false;
  };

  const navItems=[["dashboard","📊 Dashboard"],["log","📋 All Entries"],["member","👥 By Member"],...(currentUser.role==="admin"?[["users","⚙️ Users"],["export","📥 Export"]]:[["export","📥 Export"]])];

  const kpiCard = (label,value,sub,color,delta=null) => (
    <div style={{background:"#1e293b",borderRadius:"12px",padding:"16px",border:"1px solid #334155",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:color}}/>
      <div style={{fontSize:"10px",color:"#64748b",fontWeight:700,textTransform:"uppercase",letterSpacing:".05em",marginBottom:"6px"}}>{label}</div>
      <div style={{fontSize:"22px",fontWeight:700,color:color,fontFamily:"monospace"}}>{value}</div>
      <div style={{fontSize:"11px",color:"#64748b",marginTop:"3px"}}>{sub}</div>
      {delta && <div style={{fontSize:"10px",fontWeight:600,marginTop:"3px",color:delta.up?"#ef4444":"#10b981"}}>{delta.text}</div>}
    </div>
  );

  return (
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#0f172a",minHeight:"100vh",color:"#f1f5f9",fontSize:"14px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      {toast && <div style={{position:"fixed",top:"16px",right:"16px",zIndex:9999,background:toast.type==="error"?"#ef4444":"#10b981",color:"#fff",borderRadius:"10px",padding:"10px 18px",fontSize:"13px",fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>{toast.msg}</div>}
      {showPwd && <ChangePasswordModal currentUser={currentUser} allUsers={allUsers} onSaveUsers={onSaveUsers} onClose={()=>setShowPwd(false)}/>}
      {resetTarget && <ResetPasswordModal targetUser={resetTarget} allUsers={allUsers} onSaveUsers={onSaveUsers} onClose={()=>setResetTarget(null)}/>}

      <div style={{background:"#1e293b",borderBottom:"1px solid #334155",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:"56px",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div style={{width:"30px",height:"30px",borderRadius:"8px",background:"linear-gradient(135deg,#f59e0b,#ef4444)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>⏱</div>
          <div><div style={{fontWeight:700,fontSize:"14px"}}>Makeup Time Tracker</div>
          <div style={{fontSize:"10px",color:"#64748b",textTransform:"uppercase",letterSpacing:".06em"}}>Enroly · {currentUser.role==="admin"?"Admin":"Manager"}</div></div>
        </div>
        <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
          {navItems.map(([v,l])=>(<button key={v} onClick={()=>{setView(v);setActiveMember(null);}} style={{padding:"6px 12px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:600,background:view===v?"#f59e0b":"transparent",color:view===v?"#0f172a":"#94a3b8"}}>{l}</button>))}
          <button onClick={()=>openAdd()} style={{padding:"6px 14px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,background:"#10b981",color:"#fff"}}>+ New Entry</button>
          <div style={{width:"1px",height:"20px",background:"#334155",margin:"0 4px"}}/>
          <div style={{width:"28px",height:"28px",borderRadius:"50%",background:`hsl(${currentUser.name.charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700}}>{currentUser.name[0]}</div>
          <span style={{fontSize:"13px",color:"#94a3b8"}}>{currentUser.name}</span>
          <button onClick={()=>setShowPwd(true)} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:"12px"}}>🔑</button>
          <button onClick={onLogout} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid #334155",background:"transparent",color:"#64748b",cursor:"pointer",fontSize:"12px"}}>Sign out</button>
        </div>
      </div>

      <div style={{padding:"24px",maxWidth:"1300px",margin:"0 auto"}}>

        {/* ── DASHBOARD ── */}
        {view==="dashboard" && (
          <div>
            <h2 style={{fontSize:"20px",fontWeight:700,marginBottom:"20px"}}>Team overview</h2>

            {/* Overdue alert */}
            {overdueEntries.length>0 && (
              <div style={{background:"#ef444411",border:"1px solid #ef444433",borderRadius:"10px",padding:"12px 16px",display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"}}>
                <span style={{fontSize:"18px"}}>⚠️</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:"13px",fontWeight:700,color:"#ef4444"}}>{overdueEntries.length} makeup date{overdueEntries.length>1?"s":""} are overdue</div>
                  <div style={{fontSize:"11px",color:"#94a3b8",marginTop:"2px"}}>{overdueEntries.map(e=>`${e.memberName} (was ${fmtDate(e.makeupDate)})`).join(" · ")}</div>
                </div>
                <button onClick={()=>{setFilterStatus("All");setView("log");}} style={{padding:"6px 14px",borderRadius:"7px",border:"1px solid #ef444444",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px",fontWeight:700}}>Review</button>
              </div>
            )}

            {/* KPI row — 5 cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"12px",marginBottom:"16px"}}>
              {kpiCard("Needs action",pendingCount,"Pending approval","#ef4444")}
              {kpiCard("Makeup hrs owed",totalMakeupHours.toFixed(1)+"h",`${completedMakeup.toFixed(1)}h recovered`,"#f59e0b")}
              {kpiCard("TOIL owed to team",totalToilHours.toFixed(1)+"h",`${completedToil.toFixed(1)}h taken`,"#8b5cf6")}
              {kpiCard("Paid OT this month",paidThisMonth.toFixed(1)+"h","Compensated financially","#10b981")}
              {kpiCard("Completed this month",completedMonth,"Entries closed out","#3b82f6")}
            </div>

            {allEntries.length===0 ? <Empty msg="No entries yet"/> : (
              <>
                {/* Pending queue + upcoming */}
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:"14px",marginBottom:"14px"}}>
                  <MiniPanel>
                    <PanelTitle>Pending approval ({pendingQueue.length})</PanelTitle>
                    {pendingQueue.length===0 ? <div style={{fontSize:"12px",color:"#64748b",textAlign:"center",padding:"16px 0"}}>All caught up — nothing pending</div> : (
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {pendingQueue.slice(0,5).map(e=>(
                          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"8px 10px",background:"#0f172a",borderRadius:"8px",border:"1px solid #334155"}}>
                            <div style={{width:"28px",height:"28px",borderRadius:"50%",background:`hsl(${(e.memberName||"?").charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:700,flexShrink:0}}>{(e.memberName||"?")[0]}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:"12px",fontWeight:600}}>{e.memberName}</div>
                              <div style={{fontSize:"10px",color:"#64748b"}}><TypeBadge type={e.entryType}/>&nbsp; {e.hoursOwed}h · {fmtDate(e.absenceDate)}</div>
                            </div>
                            <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                              <button onClick={()=>quickApprove(e)} style={{padding:"4px 10px",borderRadius:"6px",border:"none",background:"#10b98122",color:"#10b981",cursor:"pointer",fontSize:"10px",fontWeight:700}}>✓ Approve</button>
                              <button onClick={()=>quickReject(e)}  style={{padding:"4px 10px",borderRadius:"6px",border:"none",background:"#ef444422",color:"#ef4444",cursor:"pointer",fontSize:"10px",fontWeight:700}}>✕ Reject</button>
                            </div>
                          </div>
                        ))}
                        {pendingQueue.length>5 && <div style={{fontSize:"11px",color:"#3b82f6",textAlign:"center",cursor:"pointer",padding:"4px"}} onClick={()=>{setFilterStatus("Pending");setView("log");}}>View {pendingQueue.length-5} more →</div>}
                      </div>
                    )}
                  </MiniPanel>

                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    <MiniPanel style={{flex:1}}>
                      <PanelTitle>Upcoming this week</PanelTitle>
                      {upcomingEntries.length===0 ? <div style={{fontSize:"12px",color:"#64748b"}}>Nothing due this week</div> : (
                        upcomingEntries.slice(0,4).map(e=>(
                          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 0",borderBottom:"1px solid #334155"}}>
                            <div style={{width:"7px",height:"7px",borderRadius:"50%",background:e.entryType==="toil"?"#8b5cf6":"#f59e0b",flexShrink:0}}/>
                            <div style={{flex:1,fontSize:"11px",fontWeight:600}}>{e.memberName}</div>
                            <div style={{fontSize:"10px",color:"#f59e0b",fontWeight:700}}>{e.hoursOwed}h</div>
                            <div style={{fontSize:"10px",color:"#64748b",fontFamily:"monospace"}}>{fmtDate(e.makeupDate)}</div>
                          </div>
                        ))
                      )}
                    </MiniPanel>
                    {overdueEntries.length>0 && (
                      <MiniPanel style={{flex:1,borderColor:"#ef444433"}}>
                        <PanelTitle>Overdue</PanelTitle>
                        {overdueEntries.slice(0,3).map(e=>(
                          <div key={e.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 0",borderBottom:"1px solid #334155"}}>
                            <div style={{width:"7px",height:"7px",borderRadius:"50%",background:"#ef4444",flexShrink:0}}/>
                            <div style={{flex:1,fontSize:"11px",fontWeight:600}}>{e.memberName}</div>
                            <div style={{fontSize:"10px",color:"#ef4444",fontFamily:"monospace"}}>{fmtDate(e.makeupDate)}</div>
                          </div>
                        ))}
                      </MiniPanel>
                    )}
                  </div>
                </div>

                {/* Charts row */}
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"14px",marginBottom:"14px"}}>
                  <MiniPanel>
                    <PanelTitle>Monthly hours — makeup vs TOIL vs paid OT</PanelTitle>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"8px",fontSize:"12px"}}/>
                        <Legend wrapperStyle={{fontSize:"11px"}}/>
                        <Bar dataKey="makeup" fill="#f59e0b" name="Makeup" radius={[4,4,0,0]}/>
                        <Bar dataKey="toil"   fill="#8b5cf6" name="TOIL"   radius={[4,4,0,0]}/>
                        <Bar dataKey="paid"   fill="#10b981" name="Paid OT" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </MiniPanel>

                  <MiniPanel>
                    <PanelTitle>By status</PanelTitle>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={statusSummary} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} dataKey="value">
                          {statusSummary.map((s,i)=><Cell key={i} fill={STATUS_COLORS[s.name]||"#888"}/>)}
                        </Pie>
                        <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"8px",fontSize:"12px"}}/>
                        <Legend wrapperStyle={{fontSize:"10px"}}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </MiniPanel>

                  <MiniPanel>
                    <PanelTitle>Recent activity</PanelTitle>
                    <div style={{display:"flex",flexDirection:"column",gap:"0"}}>
                      {recentActivity.map(e=>(
                        <div key={e.id} style={{display:"flex",gap:"8px",padding:"6px 0",borderBottom:"1px solid #1e293b55"}}>
                          <div style={{width:"6px",height:"6px",borderRadius:"50%",background:e.status==="Completed"?"#10b981":e.status==="Cancelled"?"#ef4444":e.status==="Approved"?"#3b82f6":"#f59e0b",marginTop:"4px",flexShrink:0}}/>
                          <div>
                            <div style={{fontSize:"11px",color:"#94a3b8",lineHeight:1.4}}><strong style={{color:"#f1f5f9"}}>{e.memberName}</strong> — {e.absenceType}</div>
                            <div style={{fontSize:"10px",color:"#475569",marginTop:"1px"}}><StatusBadge status={e.status}/> &nbsp;{fmtDateTime(e.updatedAt||e.createdAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </MiniPanel>
                </div>

                {/* Member bar chart */}
                {memberSummary.length>0 && (
                  <MiniPanel>
                    <PanelTitle>Hours by team member (makeup / TOIL / paid OT)</PanelTitle>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={memberSummary}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                        <XAxis dataKey="name" tick={{fill:"#94a3b8",fontSize:12}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fill:"#64748b",fontSize:11}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{background:"#0f172a",border:"1px solid #334155",borderRadius:"8px",fontSize:"12px"}}/>
                        <Legend wrapperStyle={{fontSize:"11px"}}/>
                        <Bar dataKey="makeup" fill="#f59e0b" name="Makeup" radius={[4,4,0,0]}/>
                        <Bar dataKey="toil"   fill="#8b5cf6" name="TOIL"   radius={[4,4,0,0]}/>
                        <Bar dataKey="paid"   fill="#10b981" name="Paid OT" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </MiniPanel>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ALL ENTRIES ── */}
        {view==="log" && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
              <h2 style={{fontSize:"20px",fontWeight:700}}>All Entries</h2>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:"11px",color:"#64748b"}}>Type:</span>
                {["All","makeup","toil","paid"].map(t=>(
                  <button key={t} onClick={()=>setFilterType(t)} style={{padding:"4px 10px",borderRadius:"9999px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:600,background:filterType===t?(t==="toil"?"#8b5cf6":t==="makeup"?"#f59e0b":t==="paid"?"#10b981":"#475569"):"#1e293b",color:filterType===t?"#fff":"#94a3b8"}}>
                    {t==="All"?"All":t==="toil"?"TOIL":t==="paid"?"Paid OT":"Makeup"}
                  </button>
                ))}
                <span style={{fontSize:"11px",color:"#64748b",marginLeft:"4px"}}>Status:</span>
                {["All",...STATUSES].map(s=>(
                  <button key={s} onClick={()=>setFilterStatus(s)} style={{padding:"4px 10px",borderRadius:"9999px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:600,background:filterStatus===s?(STATUS_COLORS[s]||"#475569"):"#1e293b",color:filterStatus===s?"#fff":"#94a3b8"}}>{s}</button>
                ))}
              </div>
            </div>
            {filteredEntries.length===0 ? <Empty msg="No entries found"/> : <EntryTable entries={filteredEntries} onEdit={openEdit} onDelete={handleDelete} currentUser={currentUser}/>}
          </div>
        )}

        {/* ── BY MEMBER ── */}
        {view==="member" && !activeMember && (
          <div>
            <h2 style={{fontSize:"20px",fontWeight:700,marginBottom:"20px"}}>By Team Member</h2>
            {employees.length===0 ? <Empty msg="No employee accounts yet — add them in ⚙️ Users"/> : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"14px"}}>
                {employees.map(u=>{
                  const me=memberEntries(u.id);
                  const mkup=me.filter(e=>e.entryType!=="toil"&&e.entryType!=="paid");
                  const toil=me.filter(e=>e.entryType==="toil");
                  const paid=me.filter(e=>e.entryType==="paid");
                  const open=me.filter(e=>["Pending","Scheduled","In Progress"].includes(e.status)).length;
                  return (
                    <div key={u.id} onClick={()=>setActiveMember(u)} style={{background:"#1e293b",borderRadius:"14px",padding:"18px",border:"1px solid #334155",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.borderColor="#f59e0b"} onMouseLeave={e=>e.currentTarget.style.borderColor="#334155"}>
                      <div style={{width:"40px",height:"40px",borderRadius:"50%",background:`hsl(${u.name.charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"16px",marginBottom:"10px"}}>{u.name[0]}</div>
                      <div style={{fontWeight:700}}>{u.name}</div>
                      <div style={{fontSize:"12px",color:"#f59e0b",marginTop:"4px"}}>⏱ {mkup.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h makeup</div>
                      <div style={{fontSize:"12px",color:"#8b5cf6",marginTop:"2px"}}>🕐 {toil.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h TOIL</div>
                      <div style={{fontSize:"12px",color:"#10b981",marginTop:"2px"}}>💰 {paid.reduce((s,e)=>s+(parseFloat(e.hoursOwed)||0),0).toFixed(1)}h paid OT</div>
                      {open>0 && <div style={{marginTop:"8px"}}><StatusBadge status="Pending"/><span style={{fontSize:"11px",color:"#64748b",marginLeft:"4px"}}>{open} open</span></div>}
                      <div style={{display:"flex",gap:"4px",marginTop:"10px"}}>
                        <button onClick={e=>{e.stopPropagation();openAdd(u,"makeup");}} style={{flex:1,padding:"4px 4px",borderRadius:"6px",border:"1px solid #f59e0b44",background:"transparent",color:"#f59e0b",fontSize:"9px",cursor:"pointer"}}>+ Makeup</button>
                        <button onClick={e=>{e.stopPropagation();openAdd(u,"toil");}}   style={{flex:1,padding:"4px 4px",borderRadius:"6px",border:"1px solid #8b5cf644",background:"transparent",color:"#8b5cf6",fontSize:"9px",cursor:"pointer"}}>+ TOIL</button>
                        <button onClick={e=>{e.stopPropagation();openAdd(u,"paid");}}   style={{flex:1,padding:"4px 4px",borderRadius:"6px",border:"1px solid #10b98144",background:"transparent",color:"#10b981",fontSize:"9px",cursor:"pointer"}}>+ Paid</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {view==="member" && activeMember && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"20px"}}>
              <button onClick={()=>setActiveMember(null)} style={{background:"transparent",border:"1px solid #334155",color:"#94a3b8",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"12px"}}>← Back</button>
              <div style={{width:"36px",height:"36px",borderRadius:"50%",background:`hsl(${activeMember.name.charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>{activeMember.name[0]}</div>
              <h2 style={{fontSize:"20px",fontWeight:700,margin:0}}>{activeMember.name}</h2>
              <div style={{marginLeft:"auto",display:"flex",gap:"8px"}}>
                <button onClick={()=>openAdd(activeMember,"makeup")} style={{padding:"7px 14px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,background:"#f59e0b",color:"#0f172a"}}>+ Makeup</button>
                <button onClick={()=>openAdd(activeMember,"toil")}   style={{padding:"7px 14px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,background:"#8b5cf6",color:"#fff"}}>+ TOIL</button>
                <button onClick={()=>openAdd(activeMember,"paid")}   style={{padding:"7px 14px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,background:"#10b981",color:"#fff"}}>+ Paid OT</button>
              </div>
            </div>
            {memberEntries(activeMember.id).length===0 ? <Empty msg={`No entries for ${activeMember.name} yet`}/> : <EntryTable entries={memberEntries(activeMember.id)} onEdit={openEdit} onDelete={handleDelete} currentUser={currentUser}/>}
          </div>
        )}

        {/* ── EXPORT ── */}
        {view==="export" && (
          <div>
            <h2 style={{fontSize:"20px",fontWeight:700,marginBottom:"20px"}}>Export Data</h2>
            <Card style={{maxWidth:"600px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
                <Field label="Member">
                  <select value={exportFilter.member} onChange={e=>setExportFilter({...exportFilter,member:e.target.value})} style={sStyle}>
                    <option value="all">All members</option>
                    {employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select value={exportFilter.status} onChange={e=>setExportFilter({...exportFilter,status:e.target.value})} style={sStyle}>
                    <option value="all">All statuses</option>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="From date"><input type="date" value={exportFilter.from} onChange={e=>setExportFilter({...exportFilter,from:e.target.value})} style={iStyle}/></Field>
                <Field label="To date"><input type="date" value={exportFilter.to} onChange={e=>setExportFilter({...exportFilter,to:e.target.value})} style={iStyle}/></Field>
              </div>
              <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
                <button onClick={handleExport} style={{padding:"10px 24px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:"#10b981",color:"#fff"}}>📥 Export CSV</button>
                <button onClick={()=>setExportFilter({member:"all",status:"all",from:"",to:""})} style={{padding:"10px 16px",borderRadius:"10px",border:"1px solid #334155",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:"13px"}}>Reset filters</button>
              </div>
              <p style={{fontSize:"12px",color:"#64748b",marginTop:"14px"}}>Opens in Excel, Google Sheets, or any spreadsheet app. All matching entries exported with full detail.</p>
            </Card>
          </div>
        )}

        {/* ── USERS (admin only) ── */}
        {view==="users" && currentUser.role==="admin" && (
          <div>
            <h2 style={{fontSize:"20px",fontWeight:700,marginBottom:"20px"}}>User Management</h2>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>
              <Card>
                <h3 style={{fontSize:"15px",fontWeight:700,marginBottom:"16px",color:"#f8fafc"}}>Add New User</h3>
                <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
                  <Field label="Full Name"><input value={userForm.name} onChange={e=>setUserForm({...userForm,name:e.target.value})} placeholder="e.g. Christine Santos" style={iStyle}/></Field>
                  <Field label="Email"><input type="email" value={userForm.email} onChange={e=>setUserForm({...userForm,email:e.target.value})} placeholder="e.g. christine@enroly.com" style={iStyle}/></Field>
                  <Field label="Temporary Password"><input type="text" value={userForm.password} onChange={e=>setUserForm({...userForm,password:e.target.value})} placeholder="They can change this after signing in" style={iStyle}/></Field>
                  <Field label="Role">
                    <select value={userForm.role} onChange={e=>setUserForm({...userForm,role:e.target.value})} style={sStyle}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </Field>
                  {userError && <div style={{color:"#ef4444",fontSize:"12px"}}>{userError}</div>}
                  <button onClick={addUser} style={{padding:"9px",borderRadius:"9px",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700,background:"#10b981",color:"#fff"}}>Add User</button>
                </div>
              </Card>
              <Card>
                <h3 style={{fontSize:"15px",fontWeight:700,marginBottom:"16px",color:"#f8fafc"}}>All Users ({allUsers.length})</h3>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {allUsers.map(u=>(
                    <div key={u.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:"#0f172a",borderRadius:"10px",border:"1px solid #334155"}}>
                      <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`hsl(${u.name.charCodeAt(0)*15},60%,40%)`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:"13px"}}>{u.name[0]}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:"13px"}}>{u.name}</div>
                        <div style={{fontSize:"11px",color:"#64748b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.email}</div>
                      </div>
                      <span style={{fontSize:"11px",fontWeight:600,padding:"2px 8px",borderRadius:"9999px",background:u.role==="admin"?"#f59e0b22":u.role==="manager"?"#3b82f622":"#10b98122",color:u.role==="admin"?"#f59e0b":u.role==="manager"?"#3b82f6":"#10b981"}}>{u.role}</span>
                      {u.id===currentUser.id && <span style={{fontSize:"11px",color:"#64748b"}}>you</span>}
                      {canResetUser(u) && <button onClick={()=>setResetTarget(u)} style={{padding:"4px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#3b82f6",cursor:"pointer",fontSize:"10px",fontWeight:600}}>🔑 Reset</button>}
                      {u.id!==currentUser.id && <button onClick={()=>removeUser(u.id)} style={{padding:"4px 8px",borderRadius:"6px",border:"1px solid #334155",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:"11px"}}>✕</button>}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ── ADD / EDIT ── */}
        {(view==="add"||view==="edit") && (
          <div>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"24px"}}>
              <button onClick={()=>setView(activeMember?"member":"log")} style={{background:"transparent",border:"1px solid #334155",color:"#94a3b8",borderRadius:"8px",padding:"6px 12px",cursor:"pointer",fontSize:"12px"}}>← Back</button>
              <h2 style={{fontSize:"20px",fontWeight:700,margin:0}}>{view==="edit"?"Edit Entry":"New Entry"}</h2>
              {view==="add" && (
                <div style={{display:"flex",gap:"0",background:"#0f172a",borderRadius:"8px",padding:"3px",border:"1px solid #334155"}}>
                  <button onClick={()=>setForm({...form,entryType:"makeup",absenceType:"Sick Leave"})} style={{padding:"5px 12px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:600,background:form.entryType==="makeup"?"#f59e0b":"transparent",color:form.entryType==="makeup"?"#0f172a":"#94a3b8"}}>Makeup</button>
                  <button onClick={()=>setForm({...form,entryType:"toil",absenceType:"Project Deadline"})} style={{padding:"5px 12px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:600,background:form.entryType==="toil"?"#8b5cf6":"transparent",color:form.entryType==="toil"?"#fff":"#94a3b8"}}>TOIL</button>
                  <button onClick={()=>setForm({...form,entryType:"paid",absenceType:"Weekend Work"})} style={{padding:"5px 12px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"11px",fontWeight:600,background:form.entryType==="paid"?"#10b981":"transparent",color:form.entryType==="paid"?"#fff":"#94a3b8"}}>Paid OT</button>
                </div>
              )}
            </div>
            <Card style={{maxWidth:"720px"}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
                <Field label="Team Member *">
                  <select value={form.userId} onChange={e=>{const u=employees.find(u=>u.id===e.target.value);setForm({...form,userId:e.target.value,memberName:u?.name||""}); }} style={sStyle}>
                    <option value="">Select member...</option>
                    {employees.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label={form.entryType==="toil"?"Reason *":form.entryType==="paid"?"Reason *":"Absence Type *"}>
                  <select value={form.absenceType} onChange={e=>setForm({...form,absenceType:e.target.value})} style={sStyle}>
                    {(form.entryType==="toil"?TOIL_REASONS:form.entryType==="paid"?PAID_OT_REASONS:ABSENCE_TYPES).map(t=><option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label={form.entryType==="toil"?"Date Worked *":form.entryType==="paid"?"Date Worked *":"Date of Absence *"}><input type="date" value={form.absenceDate} onChange={e=>setForm({...form,absenceDate:e.target.value})} style={iStyle}/></Field>
                <Field label="Hours *"><input type="number" step="0.5" min="0.5" placeholder="e.g. 7.5" value={form.hoursOwed} onChange={e=>setForm({...form,hoursOwed:e.target.value})} style={iStyle}/></Field>
                {form.entryType==="paid" ? (
                  <Field label="Payment Rate">
                    <select value={form.paymentRate||"Standard (1x)"} onChange={e=>setForm({...form,paymentRate:e.target.value})} style={sStyle}>
                      {PAYMENT_RATES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </Field>
                ) : (
                  <Field label={form.entryType==="toil"?"Proposed TOIL Date":"Makeup Date"}><input type="date" value={form.makeupDate} onChange={e=>setForm({...form,makeupDate:e.target.value})} style={iStyle}/></Field>
                )}
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
                <div style={{gridColumn:"1 / -1"}}><Field label="Comments"><textarea rows={3} value={form.comments} onChange={e=>setForm({...form,comments:e.target.value})} style={{...iStyle,resize:"vertical"}}/></Field></div>
              </div>
              <div style={{marginTop:"20px",display:"flex",gap:"10px"}}>
                <button onClick={handleSaveEntry} style={{padding:"10px 24px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"14px",fontWeight:700,background:form.entryType==="toil"?"#8b5cf6":form.entryType==="paid"?"#10b981":"#f59e0b",color:form.entryType==="makeup"?"#0f172a":"#fff"}}>{view==="edit"?"💾 Save Changes":"✅ Add Entry"}</button>
                <button onClick={()=>setView(activeMember?"member":"log")} style={{padding:"10px 18px",borderRadius:"10px",border:"1px solid #334155",cursor:"pointer",fontSize:"14px",fontWeight:600,background:"transparent",color:"#94a3b8"}}>Cancel</button>
              </div>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}

// ── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser,setCurrentUser] = useState(null);
  const [entries,setEntries]         = useState([]);
  const [users,setUsers]             = useState([]);
  const [loading,setLoading]         = useState(true);

  useEffect(()=>{
    (async()=>{
      const {data:u} = await supabase.from("users").select("*");
      const {data:e} = await supabase.from("entries").select("*");
      if(u) setUsers(u.map(r=>({id:r.id,email:r.email,password:r.password,name:r.name,role:r.role})));
      if(e) setEntries(e.map(toEntry));
      setLoading(false);
    })();

    const ch = supabase.channel("entries-live")
      .on("postgres_changes",{event:"*",schema:"public",table:"entries"},(payload)=>{
        if(payload.eventType==="INSERT"){const entry=toEntry(payload.new);setEntries(prev=>prev.find(e=>e.id===entry.id)?prev:[entry,...prev]);}
        if(payload.eventType==="UPDATE"){const entry=toEntry(payload.new);setEntries(prev=>prev.map(e=>e.id===entry.id?entry:e));}
        if(payload.eventType==="DELETE"){setEntries(prev=>prev.filter(e=>e.id!==payload.old.id));}
      }).subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  const toEntry = r => ({
    id:r.id, userId:r.user_id, memberName:r.member_name, absenceDate:r.absence_date,
    absenceType:r.absence_type, hoursOwed:r.hours_owed, makeupDate:r.makeup_date,
    paymentRate:r.payment_rate||"", authorisedBy:r.authorised_by, status:r.status,
    managerNotes:r.manager_notes, comments:r.comments,
    entryType:r.entry_type||"makeup", createdAt:r.created_at, updatedAt:r.updated_at
  });

  const saveUsers = useCallback(async(newUsers)=>{
    setUsers(newUsers);
    for(const u of newUsers){await supabase.from("users").upsert({id:u.id,email:u.email,password:u.password,name:u.name,role:u.role});}
    const removed=users.filter(u=>!newUsers.map(x=>x.id).includes(u.id));
    for(const u of removed){await supabase.from("users").delete().eq("id",u.id);}
  },[users]);

  const handleSaveEntry = useCallback(async(entry,isEdit)=>{
    const row={
      id:entry.id, user_id:entry.userId, member_name:entry.memberName,
      absence_date:entry.absenceDate, absence_type:entry.absenceType,
      hours_owed:entry.hoursOwed, makeup_date:entry.makeupDate||null,
      payment_rate:entry.paymentRate||null, authorised_by:entry.authorisedBy,
      status:entry.status, manager_notes:entry.managerNotes,
      comments:entry.comments, entry_type:entry.entryType||"makeup",
      updated_at:new Date().toISOString()
    };
    if(!isEdit) row.created_at=entry.createdAt;
    await supabase.from("entries").upsert(row);
    setEntries(prev=>isEdit?prev.map(e=>e.id===entry.id?entry:e):[entry,...prev]);
  },[]);

  const handleDeleteEntry = useCallback(async(id)=>{
    await supabase.from("entries").delete().eq("id",id);
    setEntries(prev=>prev.filter(e=>e.id!==id));
  },[]);

  if(loading) return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",color:"#f1f5f9",fontFamily:"sans-serif",fontSize:"16px"}}>Loading...</div>;
  if(!currentUser) return <LoginPage onLogin={setCurrentUser} allUsers={users}/>;
  if(currentUser.role==="employee") return <EmployeeView currentUser={currentUser} allEntries={entries} allUsers={users} onSave={e=>handleSaveEntry(e,false)} onSaveUsers={saveUsers} onLogout={()=>setCurrentUser(null)}/>;
  return <ManagerView currentUser={currentUser} allEntries={entries} allUsers={users} onSaveEntry={handleSaveEntry} onDeleteEntry={handleDeleteEntry} onSaveUsers={saveUsers} onLogout={()=>setCurrentUser(null)}/>;
}
