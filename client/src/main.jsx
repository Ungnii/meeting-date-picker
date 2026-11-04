import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Users, LockKeyhole, ArrowRight, Check, Copy, LogOut, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import './style.css';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '') + '/api';
async function api(path, options={}) {
  const res = await fetch(API + path, { headers: { 'Content-Type':'application/json', ...(options.token ? {Authorization:`Bearer ${options.token}`} : {}) }, ...options, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || '요청을 처리하지 못했습니다.');
  return data;
}
const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dateRange = (start,end) => { const a=new Date(start+'T12:00:00'), b=new Date(end+'T12:00:00'), out=[]; for(let d=new Date(a);d<=b;d.setDate(d.getDate()+1)) out.push(new Date(d)); return out; };
function Shell({children}) { return <div className="app"><header className="top"><Link to="/" className="brand"><span className="brand-icon"><CalendarDays size={20}/></span> 모임날짜 잡기</Link><span className="top-note">모두의 시간을 맞추는 가장 쉬운 방법</span></header>{children}<footer>모임날짜 잡기 <span>·</span> 함께 가능한 날을 찾아보세요</footer></div>; }
function Home() {
  const [title,setTitle]=useState(''); const [start,setStart]=useState(''); const [end,setEnd]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState(''); const [created,setCreated]=useState(null);
  const submit=async e=>{e.preventDefault();setErr('');setBusy(true);try{const x=await api('/rooms',{method:'POST',body:{title,startDate:start,endDate:end}});setCreated(x);}catch(e){setErr(e.message);}finally{setBusy(false);}};
  const copy=async text=>{try{await navigator.clipboard.writeText(location.origin+text);alert('링크를 복사했습니다.');}catch{alert(location.origin+text);}};
  return <Shell><main className="hero"><div className="hero-copy"><div className="eyebrow"><Sparkles size={15}/> 일정 조율, 이제 간편하게</div><h1>우리 모두가 가능한 날,<br/><em>한눈에 찾아보세요.</em></h1><p>모임 기간을 정하고, 각자 어려운 날짜만 표시하면<br/>모두의 일정을 쉽게 맞출 수 있어요.</p><div className="feature-row"><span><Check size={16}/> 간편한 날짜 선택</span><span><Check size={16}/> 실시간 현황 확인</span></div></div>
  <section className="panel create-panel"><div className="panel-head"><div className="panel-icon"><CalendarDays/></div><div><h2>새 모임 만들기</h2><p>모임 정보를 입력해 주세요.</p></div></div>
  {created ? <div className="created"><div className="success-mark"><Check/></div><h3>모임이 만들어졌어요!</h3><p className="muted">{created.title}</p><label>모임원에게 공유할 참여 링크</label><div className="linkbox"><span>{location.origin+created.participantUrl}</span><button onClick={()=>copy(created.participantUrl)}><Copy size={16}/> 복사</button></div><label>모임장 전용 관리 링크</label><div className="linkbox admin-link"><span>{location.origin+created.adminUrl}</span><button onClick={()=>copy(created.adminUrl)}><Copy size={16}/> 복사</button></div><p className="warning">관리 링크는 모임장만 보관하세요. 분실하면 복구할 수 없습니다.</p><Link className="button primary full" to={created.adminUrl}>관리 화면 열기 <ArrowRight size={17}/></Link><button className="text-button" onClick={()=>setCreated(null)}>새 모임 만들기</button></div> :
  <form onSubmit={submit} className="form"><label>모임 이름</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="예: 연말 친목 모임" maxLength="120" required/><div className="date-fields"><div><label>조율 시작일</label><input type="date" value={start} onChange={e=>setStart(e.target.value)} required/></div><div><label>조율 종료일</label><input type="date" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)} required/></div></div>{err&&<div className="error">{err}</div>}<button className="button primary full" disabled={busy}>{busy?'만드는 중…':'모임 만들기'} <ArrowRight size={17}/></button><p className="form-hint"><LockKeyhole size={13}/> 모임원은 이름과 개인 비밀번호로 참여합니다.</p></form>}</section></main><section className="how"><h2>이용 방법은 간단해요</h2><div className="steps"><div><b>01</b><h3>모임 만들기</h3><p>모임명과 날짜 범위를 정해요.</p></div><div><b>02</b><h3>링크 공유하기</h3><p>모임원에게 참여 링크를 보내요.</p></div><div><b>03</b><h3>가능한 날 찾기</h3><p>불가능한 날을 표시하고 최적의 날을 확인해요.</p></div></div></section></Shell>;
}
function Auth({code,onDone}) {
  const [name,setName]=useState(''); const [password,setPassword]=useState(''); const [busy,setBusy]=useState(false); const [err,setErr]=useState('');
  const submit=async e=>{e.preventDefault();setBusy(true);setErr('');try{const data=await api(`/auth/${code}`,{method:'POST',body:{name,password}});localStorage.setItem(`meeting-${code}`,data.token);onDone(data);}catch(e){setErr(e.message);}finally{setBusy(false);}};
  return <div className="auth-card"><div className="panel-icon"><Users/></div><h2>모임에 참여하기</h2><p className="muted">이름과 개인 비밀번호를 입력해 주세요.<br/>처음 참여하면 계정이 만들어집니다.</p><form className="form" onSubmit={submit}><label>이름</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="이름 입력" maxLength="40" required/><label>개인 비밀번호</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="4자 이상 입력" minLength="4" required/>{err&&<div className="error">{err}</div>}<button className="button primary full" disabled={busy}>{busy?'확인 중…':'참여하기'} <ArrowRight size={17}/></button></form><p className="tiny"><LockKeyhole size={13}/> 비밀번호는 암호화되어 안전하게 저장됩니다.</p></div>;
}
function Calendar({start,end,unavailable={},selected=[],onToggle,readOnly=false}) {
  const dates=dateRange(start,end); const months=[];
  dates.forEach(d=>{const key=`${d.getFullYear()}-${d.getMonth()}`;let m=months.find(x=>x.key===key);if(!m){m={key,year:d.getFullYear(),month:d.getMonth(),days:[]};months.push(m);}m.days.push(d);});
  const total=Object.keys(unavailable).length>=0?null:null;
  return <div className="calendar-months">{months.map(m=>{const first=new Date(m.year,m.month,1).getDay();return <section className="month" key={m.key}><h3>{m.year}년 {m.month+1}월</h3><div className="calendar-grid">{['일','월','화','수','목','금','토'].map((w,i)=><div className={`weekday ${i===0?'sun':i===6?'sat':''}`} key={w}>{w}</div>)}{Array.from({length:first},(_,i)=><div key={'blank'+i}/>)}
  {m.days.map(d=>{const key=fmt(d), names=unavailable[key]||[], active=selected.includes(key);return <button type="button" key={key} disabled={readOnly} className={`day ${active?'selected':names.length?'has-unavailable':''} ${d.getDay()===0?'sun':''} ${d.getDay()===6?'sat':''}`} onClick={()=>onToggle?.(key)} title={names.length?`불가능: ${names.join(', ')}`:'불가능 표시 없음'}><span>{d.getDate()}</span>{names.length>0&&<small>{names.length}명</small>}{active&&<i>내 선택</i>}<div className="day-tooltip">{names.length? <><b>{d.getMonth()+1}월 {d.getDate()}일 · 불가능 {names.length}명</b>{names.map(n=><span key={n}>{n}</span>)}</> : <b>불가능 표시 없음</b>}</div></button>;})}</div></section>;})}</div>;
}
function Room() {
  const {code}=useParams(); const [room,setRoom]=useState(null); const [auth,setAuth]=useState(null); const [unavailable,setUnavailable]=useState({}); const [selected,setSelected]=useState([]); const [err,setErr]=useState(''); const [saved,setSaved]=useState(false); const [loading,setLoading]=useState(true);
  const load=async()=>{try{const [r,a]=await Promise.all([api(`/rooms/${code}`),api(`/rooms/${code}/availability`)]);setRoom(r);setUnavailable(a.unavailableByDate);}catch(e){setErr(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[code]);
  // Restore session by a lightweight endpoint is handled in a follow-up API request.
  useEffect(()=>{const token=localStorage.getItem(`meeting-${code}`);if(token) api(`/me`,{token}).then(x=>{setAuth({name:x.name,token});setSelected(x.unavailableDates||[]);}).catch(()=>localStorage.removeItem(`meeting-${code}`));},[code]);
  const toggle=d=>{setSelected(old=>old.includes(d)?old.filter(x=>x!==d):[...old,d]);setSaved(false);};
  const save=async()=>{try{await api('/me/dates',{method:'PUT',token:auth.token,body:{dates:selected}});setSaved(true);await load();}catch(e){setErr(e.message);}};
  const logout=()=>{localStorage.removeItem(`meeting-${code}`);setAuth(null);setSelected([]);};
  if(loading)return <Shell><div className="loading">모임 정보를 불러오는 중…</div></Shell>;
  if(!room)return <Shell><div className="auth-card"><h2>모임을 찾을 수 없습니다.</h2><p>{err}</p><Link to="/" className="button primary">처음으로</Link></div></Shell>;
  return <Shell><main className="room-wrap"><div className="room-heading"><div><div className="eyebrow">DATE POLL · 모임 일정 조율</div><h1>{room.title}</h1><p>{room.startDate} ~ {room.endDate}</p></div><div className="people-count"><Users size={17}/><b>{room.participantCount}</b><span>명 참여</span></div></div>
  {!auth?<Auth code={code} onDone={d=>{setAuth(d);setSelected(d.unavailableDates||[]);load();}}/>:
  <><div className="welcome"><div><span className="avatar">{auth.name.slice(0,1)}</span><b>{auth.name}</b><span className="muted">님, 참석이 어려운 날짜를 선택해 주세요.</span></div><button className="text-button" onClick={logout}><LogOut size={15}/> 로그아웃</button></div>
  <div className="legend"><span><i className="dot mine"/> 내가 선택한 날짜</span><span><i className="dot others"/> 불가능 표시가 있는 날짜</span><span><i className="dot clear"/> 표시 없음</span></div>
  <Calendar start={room.startDate} end={room.endDate} unavailable={unavailable} selected={selected} onToggle={toggle}/>
  <div className="savebar"><div><b>{selected.length}일</b><span> 참석 불가능한 날짜 선택됨</span></div><button className="button primary" onClick={save}>선택 저장하기 <Check size={17}/></button></div>{saved&&<p className="saved"><Check size={15}/> 응답을 저장했습니다.</p>}{err&&<p className="error">{err}</p>}</>}
  <section className="best-days"><h2><Sparkles size={18}/> 날짜별 참석 현황</h2><p>날짜 칸에 마우스를 올리거나 터치하면 참석이 어려운 사람을 확인할 수 있어요.</p><AvailabilitySummary start={room.startDate} end={room.endDate} unavailable={unavailable} total={room.participantCount}/></section></main></Shell>;
}
function AvailabilitySummary({start,end,unavailable,total}) {
  const best=useMemo(()=>dateRange(start,end).map(d=>({date:fmt(d),names:unavailable[fmt(d)]||[],available:total-(unavailable[fmt(d)]||[]).length})).sort((a,b)=>b.available-a.available),[start,end,unavailable,total]);
  if(!total)return <p className="muted">아직 참여한 모임원이 없습니다.</p>;
  return <div className="summary-list">{best.slice(0,5).map((d,i)=><div className="summary-row" key={d.date}><span className="rank">{i+1}</span><b>{d.date}</b><div className="bar"><i style={{width:`${Math.max(0,d.available/total*100)}%`}}/></div><strong>{d.available}/{total}명</strong></div>)}</div>;
}
function Admin() {
  const {code,token}=useParams(); const [data,setData]=useState(null); const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const load=()=>api(`/admin/${code}/${token}`).then(setData).catch(e=>setErr(e.message));
  useEffect(()=>{load();},[code,token]);
  const remove=async id=>{if(!confirm('이 참여자를 삭제할까요? 응답도 함께 삭제됩니다.'))return;try{await api(`/admin/${code}/${token}/participants/${id}`,{method:'DELETE'});load();}catch(e){setErr(e.message);}};
  if(err&&!data)return <Shell><div className="auth-card"><ShieldCheck size={32}/><h2>관리자 인증에 실패했습니다.</h2><p>{err}</p><Link to="/" className="button primary">처음으로</Link></div></Shell>;
  if(!data)return <Shell><div className="loading">관리자 정보를 불러오는 중…</div></Shell>;
  const count=data.participants.length;
  return <Shell><main className="room-wrap"><div className="room-heading"><div><div className="eyebrow"><ShieldCheck size={14}/> ADMIN · 모임장 관리</div><h1>{data.room.title}</h1><p>{data.room.startDate} ~ {data.room.endDate}</p></div><span className="admin-pill">관리자 전용</span></div>
  <div className="admin-stats"><div><Users/><strong>{count}</strong><span>참여 인원</span></div><div><CalendarDays/><strong>{Object.keys(data.unavailableByDate).length}</strong><span>응답이 있는 날짜</span></div></div>
  <section className="admin-section"><h2>참여자 응답 현황</h2>{count===0?<p className="muted">아직 참여자가 없습니다. 참여 링크를 공유해 주세요.</p>:<div className="participant-list">{data.participants.map(p=><div className="participant" key={p.id}><span className="avatar">{p.name.slice(0,1)}</span><b>{p.name}</b><span className="muted">{p.marked_count}일 불가능 표시</span><button className="icon-button" title="참여자 삭제" onClick={()=>remove(p.id)}><Trash2 size={16}/></button></div>)}</div>}</section>
  <section className="admin-section"><h2>날짜별 참석 현황</h2><Calendar start={data.room.startDate} end={data.room.endDate} unavailable={data.unavailableByDate} readOnly/><AvailabilitySummary start={data.room.startDate} end={data.room.endDate} unavailable={data.unavailableByDate} total={count}/></section>
  <div className="admin-share"><h3>모임원 초대하기</h3><p>아래 참여 링크를 모임원에게 공유하세요.</p><div className="linkbox"><span>{location.origin}/r/{code}</span><button onClick={()=>navigator.clipboard.writeText(`${location.origin}/r/${code}`)}><Copy size={16}/> 복사</button></div></div>
  </main></Shell>;
}
function App(){return <BrowserRouter><Routes><Route path="/" element={<Home/>}/><Route path="/r/:code" element={<Room/>}/><Route path="/r/:code/admin/:token" element={<Admin/>}/><Route path="*" element={<Shell><div className="auth-card"><h2>페이지를 찾을 수 없습니다.</h2><Link to="/" className="button primary">처음으로</Link></div></Shell>}/></Routes></BrowserRouter>}
createRoot(document.getElementById('root')).render(<App/>);
