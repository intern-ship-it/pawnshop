import{w as j,u as ee,r as s,g as I,j as e,O as ae,F as te,d,R as se,q as ne,y as ie,s as M,e as m}from"./index-o28qtZ4E.js";import{B as p,m as N}from"./proxy-D6mGC7EI.js";import{C as b,I as o,M as le}from"./Modal-7Sg338uS.js";import{B as T}from"./Badge-Br48OPWn.js";import{S as D}from"./save-CPbhu9KD.js";import{H as A}from"./history-DPeaAPFW.js";import{A as ce}from"./index-B9GDT2Wk.js";import{K as E}from"./key-Cqdn2BOI.js";import{P as _}from"./phone-B5sqxf62.js";import{S as oe}from"./square-pen-DhoP9-Gi.js";const re=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",key:"13o1zl"}],["path",{d:"M2 12h20",key:"9i4pu4"}]],de=j("globe",re);const me=[["path",{d:"M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719",key:"1sd12s"}]],B=j("message-circle",me);const pe=[["path",{d:"M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z",key:"1ffxy3"}],["path",{d:"m21.854 2.147-10.94 10.939",key:"12cjpa"}]],he=j("send",pe);const ue=[["rect",{width:"14",height:"20",x:"5",y:"2",rx:"2",ry:"2",key:"1yt0o3"}],["path",{d:"M12 18h.01",key:"mhygvu"}]],xe=j("smartphone",ue);const ge=[["path",{d:"M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2",key:"125lnx"}],["path",{d:"M8.5 2h7",key:"csnxdl"}],["path",{d:"M14.5 16h-5",key:"1ox875"}]],R=j("test-tube",ge),W=[{id:"pledge_created",name:"Pledge Created",event:"New Pledge",enabled:!0,template:`Salam {customer_name},

Terima kasih kerana memilih {company_name}.

📋 *Butiran Pajak Gadai*
No. Pajak: {pledge_no}
Tarikh: {date}
Jumlah Pinjaman: RM{loan_amount}
Tarikh Tamat: {due_date}

Sila simpan mesej ini untuk rujukan.

Terima kasih.
{company_name}
{company_phone}`},{id:"renewal_done",name:"Renewal Confirmation",event:"After Renewal",enabled:!0,template:`Salam {customer_name},

Pembaharuan pajak gadai anda telah berjaya.

📋 *Butiran Pembaharuan*
No. Pajak: {pledge_no}
Faedah Dibayar: RM{interest_paid}
Tarikh Tamat Baru: {new_due_date}

Terima kasih.
{company_name}`},{id:"redemption_done",name:"Redemption Confirmation",event:"After Redemption",enabled:!0,template:`Salam {customer_name},

Pajak gadai anda telah ditebus dengan jayanya.

📋 *Butiran Tebusan*
No. Pajak: {pledge_no}
Jumlah Dibayar: RM{total_paid}

Terima kasih kerana berurusan dengan kami. Kami mengalu-alukan anda kembali.

{company_name}`},{id:"due_reminder_7",name:"7 Days Reminder",event:"7 Days Before Due",enabled:!0,template:`Salam {customer_name},

⏰ *Peringatan: 7 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 7 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Jumlah Tebus: RM{redemption_amount}

Sila hubungi kami untuk tebusan atau pembaharuan.

{company_name}
{company_phone}`},{id:"due_reminder_3",name:"3 Days Reminder",event:"3 Days Before Due",enabled:!0,template:`Salam {customer_name},

⚠️ *Peringatan Segera: 3 Hari Lagi*

Pajak gadai anda akan tamat tempoh dalam 3 hari.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila ambil tindakan segera untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`},{id:"due_reminder_1",name:"1 Day Reminder",event:"1 Day Before Due",enabled:!0,template:`Salam {customer_name},

🚨 *Peringatan Akhir: ESOK*

Pajak gadai anda akan tamat tempoh ESOK.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}

Sila hubungi kami dengan segera.

