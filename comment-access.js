(() => {
  'use strict';
  if (document.body.dataset.page !== 'post' || !window.supabase || !window.PRA_CONFIG) return;
  const db = window.supabase.createClient(PRA_CONFIG.url, PRA_CONFIG.publishableKey);
  const postId = new URLSearchParams(location.search).get('id');
  const root = document.getElementById('detail');
  const note = 'каментарый можа пакінуць кожны. без уваходу — пасля мадэрацыі, без паведамленняў пра адказы ў Telegram. адказы можна чытаць тут, на сайце.';
  function notices() {
    root?.querySelectorAll('.comment-form .form-note').forEach(n => {
      if (n.textContent !== note) n.textContent = note;
    });
  }
  if (root) new MutationObserver(notices).observe(root, {childList: true, subtree: true});
  notices();
  async function parentFor(form) {
    if (!form.classList.contains('comment-form-reply')) return null;
    const parent = form.closest('.comment');
    const name = parent?.querySelector(':scope > .comment-head > span')?.textContent;
    const body = parent?.querySelector(':scope > p')?.textContent;
    const time = parent?.querySelector(':scope > .comment-head time')?.dateTime;
    if (!name || !body || !time) throw new Error('parent_not_found');
    const end = new Date(Date.parse(time) + 1).toISOString();
    const {data, error} = await db.from('comments').select('id')
      .eq('post_id', postId).eq('status', 'published').is('parent_id', null)
      .eq('display_name', name).eq('body', body).gte('created_at', time).lt('created_at', end).limit(2);
    if (error) throw error;
    if (!data || data.length !== 1) throw new Error('parent_not_found');
    return data[0].id;
  }
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('comment-form') || !root?.contains(form)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (form.dataset.sending === 'true' || form.elements.namedItem('website')?.value) return;
    const name = form.elements.namedItem('display_name');
    const body = form.elements.namedItem('body');
    const status = form.querySelector('.status');
    const submit = form.querySelector('button[type=submit]');
    if (!name || !body || !status || !submit) return;
    const displayName = name.value.trim(), text = body.value.trim();
    if (!displayName || !text || displayName.length > 60 || text.length > 2000) {
      status.textContent = 'запоўні нік і каментарый: да 60 і 2000 знакаў адпаведна.';
      return;
    }
    form.dataset.sending = 'true';
    submit.disabled = true;
    status.textContent = 'адпраўляем…';
    try {
      const parentId = await parentFor(form);
      const payload = {post_id: postId, parent_id: parentId, display_name: displayName, body: text};
      let published = false;
      const auth = window.PRA_AUTH;
      if (auth?.getToken()) {
        try {
          await auth.api('/api/comments', {method: 'POST', body: payload});
          published = true;
        } catch (error) {
          if (error.status === 401) auth.setToken(null);
          else if (error.status !== 403) throw error;
        }
      }
      if (!published) {
        const {data: pending, error: lookupError} = await db.from('comment_statuses').select('id').eq('code', 'pending').single();
        if (lookupError) throw lookupError;
        const {error} = await db.from('comments').insert({...payload, status: 'pending', status_id: pending.id});
        if (error) throw error;
      }
      form.reset();
      status.textContent = published
        ? 'дзякуй! каментарый апублікаваны. абнаві старонку, каб убачыць яго.'
        : 'дзякуй! каментарый адпраўлены на мадэрацыю. паведамленне пра адказ у Telegram не прыйдзе — правярай адказы на гэтай старонцы.';
    } catch (error) {
      console.error('comment submission:', error);
      status.textContent = error.status === 429
        ? 'зачакаліся частыя паведамленні. пачакай крыху перад наступным каментарыем.'
        : error.message === 'parent_not_found'
          ? 'не ўдалося вызначыць каментарый для адказу. абнаві старонку.'
          : 'не ўдалося адправіць каментарый. паспрабуй пазней; рэгістрацыя для адпраўкі не патрэбная.';
    } finally {
      form.dataset.sending = 'false';
      submit.disabled = false;
    }
  }, true);
})();
