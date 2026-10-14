(() => {
'use strict';
if(!window.supabase||!window.PRA_CONFIG)return;
const db=window.supabase.createClient(PRA_CONFIG.url,PRA_CONFIG.publishableKey);
const params=new URLSearchParams(location.search),page=document.body.dataset.page;
const languages={bel_classic:'бел_кл',bel_official:'бел_аф',bel_latin:'бел_лац',ru:'рус',pl:'пол',en:'англ'};
function node(tag,cls,text){const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;}
function tagLink(text,values){const a=node('a','hashtag','#'+text);a.href='tags.html?'+new URLSearchParams(values);return a;}
async function rows(build){const all=[];for(let offset=0;;offset+=500){const {data,error}=await build().range(offset,offset+499);if(error)throw error;all.push(...(data||[]));if(!data||data.length<500)return all;}}
function whenReady(selector,fn){const root=document.getElementById('detail');if(!root)return;let done=false;const observer=new MutationObserver(check);const timer=setTimeout(()=>observer.disconnect(),30000);function check(){const target=root.querySelector(selector);if(!target||done)return;done=true;observer.disconnect();clearTimeout(timer);Promise.resolve(fn(target)).catch(e=>console.error('content:',e));}observer.observe(root,{childList:true,subtree:true});check();}
const css=node('style');css.textContent='.hashtags{display:flex;flex-wrap:wrap;gap:8px 12px;margin:18px 0;font-size:13px}.hashtag{overflow-wrap:anywhere;text-underline-offset:3px}.article-layout{display:block;max-width:850px}.article-layout .work-side{margin-top:30px}.article-blocks{font-size:18px;line-height:1.75;color:var(--gray)}.article-text{white-space:pre-wrap;overflow-wrap:anywhere;margin:0 0 24px}.article-image{margin:28px 0}.article-image img{display:block;width:100%;height:auto;max-height:900px;object-fit:contain}.article-image figcaption{font-size:13px;margin-top:8px;color:var(--gray)}.tag-results{display:grid;gap:24px;max-width:900px}.tag-result{border-bottom:1px solid var(--line);padding:16px 0}.tag-result h2{margin:0 0 12px}.tag-preview{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--gray)}';document.head.append(css);
if(page==='post')whenReady('.work-body',async target=>{
 const {data:p,error}=await db.from('posts').select('id,category,body,tags,content').eq('id',params.get('id')).eq('status','published').maybeSingle();if(error)throw error;if(!p)return;
 const article=target.closest('.work');if(Array.isArray(p.tags)&&p.tags.length){const wrap=node('div','hashtags');p.tags.forEach(t=>wrap.append(tagLink(t,{tag:t})));article.append(wrap);}
 if(['poem','translation'].includes(p.category)||!Array.isArray(p.content)||!p.content.length)return;
 const blocks=node('div','article-blocks');for(const b of p.content){if(b.type==='text'&&typeof b.text==='string'){blocks.append(node('p','article-text',b.text));}else if(b.type==='image'&&typeof b.path==='string'&&/^\d+\/[0-9a-f-]{36}\/[0-9a-f-]+\.(jpg|jpeg|png|webp)$/i.test(b.path)){const fig=node('figure','article-image'),img=node('img');img.src=db.storage.from('photos').getPublicUrl(b.path).data.publicUrl;img.alt=typeof b.alt==='string'?b.alt:'';img.loading='lazy';img.decoding='async';fig.append(img);if(img.alt)fig.append(node('figcaption','',img.alt));blocks.append(fig);}}
 if(blocks.children.length){target.replaceWith(blocks);article.closest('.work-layout').classList.add('article-layout');}
});
if(page==='author')whenReady('.profile',async profile=>{
 let q=db.from('authors').select('id');q=params.has('nick')?q.eq('nickname',params.get('nick')):q.eq('id',params.get('id'));const {data:a,error}=await q.maybeSingle();if(error)throw error;if(!a)return;
 const works=await rows(()=>db.from('posts').select('id,language_code').eq('author_id',a.id).eq('status','published').order('id'));
 const codes=[...new Set(works.map(p=>p.language_code).filter(c=>languages[c]))];if(!codes.length)return;
 const wrap=node('div','hashtags');wrap.setAttribute('aria-label','мовы апублікаваных матэрыялаў');for(const code of codes)wrap.append(tagLink(languages[code],{language:code,author_id:a.id}));profile.after(wrap);
});
if(page==='tags'){
 const title=document.getElementById('page-title'),grid=document.getElementById('tag-results');const tag=params.get('tag'),language=params.get('language'),author=params.get('author_id');title.textContent=tag?'#'+tag:language&&languages[language]?'#'+languages[language]:'падборка';document.title=title.textContent+' / пра.бел';
 (async()=>{const posts=await rows(()=>{let q=db.from('posts').select('id,title,body,tags,author_id,published_at,created_at').eq('status','published');if(tag)q=q.contains('tags',[tag]);if(language)q=q.eq('language_code',language);if(author)q=q.eq('author_id',author);return q.order('id');});posts.sort((a,b)=>Date.parse(b.published_at||b.created_at)-Date.parse(a.published_at||a.created_at));grid.replaceChildren();if(!posts.length)grid.append(node('p','empty','нічога не знойдзена.'));for(const p of posts){const card=node('article','tag-result'),h=node('h2'),a=node('a','',p.title||'***');a.href='post.html?id='+encodeURIComponent(p.id);h.append(a);card.append(h,node('p','tag-preview',(p.body||'').slice(0,240)+((p.body||'').length>240?'…':'')));const tags=node('div','hashtags');(p.tags||[]).forEach(t=>tags.append(tagLink(t,{tag:t})));card.append(tags);grid.append(card);}})().catch(e=>{console.error(e);grid.replaceChildren(node('p','error','не ўдалося загрузіць падборку.'));});
}
})();