{company_name}
{company_phone}`},{id:"overdue_notice",name:"Overdue Notice",event:"After Due Date",enabled:!0,template:`Salam {customer_name},

❌ *Notis: Pajak Gadai Tamat Tempoh*

Pajak gadai anda telah tamat tempoh.

No. Pajak: {pledge_no}
Tarikh Tamat: {due_date}
Hari Tertunggak: {days_overdue} hari

Sila hubungi kami dalam masa 14 hari untuk mengelakkan pelucuthakan.

{company_name}
{company_phone}`},{id:"auction_notice",name:"Auction Notice",event:"Before Auction",enabled:!1,template:`Salam {customer_name},

📢 *Notis Lelongan*

Pajak gadai anda telah dijadualkan untuk lelongan.

No. Pajak: {pledge_no}
Tarikh Lelongan: {auction_date}

Sila hubungi kami segera jika anda ingin menebus barang anda.

{company_name}
{company_phone}`}],H={enabled:!1,provider:"ultramsg",instanceId:"",token:"",phoneNumberId:"",defaultCountryCode:"+60",companyName:"PawnSys Sdn Bhd",companyPhone:"03-1234 5678"};function be(){const r=ee(),[t,l]=s.useState(H),[h,k]=s.useState(W),[u,L]=s.useState("config"),[O,C]=s.useState(!1),[x,w]=s.useState("disconnected"),[G,f]=s.useState(!1),[n,y]=s.useState(null),[je,$]=s.useState(!1),[g,K]=s.useState(""),[S,F]=s.useState("pledge_created"),[Y,z]=s.useState(!1),[v,P]=s.useState([]);s.useEffect(()=>{const a=I("whatsapp_settings",null);a&&(l(a.config||H),k(a.templates||W));const i=I("whatsapp_history",[]);P(i)},[]);const J=()=>{C(!0),setTimeout(()=>{M("whatsapp_settings",{config:t,templates:h}),C(!1),r(m({type:"success",title:"Saved",message:"WhatsApp settings saved successfully"}))},500)},U=()=>{w("checking"),setTimeout(()=>{t.instanceId&&t.token?(w("connected"),r(m({type:"success",title:"Connected",message:"WhatsApp API connection successful"}))):(w("disconnected"),r(m({type:"error",title:"Failed",message:"Please enter Instance ID and Token"})))},1500)},q=a=>{k(i=>i.map(c=>c.id===a?{...c,enabled:!c.enabled}:c))},V=a=>{y({...a}),f(!0)},X=()=>{k(a=>a.map(i=>i.id===n.id?n:i)),f(!1),r(m({type:"success",title:"Template Updated",message:n.name}))},Q=()=>{if(!g){r(m({type:"error",title:"Error",message:"Please enter phone number"}));return}z(!0);const a=h.find(i=>i.id===S);setTimeout(()=>{const c=[{id:`MSG-${Date.now()}`,timestamp:new Date().toISOString(),phone:g,template:a.name,status:"sent",message:a.template.replace("{customer_name}","Test Customer").replace("{company_name}",t.companyName).replace("{company_phone}",t.companyPhone).replace("{pledge_no}","PLG-2024-001234").replace("{date}",new Date().toLocaleDateString("en-MY")).replace("{loan_amount}","2,500.00").replace("{due_date}","24/01/2025").replace("{interest_paid}","50.00").replace("{new_due_date}","24/02/2025").replace("{total_paid}","2,550.00").replace("{redemption_amount}","2,550.00").replace("{days_overdue}","5").replace("{auction_date}","15/02/2025")},...v].slice(0,50);P(c),M("whatsapp_history",c),z(!1),$(!1),r(m({type:"success",title:"Message Sent",message:`Test message sent to ${g}`}))},1500)},Z=["{customer_name}","{customer_phone}","{customer_ic}","{pledge_no}","{date}","{loan_amount}","{due_date}","{interest_paid}","{new_due_date}","{total_paid}","{redemption_amount}","{days_overdue}","{auction_date}","{company_name}","{company_phone}"];return e.jsxs("div",{className:"space-y-6",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-3",children:[e.jsx("div",{className:"w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center",children:e.jsx(B,{className:"w-6 h-6 text-green-600"})}),e.jsxs("div",{children:[e.jsx("h2",{className:"text-lg font-semibold text-zinc-800",children:"WhatsApp Integration"}),e.jsx("p",{className:"text-sm text-zinc-500",children:"Send automated notifications via WhatsApp"})]})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(T,{variant:t.enabled?"success":"secondary",children:t.enabled?"Enabled":"Disabled"}),e.jsx(p,{variant:"accent",leftIcon:D,onClick:J,loading:O,children:"Save Settings"})]})]}),e.jsx("div",{className:"flex gap-2 border-b border-zinc-200",children:[{id:"config",label:"Configuration",icon:ae},{id:"templates",label:"Message Templates",icon:te},{id:"history",label:"History",icon:A},{id:"test",label:"Test",icon:R}].map(a=>e.jsxs("button",{onClick:()=>L(a.id),className:d("flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",u===a.id?"border-amber-500 text-amber-600":"border-transparent text-zinc-500 hover:text-zinc-700"),children:[e.jsx(a.icon,{className:"w-4 h-4"}),a.label]},a.id))}),e.jsxs(ce,{mode:"wait",children:[u==="config"&&e.jsxs(N.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},className:"grid grid-cols-1 lg:grid-cols-2 gap-6",children:[e.jsxs(b,{className:"p-6",children:[e.jsxs("h3",{className:"font-semibold text-zinc-800 mb-4 flex items-center gap-2",children:[e.jsx(E,{className:"w-5 h-5 text-amber-500"}),"API Configuration"]}),e.jsxs("div",{className:"space-y-4",children:[e.jsxs("div",{className:"flex items-center justify-between p-3 bg-zinc-50 rounded-lg",children:[e.jsx("span",{className:"text-sm font-medium",children:"Enable WhatsApp"}),e.jsx("button",{onClick:()=>l({...t,enabled:!t.enabled}),className:d("w-12 h-6 rounded-full transition-colors relative",t.enabled?"bg-green-500":"bg-zinc-300"),children:e.jsx("div",{className:d("w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform",t.enabled?"translate-x-6":"translate-x-0.5")})})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-zinc-700 mb-1",children:"Provider"}),e.jsxs("select",{value:t.provider,onChange:a=>l({...t,provider:a.target.value}),className:"w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500",children:[e.jsx("option",{value:"ultramsg",children:"UltraMsg"}),e.jsx("option",{value:"twilio",children:"Twilio"}),e.jsx("option",{value:"wati",children:"WATI"})]})]}),e.jsx(o,{label:"Instance ID",placeholder:"Enter instance ID",value:t.instanceId,onChange:a=>l({...t,instanceId:a.target.value}),leftIcon:de}),e.jsx(o,{label:"API Token",type:"password",placeholder:"Enter API token",value:t.token,onChange:a=>l({...t,token:a.target.value}),leftIcon:E}),e.jsx(o,{label:"Default Country Code",placeholder:"+60",value:t.defaultCountryCode,onChange:a=>l({...t,defaultCountryCode:a.target.value}),leftIcon:_}),e.jsxs("div",{className:"flex items-center justify-between pt-4 border-t border-zinc-200",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:d("w-3 h-3 rounded-full",x==="connected"?"bg-green-500":x==="checking"?"bg-amber-500 animate-pulse":"bg-red-500")}),e.jsx("span",{className:"text-sm text-zinc-600",children:x==="connected"?"Connected":x==="checking"?"Checking...":"Disconnected"})]}),e.jsx(p,{variant:"outline",size:"sm",leftIcon:se,onClick:U,loading:x==="checking",children:"Test Connection"})]})]})]}),e.jsxs(b,{className:"p-6",children:[e.jsxs("h3",{className:"font-semibold text-zinc-800 mb-4 flex items-center gap-2",children:[e.jsx(xe,{className:"w-5 h-5 text-amber-500"}),"Company Info (for messages)"]}),e.jsxs("div",{className:"space-y-4",children:[e.jsx(o,{label:"Company Name",placeholder:"Your Company Sdn Bhd",value:t.companyName,onChange:a=>l({...t,companyName:a.target.value})}),e.jsx(o,{label:"Company Phone",placeholder:"03-1234 5678",value:t.companyPhone,onChange:a=>l({...t,companyPhone:a.target.value}),leftIcon:_})]}),e.jsx("div",{className:"mt-6 p-4 bg-blue-50 rounded-lg",children:e.jsxs("div",{className:"flex gap-3",children:[e.jsx(B,{className:"w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"}),e.jsxs("div",{className:"text-sm text-blue-700",children:[e.jsx("p",{className:"font-medium",children:"How it works:"}),e.jsxs("ol",{className:"list-decimal list-inside mt-2 space-y-1 text-xs",children:[e.jsx("li",{children:"Sign up at ultramsg.com or similar provider"}),e.jsx("li",{children:"Get your Instance ID and Token"}),e.jsx("li",{children:"Enter credentials above"}),e.jsx("li",{children:"Test connection"}),e.jsx("li",{children:"Customize message templates"}),e.jsx("li",{children:"Messages will be sent automatically!"})]})]})]})})]})]},"config"),u==="templates"&&e.jsx(N.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},children:e.jsxs(b,{className:"overflow-hidden",children:[e.jsx("div",{className:"p-4 border-b border-zinc-200 bg-zinc-50",children:e.jsxs("p",{className:"text-sm text-zinc-600",children:["Configure automatic WhatsApp messages for different events. Use variables like"," ",e.jsx("code",{className:"bg-zinc-200 px-1 rounded",children:"{customer_name}"})," to personalize messages."]})}),e.jsx("div",{className:"divide-y divide-zinc-100",children:h.map(a=>e.jsxs("div",{className:"p-4 hover:bg-zinc-50 transition-colors",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("button",{onClick:()=>q(a.id),className:d("w-10 h-6 rounded-full transition-colors relative",a.enabled?"bg-green-500":"bg-zinc-300"),children:e.jsx("div",{className:d("w-4 h-4 rounded-full bg-white absolute top-1 transition-transform",a.enabled?"translate-x-5":"translate-x-1")})}),e.jsxs("div",{children:[e.jsx("p",{className:"font-medium text-zinc-800",children:a.name}),e.jsx("p",{className:"text-xs text-zinc-500",children:a.event})]})]}),e.jsx(p,{variant:"ghost",size:"sm",leftIcon:oe,onClick:()=>V(a),children:"Edit"})]}),e.jsx("div",{className:"mt-3 ml-14",children:e.jsxs("pre",{className:"text-xs text-zinc-500 bg-zinc-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-24",children:[a.template.slice(0,150),"..."]})})]},a.id))})]})},"templates"),u==="history"&&e.jsx(N.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},children:e.jsxs(b,{className:"overflow-hidden",children:[e.jsxs("div",{className:"p-4 border-b border-zinc-200 flex items-center justify-between",children:[e.jsx("h3",{className:"font-semibold text-zinc-800",children:"Message History"}),e.jsxs(T,{variant:"info",children:[v.length," messages"]})]}),v.length===0?e.jsxs("div",{className:"p-12 text-center",children:[e.jsx(A,{className:"w-12 h-12 text-zinc-300 mx-auto mb-3"}),e.jsx("p",{className:"text-zinc-500",children:"No messages sent yet"})]}):e.jsx("div",{className:"divide-y divide-zinc-100 max-h-[500px] overflow-y-auto",children:v.map(a=>e.jsxs("div",{className:"p-4 hover:bg-zinc-50",children:[e.jsxs("div",{className:"flex items-center justify-between mb-2",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(_,{className:"w-4 h-4 text-zinc-400"}),e.jsx("span",{className:"font-medium",children:a.phone}),e.jsx(T,{variant:"secondary",children:a.template})]}),e.jsxs("div",{className:"flex items-center gap-2",children:[a.status==="sent"?e.jsx(ne,{className:"w-4 h-4 text-green-500"}):e.jsx(ie,{className:"w-4 h-4 text-red-500"}),e.jsx("span",{className:"text-xs text-zinc-400",children:new Date(a.timestamp).toLocaleString("en-MY")})]})]}),e.jsxs("pre",{className:"text-xs text-zinc-500 bg-zinc-100 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-20",children:[a.message.slice(0,200),"..."]})]},a.id))})]})},"history"),u==="test"&&e.jsx(N.div,{initial:{opacity:0,y:10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},className:"max-w-xl",children:e.jsxs(b,{className:"p-6",children:[e.jsxs("h3",{className:"font-semibold text-zinc-800 mb-4 flex items-center gap-2",children:[e.jsx(R,{className:"w-5 h-5 text-amber-500"}),"Send Test Message"]}),e.jsxs("div",{className:"space-y-4",children:[e.jsx(o,{label:"Phone Number",placeholder:"60123456789",value:g,onChange:a=>K(a.target.value),leftIcon:_,helperText:"Enter full number with country code (no + or spaces)"}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-zinc-700 mb-1",children:"Template"}),e.jsx("select",{value:S,onChange:a=>F(a.target.value),className:"w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500",children:h.map(a=>e.jsx("option",{value:a.id,children:a.name},a.id))})]}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-zinc-700 mb-1",children:"Message Preview"}),e.jsx("pre",{className:"text-xs text-zinc-600 bg-zinc-100 p-3 rounded-lg whitespace-pre-wrap max-h-48 overflow-y-auto",children:h.find(a=>a.id===S)?.template.replace("{customer_name}","Test Customer").replace("{company_name}",t.companyName).replace("{company_phone}",t.companyPhone).replace("{pledge_no}","PLG-2024-001234").replace("{date}",new Date().toLocaleDateString("en-MY")).replace("{loan_amount}","2,500.00").replace("{due_date}","24/01/2025")})]}),e.jsx(p,{variant:"accent",fullWidth:!0,leftIcon:he,onClick:Q,loading:Y,disabled:!g,children:"Send Test Message"})]}),e.jsx("div",{className:"mt-4 p-3 bg-amber-50 rounded-lg",children:e.jsxs("p",{className:"text-xs text-amber-700",children:[e.jsx("strong",{children:"Note:"})," In this prototype, messages are simulated. In production, messages will be sent via the configured WhatsApp API provider."]})})]})},"test")]}),e.jsx(le,{isOpen:G,onClose:()=>f(!1),title:"Edit Message Template",size:"lg",children:e.jsx("div",{className:"p-5",children:n&&e.jsxs("div",{className:"space-y-4",children:[e.jsx(o,{label:"Template Name",value:n.name,onChange:a=>y({...n,name:a.target.value})}),e.jsxs("div",{children:[e.jsx("label",{className:"block text-sm font-medium text-zinc-700 mb-1",children:"Message Template"}),e.jsx("textarea",{className:"w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-amber-500 font-mono text-sm",rows:12,value:n.template,onChange:a=>y({...n,template:a.target.value})})]}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs text-zinc-500 mb-2",children:"Available Variables (click to insert):"}),e.jsx("div",{className:"flex flex-wrap gap-1",children:Z.map(a=>e.jsx("button",{onClick:()=>y({...n,template:n.template+a}),className:"px-2 py-1 text-xs bg-zinc-100 hover:bg-zinc-200 rounded transition-colors",children:a},a))})]}),e.jsxs("div",{className:"flex gap-3 mt-6",children:[e.jsx(p,{variant:"outline",fullWidth:!0,onClick:()=>f(!1),children:"Cancel"}),e.jsx(p,{variant:"accent",fullWidth:!0,leftIcon:D,onClick:X,children:"Save Template"})]})]})})})]})}const ze=Object.freeze(Object.defineProperty({__proto__:null,default:be},Symbol.toStringTag,{value:"Module"}));export{B as M,be as W,ze as a};
