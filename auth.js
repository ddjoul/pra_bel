(() => {
  'use strict';
  const BOT_USERNAME = 'pra_bel_bot';
  const API_BASE = (window.PRA_CONFIG && window.PRA_CONFIG.apiUrl || '').replace(/\/$/, '');
    if (!API_BASE) console.warn('PRA_CONFIG.apiUrl не задан');
  const KEY = 'pra_bel_token';

  const getToken = () => localStorage.getItem(KEY);
  const setToken = t => t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY);

  // токен из редиректа Telegram
  if (location.hash.startsWith('#token=')) {
    const t = decodeURIComponent(location.hash.slice(7));
    if (/^[0-9a-f-]{36}$/i.test(t)) {
      setToken(t);
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    const t = getToken();
    if (t) headers['Authorization'] = 'Bearer ' + t;
    let body = opts.body;
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, { ...opts, headers, body });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const e = new Error((data && (data.message || data.error)) || ('HTTP ' + res.status));
      e.status = res.status;
      throw e;
    }
    return data;
  }

  let cached = undefined;
  async function me() {
    if (cached !== undefined) return cached;
    if (!getToken()) { cached = null; return null; }
    try { cached = await api('/api/me'); }
    catch (e) { if (e.status === 401) setToken(null); cached = null; }
    return cached;
  }

  window.PRA_AUTH = {
    getToken, setToken, api, me,
    logout: async () => {
      try { await api('/api/logout', { method: 'POST' }); } catch {}
      setToken(null); cached = undefined;
    },
  };

  // ── виджет / статус в сайдбаре ──
  function mount() {
    if (document.body.dataset.page === 'auth') {
      // здесь просто перенаправляем после сохранения токена
      setTimeout(() => location.replace('index.html'), 200);
      return;
    }
    const side = document.querySelector('.sidebar');
    if (!side || side.querySelector('.auth-block')) return;
    const block = document.createElement('div');
    block.className = 'auth-block';
    const bottom = side.querySelector('.corner-bottom');
    side.insertBefore(block, bottom);
    fill(block);
  }

  async function fill(block) {
    const u = await me();
    block.replaceChildren();
    if (!u) {
      const s = document.createElement('script');
      s.async = true;
      s.src = 'https://telegram.org/js/telegram-widget.js?22';
      s.setAttribute('data-telegram-login', BOT_USERNAME);
      s.setAttribute('data-size', 'medium');
      s.setAttribute('data-userpic', 'false');
      s.setAttribute('data-radius', '8');
      s.setAttribute('data-request-access', 'write');
      s.setAttribute('data-auth-url', API_BASE + '/api/tg/callback');
      block.append(s);
      return;
    }
    const hello = document.createElement('div');
    hello.className = 'auth-hello';
    hello.textContent = 'вы: ' + (u.display_name || 'без імя');
    const out = document.createElement('button');
    out.type = 'button';
    out.className = 'auth-logout';
    out.textContent = 'выйсці';
    out.addEventListener('click', async () => {
      await window.PRA_AUTH.logout();
      cached = undefined;
      fill(block);
      if (document.body.dataset.page === 'post') location.reload();
    });
    block.append(hello, out);
  }

  if (document.readyState !== 'loading') mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();