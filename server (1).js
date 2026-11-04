// Lesta Hub - başlat: node server.js  (bağımlılık yok)
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,ACCESS=process.env.ACCESS_CODE||'lesta4ever437';
const DB=path.join(__dirname,'data.json');
let db={scripts:[],keys:[],bans:[],runs:[]};
try{db=Object.assign(db,JSON.parse(fs.readFileSync(DB,'utf8')))}catch(e){}
const save=()=>fs.writeFile(DB,JSON.stringify(db),()=>{});
const rid=n=>crypto.randomBytes(n).toString('hex');
const sessions=new Set(),live={};
const UNIT={Dakika:6e4,Saat:36e5,'Gün':864e5,Hafta:6048e5,Ay:2592e6};
const EXP='YOUR KEY IS EXPIRED / KEYININ SURESI BITTI';
const sweep=()=>{const n=Date.now(),l=db.keys.length;db.keys=db.keys.filter(k=>k.expires>n);if(l!==db.keys.length)save()};
setInterval(sweep,15000);
const send=(res,c,b,t='application/json')=>{res.writeHead(c,{'Content-Type':t+'; charset=utf-8','Access-Control-Allow-Origin':'*'});res.end(typeof b==='string'?b:JSON.stringify(b))};

const LUA=`local HS=game:GetService("HttpService")
local lp=game:GetService("Players").LocalPlayer
local B,S="__B__","__S__"
local env=(getgenv and getgenv()) or _G
local key=env.script_key or script_key or ""
local gn="?"
pcall(function() gn=game:GetService("MarketplaceService"):GetProductInfo(game.PlaceId).Name end)
local function q(hb)
 local u=B.."/api/auth?sid="..S.."&key="..HS:UrlEncode(tostring(key)).."&uid="..lp.UserId.."&name="..HS:UrlEncode(lp.Name).."&pid="..game.PlaceId.."&jid="..HS:UrlEncode(game.JobId).."&gn="..HS:UrlEncode(gn).."&hb="..(hb and 1 or 0)
 local ok,r=pcall(function() return HS:JSONDecode(game:HttpGet(u)) end)
 if ok then return r end
end
local r=q(false)
if not r then warn("Lesta Hub: sunucuya ulasilamadi") return end
if not r.ok then lp:Kick(r.msg) return end
task.spawn(function()
 while task.wait(30) do
  local x=q(true)
  if x and not x.ok then lp:Kick(x.msg) break end
 end
end)
loadstring(r.code)()`;

function check(q){
  const s=db.scripts.find(x=>x.id===q.sid);
  if(!s)return{ok:false,msg:'Script bulunamadi'};
  const nm=String(q.name||'').toLowerCase(),id=String(q.uid||'');
  const ban=db.bans.find(b=>b.name.toLowerCase()===nm||b.name===id);
  if(ban)return{ok:false,msg:`Moderator Kick: ${ban.reason} (blacklistlendin)`};
  if(s.keyless)return{ok:true,s};
  const k=db.keys.find(x=>x.key===q.key&&x.sid===s.id);
  if(!k)return{ok:false,msg:EXP};
  return{ok:true,s,k};
}

