(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const page = document.body.dataset.page;
  const cmp = new Intl.Collator('be');
  const params = new URLSearchParams(location.search);

  const labels = {
    poem: 'вершы',
    translation: 'пераклады',
    news: 'культура',
    culture: 'культура',
    language: 'культура',
    idea: 'культура'
  };

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function link(href, cls, text) {
    const a = el('a', cls, text);
    a.href = href;
    return a;
  }

  function authorUrl(a) {
    return a.nickname
      ? 'author.html?nick=' + encodeURIComponent(a.nickname)
      : 'author.html?id=' + encodeURIComponent(a.id);
  }

  function postUrl(id) {
    return 'post.html?id=' + encodeURIComponent(id);
  }

  function validId(id) {
    return typeof id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  function safeUrl(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' ? u.href : null;
    } catch {
      return null;
    }
  }

  function initials(a) {
    return (a.name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(s => s[0])
      .slice(0, 2)
      .join('');
  }

  function photo(a, cls) {
    const fallback = el(
      'div',
      cls + (cls === 'profile-photo' ? ' profile-placeholder' : ''),
      initials(a)
    );

    const url = safeUrl(a.avatar_path);
    if (!url) return fallback;

    const img = el('img', cls);
    img.src = url;
    img.alt = a.name;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.replaceWith(fallback);

    return img;
  }

  function roman(n) {
    if (!Number.isInteger(n) || n < 1 || n > 3999) {
      return String(n);
    }

    let text = '';

    for (const [v, s] of [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I']
    ]) {
      while (n >= v) {
        text += s;
        n -= v;
      }
    }

    return text;
  }

  let dateIndex = 0;

  function dateNode(value) {
    const wrap = el('span', 'date-wrap');
    if (!value) return wrap;

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return wrap;

    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();

    const plain =
      String(day).padStart(2, '0') + '.' +
      String(month).padStart(2, '0') + '.' +
      year;

    const time = el(
      'time',
      '',
      roman(day) + '.' + roman(month) + '.' + roman(year)
    );

    time.dateTime = d.toISOString();
    time.tabIndex = 0;
    time.setAttribute('aria-label', plain);

    const tip = el('span', 'date-tooltip', plain);
    tip.id = 'date-tip-' + (++dateIndex);
    tip.setAttribute('role', 'tooltip');

    time.setAttribute('aria-describedby', tip.id);

    time.addEventListener('click', () => {
      wrap.classList.toggle('is-open');
    });

    time.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrap.classList.toggle('is-open');
      }

      if (e.key === 'Escape') {
        wrap.classList.remove('is-open');
      }
    });

    time.addEventListener('blur', () => {
      wrap.classList.remove('is-open');
    });

    wrap.append(time, tip);
    return wrap;
  }

  function activate(key) {
    document.querySelectorAll('[data-nav]').forEach(a => {
      const active = a.dataset.nav === key;
      a.classList.toggle('active', active);

      if (active) {
        a.setAttribute('aria-current', 'page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }

  activate(
    page === 'author'
      ? 'authors'
      : page === 'post'
        ? null
        : page
  );

  const reduced = matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');

    if (
      !a ||
      e.defaultPrevented ||
      e.button !== 0 ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey ||
      a.target ||
      a.hasAttribute('download') ||
      reduced ||
      ('startViewTransition' in document)
    ) {
      return;
    }

    const u = new URL(a.href, location.href);

    if (
      u.origin !== location.origin ||
      !u.pathname.endsWith('.html') ||
      (
        u.pathname === location.pathname &&
        u.search === location.search
      )
    ) {
      return;
    }

    e.preventDefault();
    document.body.classList.add('leaving');

    setTimeout(() => location.assign(u.href), 150);
  });

  window.addEventListener('pageshow', () => {
    document.body.classList.remove('leaving');
  });

  if (page === '404') return;

  let db;

  try {
    if (!window.supabase || !window.PRA_CONFIG) {
      throw new Error('config.js или библиотека не загружены');
    }

    db = window.supabase.createClient(
      window.PRA_CONFIG.url,
      window.PRA_CONFIG.publishableKey
    );
  } catch (e) {
    showError($('detail') || $('grid'), e);
    return;
  }

  const authorBase =
    'id,name,bio,avatar_path,quote,instagram_url,tiktok_url,telegram_url';

  const postBase =
    'id,author_id,title,body,category,published_at,created_at,original_author,original_language';

  const literaryCategories = ['poem', 'translation'];

  let languageAvailable = true;

  async function all(makeQuery) {
    const rows = [];

    for (let start = 0; ; start += 500) {
      const { data, error } = await makeQuery()
        .range(start, start + 499);

      if (error) throw error;

      rows.push(...(data || []));

      if (!data || data.length < 500) {
        return rows;
      }
    }
  }

  async function authorsData() {
    try {
      return await all(() =>
        db.from('authors')
          .select(authorBase + ',nickname')
          .order('id')
      );
    } catch (e) {
      if (e.code === '42703' || e.code === 'PGRST204') {
        return await all(() =>
          db.from('authors')
            .select(authorBase)
            .order('id')
        );
      }

      throw e;
    }
  }

  async function postsData(configure = q => q) {
    try {
      return await all(() =>
        configure(
          db.from('posts')
            .select(postBase + ',language_code')
            .eq('status', 'published')
        ).order('id')
      );
    } catch (e) {
      if (e.code === '42703' || e.code === 'PGRST204') {
        languageAvailable = false;

        return await all(() =>
          configure(
            db.from('posts')
              .select(postBase)
              .eq('status', 'published')
          ).order('id')
        );
      }

      throw e;
    }
  }

  // Получает только записи из postsData(): уже опубликованные.
  function hasPublishedWorks(authorId, posts) {
    return posts.some(p =>
      p.author_id === authorId &&
      literaryCategories.includes(p.category)
    );
  }

  function showError(target, e) {
    console.error('пра.бел:', {
      code: e?.code,
      message: e?.message,
      details: e?.details,
      hint: e?.hint
    });

    if (target) {
      target.replaceChildren(
        el(
          'p',
          'error',
          'не ўдалося загрузіць дадзеныя. паспрабуй абнавіць старонку.'
        )
      );
    }
  }

  function notFound(target) {
    $('page-title').textContent = 'памылка';
    document.title = 'памылка / пра.бел';

    const section = el('section', 'error-page');
    const box = el('div');

    box.append(
      el('h2', '', '404'),
      el('h3', '', 'Мой родны кут, як ты змяніўся…'),
      el(
        'p',
        '',
        'А дакладней — гэты кут проста знік ці перанёсся ў іншае месца. Бывае, што блукаеш між соснаў, шукаючы патрэбны радок, а трапляеш на пустую паляну.'
      ),
      link('index.html', '', 'на галоўную →')
    );

    section.append(box);
    target.replaceChildren(section);
  }

  function postCard(p, a) {
    const card = el('article', 'card');
    const h = el('h2');

    h.append(link(postUrl(p.id), '', p.title));

    const text = p.body || '';
    const preview = literaryCategories.includes(p.category)
      ? text.split('\n').slice(0, 6).join('\n')
      : text.slice(0, 230) + (text.length > 230 ? '…' : '');

    card.append(h, el('div', 'preview', preview));

    const foot = el('div', 'card-foot');

    if (a) {
      foot.append(link(authorUrl(a), '', a.name));
    } else {
      foot.append(el('span', '', 'аўтар недаступны'));
    }

    foot.append(link(postUrl(p.id), '', 'чытаць →'));
    card.append(foot);

    return card;
  }

  function authorCard(a, count) {
    const card = el('article', 'card');
    const h = el('h2');

    h.append(link(authorUrl(a), '', a.name));

    const mini = el('div', 'author-mini');

    mini.append(
      photo(a, 'avatar-mini'),
      el(
        'div',
        'card-summary',
        (a.bio || a.quote || '').split('\n').slice(0, 3).join('\n')
      )
    );

    card.append(
      h,
      mini,
      el('p', 'author-count', 'апублікаваных матэрыялаў: ' + count),
      link(authorUrl(a), 'author-link', 'падрабязней →')
    );

    return card;
  }

  async function listing() {
    const [allAuthors, posts] = await Promise.all([
      authorsData(),
      postsData()
    ]);

    // Сохраняем всех авторов для подписей к материалам.
    const byId = new Map(allAuthors.map(a => [a.id, a]));

    // Каталог и фильтр: только авторы со стихами или переводами.
    const authors = allAuthors.filter(a =>
      hasPublishedWorks(a.id, posts)
    );

    const postCounts = new Map();

    for (const p of posts) {
      postCounts.set(
        p.author_id,
        (postCounts.get(p.author_id) || 0) + 1
      );
    }

    authors
      .slice()
      .sort((a, b) => cmp.compare(a.name, b.name))
      .forEach(a => {
        $('filter').add(new Option(a.name, a.id));
      });

    const selected = params.get('author_id') || params.get('author');

    if (selected) {
      const a = authors.find(a =>
        a.id === selected || a.name === selected
      );

      if (a) $('filter').value = a.id;
    }

    if ($('language') && !languageAvailable) {
      $('language').disabled = true;
      $('filter-hint').textContent =
        'для фільтра мовы дадай language_code у базу (language-migration.sql).';
    }

    function render() {
      const q = $('search')
        .value
        .trim()
        .toLocaleLowerCase('be');

      const grid = $('grid');
      grid.replaceChildren();

      if (page === 'authors') {
        const rows = authors
          .filter(a =>
            (a.name + ' ' + (a.bio || ''))
              .toLocaleLowerCase('be')
              .includes(q)
          )
          .sort((a, b) => cmp.compare(a.name, b.name));

        $('count').textContent = 'знойдзена: ' + rows.length;

        rows.forEach(a => {
          grid.append(
            authorCard(a, postCounts.get(a.id) || 0)
          );
        });
      } else {
        const category = $('category')?.value || '';
        const language = $('language')?.value || '';

        const rows = posts.filter(p =>
          (page !== 'poems' || p.category === 'poem') &&
          (page !== 'translations' || p.category === 'translation') &&
          (
            page !== 'culture' ||
            !literaryCategories.includes(p.category)
          ) &&
          (
            !$('filter').value ||
            p.author_id === $('filter').value
          ) &&
          (!category || p.category === category) &&
          (!language || p.language_code === language) &&
          (
            p.title + ' ' +
            (p.body || '') + ' ' +
            (byId.get(p.author_id)?.name || '')
          ).toLocaleLowerCase('be').includes(q)
        );

        rows.sort((a, b) => {
          if ($('sort').value === 'title') {
            return cmp.compare(a.title, b.title);
          }

          if ($('sort').value === 'author') {
            return cmp.compare(
              byId.get(a.author_id)?.name || '',
              byId.get(b.author_id)?.name || ''
            ) || cmp.compare(a.title, b.title);
          }

          return (
            Date.parse(b.published_at || b.created_at) || 0
          ) - (
            Date.parse(a.published_at || a.created_at) || 0
          );
        });

        $('count').textContent = 'знойдзена: ' + rows.length;

        rows.forEach(p => {
          grid.append(postCard(p, byId.get(p.author_id)));
        });
      }

      if (!grid.children.length) {
        grid.append(el('p', 'empty', 'нічога не знойдзена.'));
      }
    }

    ['search', 'filter', 'category', 'language', 'sort']
      .forEach(id => {
        $(id)?.addEventListener(
          id === 'search' ? 'input' : 'change',
          render
        );
      });

    render();
  }

  async function authorPage() {
    const target = $('detail');
    const id = params.get('id');
    const nick = params.get('nick');

    if (
      (
        nick !== null &&
        !/^[a-z0-9][a-z0-9_-]{1,39}$/.test(nick)
      ) ||
      (nick === null && !validId(id))
    ) {
      notFound(target);
      return;
    }

    const authors = await authorsData();

    const a = authors.find(a =>
      nick !== null ? a.nickname === nick : a.id === id
    );

    if (!a) {
      notFound(target);
      return;
    }

    // Проверяем произведения до отображения профиля.
    const posts = await postsData(q =>
      q.eq('author_id', a.id)
        .in('category', literaryCategories)
    );

    if (!hasPublishedWorks(a.id, posts)) {
      notFound(target);
      return;
    }

    document.title = a.name + ' / пра.бел';

    target.replaceChildren(
      link('authors.html', 'back', '< назад'),
      el('h2', 'profile-name', a.name)
    );

    const profile = el('section', 'profile');
    profile.append(photo(a, 'profile-photo'));

    const info = el('div', 'profile-info');

    if (a.bio) {
      info.append(el('p', '', a.bio));
    }

    if (a.quote) {
      info.append(el('blockquote', 'profile-quote', a.quote));
    }

    if (!a.bio && !a.quote) {
      info.append(
        el('p', '', 'інфармацыя пра аўтара хутка з’явіцца.')
      );
    }

    profile.append(info);

    const socials = el('div', 'socials');

    [
      ['tiktok', a.tiktok_url, ['tiktok.com']],
      ['instagram', a.instagram_url, ['instagram.com']],
      ['telegram', a.telegram_url, ['t.me', 'telegram.me']]
    ].forEach(([label, value, hosts]) => {
      const safe = safeUrl(value);
      if (!safe) return;

      const host = new URL(safe).hostname;

      if (!hosts.some(h => host === h || host.endsWith('.' + h))) {
        return;
      }

      const l = link(safe, '', label + ' →');
      l.target = '_blank';
      l.rel = 'noopener noreferrer';
      socials.append(l);
    });

    profile.append(socials);
    target.append(profile);

    posts.sort((a, b) =>
      (Date.parse(b.published_at || b.created_at) || 0) -
      (Date.parse(a.published_at || a.created_at) || 0)
    );

    for (const [type, label] of [
      ['poem', 'вершы'],
      ['translation', 'пераклады']
    ]) {
      const section = el('section');
      const rows = posts.filter(p => p.category === type);

      section.append(el('h3', 'profile-works-title', label));

      const grid = el('div', 'grid profile-grid');

      rows.forEach(p => {
        grid.append(postCard(p, a));
      });

      if (!rows.length) {
        grid.append(
          el('p', 'empty', 'пакуль няма апублікаваных твораў.')
        );
      }

      section.append(grid);
      target.append(section);
    }
  }

  async function postPage() {
    const target = $('detail');
    const id = params.get('id');

    if (!validId(id)) {
      notFound(target);
      return;
    }

    const { data: p, error } = await db
      .from('posts')
      .select(postBase)
      .eq('id', id)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;

    if (!p) {
      notFound(target);
      return;
    }

    const authors = await authorsData();
    const a = authors.find(a => a.id === p.author_id);
    const type = p.category;
    const literary = literaryCategories.includes(type);

    $('page-title').textContent = labels[type] || 'культура';

    activate(
      type === 'poem'
        ? 'poems'
        : type === 'translation'
          ? 'translations'
          : 'culture'
    );

    document.title = p.title + ' / пра.бел';

    target.replaceChildren(
      link(
        type === 'poem'
          ? 'poems.html'
          : type === 'translation'
            ? 'translations.html'
            : 'culture.html',
        'back',
        '< назад'
      )
    );

    const layout = el('div', 'work-layout');
    const article = el('article', 'work');
    const side = el('aside', 'work-side');

    article.append(el('h2', '', p.title));

    if (
      type === 'translation' &&
      (p.original_author || p.original_language)
    ) {
      article.append(
        el(
          'p',
          'original',
          [
            p.original_author
              ? 'аўтар арыгіналу: ' + p.original_author
              : '',
            p.original_language
              ? 'мова арыгіналу: ' + p.original_language
              : ''
          ].filter(Boolean).join(' · ')
        )
      );
    }

    article.append(
      el(
        'div',
        'work-body' + (literary ? '' : ' prose'),
        p.body || ''
      )
    );

    const meta = el('div', 'work-meta');

    if (a) {
      meta.append(
        link(
          authorUrl(a),
          '',
          (type === 'translation' ? 'пераклад: ' : '') + a.name
        )
      );
    }

    meta.append(dateNode(p.published_at || p.created_at));

    side.append(meta);
    layout.append(article, side);
    target.append(layout);

    if (literary) {
      await comments(side, p.id);
    }
  }

  async function comments(side, postId) {
    const section = el('section', 'comments');
    const head = el('h2', '', 'каментарыі: …');
    const form = el('form', 'comment-form');
    const list = el('div', 'comment-list');

    const name = el('input');
    name.name = 'display_name';
    name.placeholder = 'нік_';
    name.setAttribute('aria-label', 'нік');
    name.required = true;
    name.maxLength = 60;
    name.autocomplete = 'nickname';

    const body = el('textarea');
    body.name = 'body';
    body.placeholder = 'каментарый_';
    body.setAttribute('aria-label', 'каментарый');
    body.required = true;
    body.maxLength = 2000;

    const trap = el('input');
    trap.name = 'website';
    trap.hidden = true;
    trap.tabIndex = -1;
    trap.autocomplete = 'off';

    const submit = el('button', 'btn', 'адправіць');
    submit.type = 'submit';

    const status = el('p', 'status');
    status.setAttribute('role', 'status');

    form.append(
      name,
      body,
      trap,
      submit,
      el(
        'p',
        'form-note',
        'каментарый з’явіцца пасля мадэрацыі. імя не правяраецца.'
      ),
      status
    );

    section.append(head, form, list);
    side.append(section);

    form.addEventListener('submit', async e => {
      e.preventDefault();

      if (trap.value) return;

      const display_name = name.value.trim();
      const text = body.value.trim();

      if (!display_name || !text) {
        status.textContent = 'запоўні нік і каментарый.';
        return;
      }

      submit.disabled = true;
      status.textContent = 'адпраўляем…';

      try {
        let published = false;
        const A = window.PRA_AUTH;
        if (A && A.getToken()) {
          try {
            await A.api('/api/comments', {
              method: 'POST',
              body: { post_id: postId, display_name, body: text },
            });
            published = true;
          } catch (e) {
            if (e.status !== 401) throw e;
            A.setToken(null);
          }
        }
        if (!published) {
          const { error } = await db.from('comments').insert({
            post_id: postId, display_name, body: text,
            status: 'pending', status_id: 1,
          });
          if (error) throw error;
        }
        form.reset();
        status.textContent = published
          ? 'дзякуй! каментарый апублікаваны.'
          : 'дзякуй! каментарый адпраўлены на мадэрацыю.';
      } catch (e) {
        console.error('каментарый:', e);
        status.textContent = 'не ўдалося адправіць. паспрабуй пазней.';
      } finally {
        submit.disabled = false;
      }
    });

    try {
      const rows = await all(() =>
        db.from('comments')
          .select('id,display_name,body,created_at')
          .eq('post_id', postId)
          .eq('status', 'published')
          .order('created_at')
          .order('id')
      );

      head.textContent = 'каментарыі: ' + rows.length;

      if (!rows.length) {
        list.append(
          el(
            'p',
            'form-note',
            'пакуль няма апублікаваных каментарыяў.'
          )
        );
      }

      rows.forEach(c => {
        const item = el('article', 'comment');
        const h = el('div', 'comment-head');

        h.append(
          el('span', '', c.display_name),
          dateNode(c.created_at)
        );

        item.append(h, el('p', '', c.body));
        list.append(item);
      });
    } catch (e) {
      console.error('каментарыі:', e);
      head.textContent = 'каментарыі';

      list.append(
        el('p', 'form-note', 'не ўдалося загрузіць каментарыі.')
      );
    }
  }

  (async () => {
    try {
      if (page === 'author') {
        await authorPage();
      } else if (page === 'post') {
        await postPage();
      } else {
        await listing();
      }
    } catch (e) {
      showError($('detail') || $('grid'), e);
    }
  })();
})();
