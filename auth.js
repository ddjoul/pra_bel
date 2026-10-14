(() => {
'use strict';
const API_BASE=(window.PRA_CONFIG?.apiUrl||'').replace(/\/$/,'');
const KEY='pra_bel_token';
let cached;
const getToken=()=>localStorage.getItem(KEY);
function setToken(t){if(t)localStorage.setItem(KEY,t);else localStorage.removeItem(KEY);cached=undefined;}
if(location.hash.startsWith('#token=')){const t=decodeURIComponent(location.hash.slice(7));if(/^[0-9a-f-]{36}$/i.test(t)){setToken(t);history.replaceState(null,'',location.pathname+location.search);}}
async function api(path,opts={}){const headers={Accept:'application/json',...(opts.headers||{})};const t=getToken();if(t)headers.Authorization='Bearer '+t;let body=opts.body;if(body&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}const res=await fetch(API_BASE+path,{...opts,headers,body});const data=await res.json().catch(()=>null);if(!res.ok){const e=new Error(data?.message||data?.error||'HTTP '+res.status);e.status=res.status;throw e;}return data;}
async function me(){if(cached!==undefined)return cached;if(!getToken())return cached=null;try{return cached=await api('/api/me');}catch(e){if(e.status===401){setToken(null);cached=null;}return null;}}
window.PRA_AUTH={getToken,setToken,api,me,logout:async()=>{try{await api('/api/logout',{method:'POST'});}catch{}setToken(null);}};
const css=document.createElement('style');css.textContent=`
html[data-theme=dark]{color-scheme:dark;--white:#161719;--black:#f2f0eb;--gray:#b9b8b3;--line:rgba(220,220,215,.25)}
html[data-theme=dark] .brand img,html[data-theme=dark] .nav img,html[data-theme=dark] .auth-tg-view,html[data-theme=dark] .auth-logout img{filter:invert(1)}
html[data-theme=dark] .card:nth-child(6n+2),html[data-theme=dark] .card:nth-child(6n){--bg:#242629;--ink:#f2f0eb;--muted:#c6c5c0;--border:#46484c}
html[data-theme=dark] .card:nth-child(6n+3),html[data-theme=dark] .card:nth-child(6n+4){--bg:#35383d;--ink:#f2f0eb;--muted:#d3d2cc;--border:#55585e}
html[data-theme=dark] .comment-children,html[data-theme=dark] .comment-reply-form{border-left-color:var(--line)}
.pra-ui-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:22px 20px 0 32px}
.pra-ui-controls button{background:var(--white);color:var(--black);border:1px solid var(--line);padding:10px 12px;min-height:44px;font-size:12px}
.pra-menu-toggle{display:none}
@media(max-width:640px){
.sidebar{grid-template-columns:87px minmax(0,1fr);gap:12px 16px}
.pra-ui-controls{grid-column:1/-1;justify-content:flex-end;margin:4px 0 0}
.pra-menu-toggle{display:inline-block}
.sidebar:not(.pra-menu-open) .nav,.sidebar:not(.pra-menu-open) .auth-block{display:none}
.sidebar.pra-menu-open .nav{grid-column:1/-1;flex-direction:column;align-items:flex-start;gap:20px;margin:12px 0 0}
.sidebar.pra-menu-open .auth-block{grid-column:1/-1;align-items:flex-start;margin:16px 0 0;padding:0}
}
`;document.head.append(css);
const system=matchMedia('(prefers-color-scheme: dark)');let chosen;try{chosen=localStorage.getItem('pra_bel_theme');}catch{}
function theme(value){document.documentElement.dataset.theme=value==='dark'?'dark':'light';}
theme(chosen==='dark'||chosen==='light'?chosen:system.matches?'dark':'light');
system.addEventListener('change',e=>{if(!chosen)theme(e.matches?'dark':'light');});
function mount(){if(document.body.dataset.page==='auth'){setTimeout(()=>location.replace('index.html'),200);return;}const side=document.querySelector('.sidebar');if(!side)return;
const nav=side.querySelector('.nav');if(nav&&!nav.id)nav.id='pra-navigation';
const controls=document.createElement('div');controls.className='pra-ui-controls';
const toggle=document.createElement('button');toggle.type='button';toggle.className='pra-menu-toggle';toggle.textContent='☰ меню';toggle.setAttribute('aria-expanded','false');if(nav)toggle.setAttribute('aria-controls',nav.id);
function close(){side.classList.remove('pra-menu-open');toggle.setAttribute('aria-expanded','false');toggle.textContent='☰ меню';}
toggle.addEventListener('click',()=>{const open=side.classList.toggle('pra-menu-open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'× закрыць':'☰ меню';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&side.classList.contains('pra-menu-open')){close();toggle.focus();}});
nav?.addEventListener('click',e=>{if(e.target.closest('a'))close();});
const themeBtn=document.createElement('button');themeBtn.type='button';
function label(){const dark=document.documentElement.dataset.theme==='dark';themeBtn.textContent=dark?'светлая тэма':'цёмная тэма';themeBtn.setAttribute('aria-label',dark?'уключыць светлую тэму':'уключыць цёмную тэму');}
label();themeBtn.addEventListener('click',()=>{chosen=document.documentElement.dataset.theme==='dark'?'light':'dark';theme(chosen);try{localStorage.setItem('pra_bel_theme',chosen);}catch{}label();});controls.append(toggle,themeBtn);side.append(controls);
const block=document.createElement('div');block.className='auth-block';const bottom=side.querySelector('.corner-bottom');side.insertBefore(block,bottom);fill(block);}
async function fill(block){const u=await me();block.replaceChildren();if(!u){if(!API_BASE){const note=document.createElement('span');note.textContent='уваход часова недаступны';block.append(note);return;}const wrap=document.createElement('div');wrap.className='auth-tg-wrap';const view=document.createElement('img');view.className='auth-tg-view';view.src='images/tg-login.svg';view.alt='увайсці праз Telegram';wrap.append(view);const s=document.createElement('script');s.async=true;s.src='https://telegram.org/js/telegram-widget.js?22';s.setAttribute('data-telegram-login','pra_bel_bot');s.setAttribute('data-size','medium');s.setAttribute('data-userpic','false');s.setAttribute('data-radius','8');s.setAttribute('data-request-access','write');s.setAttribute('data-auth-url',API_BASE+'/api/tg/callback');wrap.append(s);block.append(wrap);return;}
const hello=document.createElement('div');hello.className='auth-hello';hello.textContent=u.display_name||String(u.telegram_id||'');const out=document.createElement('button');out.type='button';out.className='auth-logout';const img=document.createElement('img');img.src='images/logout.svg';img.alt='выйсці';out.append(img);out.addEventListener('click',async()=>{await window.PRA_AUTH.logout();await fill(block);if(document.body.dataset.page==='post')location.reload();});block.append(hello,out);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