http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x'),p=u.pathname,q=Object.fromEntries(u.searchParams),m=req.method;
  const base=String(req.headers['x-forwarded-proto']||'http').split(',')[0]+'://'+req.headers.host;
  sweep();
  if(p==='/')return fs.readFile(path.join(__dirname,'index.html'),(e,d)=>e?send(res,500,'hata','text/plain'):send(res,200,d.toString(),'text/html'));
  if(p.startsWith('/api/load/'))return send(res,200,LUA.replace('__B__',base).replace('__S__',p.slice(10).replace(/[^a-z0-9]/gi,'')),'text/plain');
  if(p==='/api/auth'){
    const r=check(q);
    if(!r.ok)return send(res,200,{ok:false,msg:r.msg});
    const n=Date.now(),L=live[q.uid];
    live[q.uid]={name:q.name,uid:q.uid,script:r.s.name,pid:q.pid,jid:q.jid,gn:q.gn,since:L&&n-L.last<120000?L.since:n,last:n};
    if(q.hb==='1')return send(res,200,{ok:true});
    if(r.k)r.k.used=true,r.k.usedBy=q.name;
    db.runs.unshift({name:q.name,uid:q.uid,script:r.s.name,t:n});db.runs=db.runs.slice(0,50);save();
    return send(res,200,{ok:true,code:r.s.code});
  }
  let b='';req.on('data',c=>b+=c);req.on('end',()=>{
    let d={};try{d=JSON.parse(b||'{}')}catch(e){}
    if(p==='/api/login'){
      if(d.code!==ACCESS)return send(res,401,{error:'Yanlis kod'});
      const t=rid(16);sessions.add(t);return send(res,200,{token:t});
    }
    if(!sessions.has(req.headers['x-token']))return send(res,401,{error:'yetkisiz'});
    const seg=p.split('/'),id=seg[3];
    if(p==='/api/state'&&m==='GET'){
      const n=Date.now(),pl=Object.values(live).filter(x=>n-x.last<75000);
      return send(res,200,{
        scripts:db.scripts.map(s=>({id:s.id,name:s.name,keyless:!!s.keyless,loadstring:(s.keyless?'':'script_key = "KEY-EKLE"\n')+`loadstring(game:HttpGet("${base}/api/load/${s.id}"))()`})),
        keys:db.keys.map(k=>({...k,script:(db.scripts.find(s=>s.id===k.sid)||{}).name||'?'})),
        bans:db.bans,runs:db.runs.slice(0,15),live:pl,
        stats:{scripts:db.scripts.length,keys:db.keys.length,active:db.keys.filter(k=>!k.used).length,used:db.keys.filter(k=>k.used).length,bans:db.bans.length,live:pl.length}
      });
    }
    if(p==='/api/scripts'&&m==='POST'){
      if(!d.name||!d.code)return send(res,400,{error:'Ad ve kod gerekli'});
      db.scripts.push({id:rid(6),name:d.name,code:d.code,keyless:!!d.keyless});save();return send(res,200,{ok:1});
    }
    if(seg[2]==='scripts'&&id){
      const s=db.scripts.find(x=>x.id===id);if(!s)return send(res,404,{error:'yok'});
      if(m==='PUT'){if(d.name)s.name=d.name;if(d.code)s.code=d.code;}
      if(m==='DELETE'){db.scripts=db.scripts.filter(x=>x!==s);db.keys=db.keys.filter(k=>k.sid!==id);}
      save();return send(res,200,{ok:1});
    }
    if(p==='/api/keys'&&m==='POST'){
      const ms=(+d.amount)*UNIT[d.unit];
      if(!db.scripts.find(s=>s.id===d.sid)||!(ms>0))return send(res,400,{error:'Gecersiz veri'});
      const out=[],qty=d.custom?1:Math.min(+d.qty||1,100);
      if(d.custom&&db.keys.find(k=>k.key===d.custom))return send(res,400,{error:'Bu key zaten var'});
      for(let i=0;i<qty;i++){
        const key=d.custom||'KEY-'+[rid(2),rid(2),rid(2)].join('-').toUpperCase();
        db.keys.unshift({key,sid:d.sid,note:d.note||'',created:Date.now(),expires:Date.now()+ms,used:false});out.push(key);
      }
      save();return send(res,200,{keys:out});
    }
    if(seg[2]==='keys'&&id&&m==='DELETE'){db.keys=db.keys.filter(k=>k.key!==decodeURIComponent(id));save();return send(res,200,{ok:1});}
    if(p==='/api/bans'&&m==='POST'){
      if(!d.name)return send(res,400,{error:'Kullanici gerekli'});
      db.bans.unshift({id:rid(4),name:String(d.name).trim(),reason:d.reason||'Yetkisiz paylasim',t:Date.now()});save();return send(res,200,{ok:1});
    }
    if(seg[2]==='bans'&&id&&m==='DELETE'){db.bans=db.bans.filter(x=>x.id!==id);save();return send(res,200,{ok:1});}
    send(res,404,{error:'yok'});
  });
}).listen(PORT,()=>console.log('Lesta Hub: http://localhost:'+PORT));
