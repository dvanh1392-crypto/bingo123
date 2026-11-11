const express=require('express');const http=require('http');const {Server}=require('socket.io');const crypto=require('crypto');
const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:'*'}});app.use(express.static('public'));
const rooms=new Map(),GRACE=30000;const lines=[...Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r*5+c)),...Array.from({length:5},(_,c)=>Array.from({length:5},(_,r)=>r*5+c)),[0,6,12,18,24],[4,8,12,16,20]];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
function board(mode){if(mode==='25')return shuffle(Array.from({length:25},(_,i)=>i+1));let cols=Array.from({length:5},(_,c)=>shuffle(Array.from({length:15},(_,i)=>c*15+i+1)).slice(0,5));return Array.from({length:25},(_,i)=>i===12?0:cols[i%5][Math.floor(i/5)]);}function count(p,r){return lines.filter(line=>line.every(i=>p.board[i]===0||p.marked.includes(p.board[i]))).length}
function code(){let s;do{s=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase()}while(rooms.has(s));return s}
function getPlayer(s){const c=s.data.code,token=s.data.token,r=rooms.get(c);return {r,p:r?.players.find(p=>p.token===token)}}
function send(r){io.to(r.code).emit('room', {code:r.code,mode:r.mode,capacity:r.capacity,phase:r.phase,host:r.host,players:r.players.map(p=>({id:p.id,name:p.name,ready:p.ready,online:p.online,lines:r.phase==='lobby'?0:count(p,r)})),turn:r.turn,called:r.called,last:r.called.at(-1)||null,deadline:r.deadline,winners:r.winners||[],scores:r.scores||{},round:r.round||0,replayVotes:r.replayVotes||[],reason:r.reason||'',paused:r.paused,continueVotes:r.continueVotes||[]});for(const p of r.players)if(p.socket){io.to(p.socket).emit('private',{id:p.id,board:p.board,marked:p.marked})}}
function stop(r){if(r.timer)clearTimeout(r.timer);r.timer=null;r.deadline=null}
function finish(r,winners,reason){
 if(r.phase==='ended')return;
 stop(r);r.phase='ended';r.winners=winners;r.reason=reason;
 r.round=(r.round||0)+1;r.replayVotes=[];
 // One win per winner; a draw gives no win. A departure win counts.
 if(winners.length===1){let id=winners[0];r.scores[id]=(r.scores[id]||0)+1}
 send(r)
}
function evaluate(r){let eligible=r.players.filter(p=>count(p,r)>= (r.mode==='25'?5:1));if(eligible.length){finish(r,eligible.map(p=>p.id),'bingo');return true}return false}
function schedule(r){stop(r);if(r.phase!=='playing'||r.paused)return;r.deadline=Date.now()+10000;r.timer=setTimeout(()=>{if(r.phase!=='playing'||r.paused)return;if(r.mode==='75')draw(r);else{let available=Array.from({length:25},(_,i)=>i+1).filter(n=>!r.called.includes(n));if(available.length)callNumber(r,available[crypto.randomInt(available.length)]);else finish(r,[],'draw')}} ,10000);send(r)}
function callNumber(r,n){if(r.phase!=='playing'||r.paused||r.called.includes(n))return;r.called.push(n);r.players.forEach(p=>{if(r.mode==='25'&&!p.marked.includes(n))p.marked.push(n)});if(evaluate(r))return;if(r.called.length===25&&r.mode==='25'){finish(r,[],'draw');return}r.turn=(r.turn+1)%r.players.length;schedule(r)}
function draw(r){if(r.phase!=='playing'||r.paused)return;let remaining=Array.from({length:75},(_,i)=>i+1).filter(n=>!r.called.includes(n));if(!remaining.length){finish(r,[],'draw');return}let n=remaining[crypto.randomInt(remaining.length)];r.called.push(n);send(r);if(r.called.length===75){r.finalDraw=true}schedule(r)}
function reset(r){stop(r);r.phase='lobby';r.called=[];r.turn=0;r.paused=false;r.winners=[];r.reason='';r.continueVotes=[];r.replayVotes=[];r.players.forEach(p=>{p.ready=false;p.board=[];p.marked=[]});send(r)}
function leave(r,p){if(!r||!p)return;const wasPlaying=r.phase==='playing';r.players=r.players.filter(x=>x!==p);delete r.scores[p.id];r.replayVotes=(r.replayVotes||[]).filter(id=>id!==p.id);if(p.socket){let s=io.sockets.sockets.get(p.socket);if(s){s.leave(r.code);s.data.code=null;s.data.token=null;s.emit('left')}}io.to(r.code).emit('notice',{type:'left',name:p.name});if(!r.players.length){stop(r);rooms.delete(r.code);return}if(r.host===p.id)r.host=r.players[0].id;if(r.phase==='ended'&&r.players.length===1){send(r);return}if(wasPlaying){if(r.players.length===1){finish(r,[r.players[0].id],'last');return}r.paused=true;r.continueVotes=[];stop(r);r.turn%=r.players.length}send(r)}
function respond(s,fn){try{fn()}catch(e){s.emit('errorMessage',e.message)}}
io.on('connection',s=>{
 s.on('create',({name,mode,capacity},ack)=>respond(s,()=>{name=String(name||'').trim().slice(0,20);if(!name)throw Error('Enter a name');if(!['25','75'].includes(mode)||![2,3,4].includes(Number(capacity)))throw Error('Invalid settings');let c=code(),token=crypto.randomBytes(20).toString('hex'),id=crypto.randomUUID();let p={id,token,name,ready:false,online:true,socket:s.id,board:[],marked:[]};let r={code:c,mode,capacity:Number(capacity),phase:'lobby',host:id,players:[p],called:[],turn:0,paused:false,scores:{[id]:0},round:0,replayVotes:[]};rooms.set(c,r);s.join(c);s.data={code:c,token};ack?.({ok:true,code:c,token});send(r)}));
 s.on('join',({name,code},ack)=>respond(s,()=>{name=String(name||'').trim().slice(0,20);code=String(code||'').toUpperCase().trim();let r=rooms.get(code);if(!name||!r)throw Error('Room not found / Không tìm thấy phòng');if(r.phase!=='lobby'||r.players.length>=r.capacity)throw Error('Room is full or already started');let token=crypto.randomBytes(20).toString('hex'),id=crypto.randomUUID();r.players.push({id,token,name,ready:false,online:true,socket:s.id,board:[],marked:[]});r.scores[id]=0;s.join(code);s.data={code,token};ack?.({ok:true,code,token});send(r)}));
 s.on('rejoin',({code,token},ack)=>respond(s,()=>{let r=rooms.get(String(code||'').toUpperCase()),p=r?.players.find(x=>x.token===token);if(!p)throw Error('Session expired');if(p.grace)clearTimeout(p.grace);p.socket=s.id;p.online=true;s.join(r.code);s.data={code:r.code,token};ack?.({ok:true,code:r.code,token});send(r)}));
 s.on('ready',()=>respond(s,()=>{let {r,p}=getPlayer(s);if(!r||!p||r.phase!=='lobby')return;p.ready=!p.ready;send(r)}));
 s.on('start',()=>respond(s,()=>{let {r,p}=getPlayer(s);if(!r||!p||r.host!==p.id||r.phase!=='lobby')return;if(r.players.length<2||!r.players.every(x=>x.ready&&x.online))throw Error('All players must be ready');r.players.forEach(x=>{x.board=board(r.mode);x.marked=r.mode==='75'?[0]:[]});r.phase='playing';r.called=[];r.turn=crypto.randomInt(r.players.length);r.paused=false;r.finalDraw=false;schedule(r)}));
 s.on('call',n=>respond(s,()=>{let {r,p}=getPlayer(s);if(!r||!p||r.mode!=='25'||r.phase!=='playing'||r.paused||r.players[r.turn]?.id!==p.id)return;n=Number(n);if(!Number.isInteger(n)||n<1||n>25||r.called.includes(n))return;callNumber(r,n)}));
 s.on('mark',n=>respond(s,()=>{let {r,p}=getPlayer(s);if(!r||!p||r.mode!=='75'||r.phase!=='playing'||r.paused)return;n=Number(n);if(!r.called.includes(n)||!p.board.includes(n))return;if(p.marked.includes(n))p.marked=p.marked.filter(x=>x!==n);else p.marked.push(n);if(!evaluate(r))send(r)}));
 s.on('continue',()=>respond(s,()=>{let {r,p}=getPlayer(s);if(!r||!p||!r.paused)return;if(!r.continueVotes.includes(p.id))r.continueVotes.push(p.id);if(r.players.every(x=>r.continueVotes.includes(x.id))){r.paused=false;r.continueVotes=[];schedule(r)}else send(r)}));
 s.on('restart',()=>respond(s,()=>{
 let {r,p}=getPlayer(s);if(!r||!p||r.phase!=='ended'||!p.online)return;
 if(!r.replayVotes.includes(p.id))r.replayVotes.push(p.id);
 if(r.players.length>=2&&r.players.every(x=>x.online&&r.replayVotes.includes(x.id)))reset(r);
 else send(r);
}));
 s.on('leave',()=>{let {r,p}=getPlayer(s);leave(r,p)});
 s.on('disconnect',()=>{let {r,p}=getPlayer(s);if(!r||!p||p.socket!==s.id)return;p.online=false;io.to(r.code).emit('notice',{type:'disconnect',name:p.name});send(r);p.grace=setTimeout(()=>{if(!p.online)leave(r,p)},30000)});
 s.on('error',()=>{});
});
server.listen(process.env.PORT||3000,()=>console.log('Bingo Party ready'));
