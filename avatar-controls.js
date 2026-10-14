(() => {
  'use strict';
  const root = document.getElementById('account-content');
  const auth = window.PRA_AUTH;
  if (!root || !auth) return;
  function mount() {
    root.querySelectorAll('.account-editor').forEach(form => {
      const preview = form.querySelector('.account-avatar');
      const existing = form.querySelector('[data-remove-avatar]');
      if (existing) {
        const hidden = !preview || preview.hidden || !preview.getAttribute('src');
        if (existing.hidden !== hidden) existing.hidden = hidden;
        const note = form.querySelector('[data-avatar-removal-note]');
        if (note && note.hidden !== hidden) note.hidden = hidden;
        return;
      }
      const view = form.querySelector('a[href*="author.html"]');
      if (!preview || !view) return;
      const id = new URL(view.href).searchParams.get('id');
      if (!id) return;
      const status = form.querySelector('.status');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn';
      button.dataset.removeAvatar = 'true';
      button.textContent = 'выдаліць аватар';
      button.hidden = preview.hidden || !preview.getAttribute('src');
      const note = document.createElement('p');
      note.className = 'form-note';
      note.dataset.avatarRemovalNote = 'true';
      note.textContent = 'аватар будзе прыбраны з профілю; сам файл застанецца ў сховішчы.';
      note.hidden = button.hidden;
      form.insertBefore(button, view);
      form.insertBefore(note, view);
      button.addEventListener('click', async () => {
        const others = [...form.querySelectorAll('button')].filter(b => b !== button);
        if (others.some(b => b.disabled)) {
          if (status) status.textContent = 'дачакайся завяршэння захавання або загрузкі.';
          return;
        }
        const name = form.querySelector('h2')?.textContent || 'аўтара';
        if (!window.confirm('Прыбраць аватар з профілю «' + name + '»?')) return;
        const states = others.map(b => [b, b.disabled]);
        button.disabled = true;
        others.forEach(b => b.disabled = true);
        if (status) status.textContent = 'прыбіраем аватар…';
        try {
          const result = await auth.api('/api/authors/' + id, {
            method: 'POST', body: {remove_avatar: true}
          });
          if (!result.author || result.author.avatar_path !== null) throw new Error('removal_not_confirmed');
          preview.hidden = true;
          preview.removeAttribute('src');
          button.hidden = true;
          note.hidden = true;
          const file = form.querySelector('input[type=file]');
          if (file) file.value = '';
          if (status) status.textContent = 'аватар прыбраны з профілю. можна загрузіць новы.';
        } catch (error) {
          console.error('avatar removal:', error);
          if (status) status.textContent = error.status === 409
            ? 'аватар змяніўся. абнаві старонку і паспрабуй яшчэ раз.'
            : error.status === 401 || error.status === 403
              ? 'патрэбны ўваход і права рэдагаваць гэты профіль.'
              : 'не ўдалося прыбраць аватар. паспрабуй пазней.';
        } finally {
          button.disabled = false;
          states.forEach(([b, disabled]) => b.disabled = disabled);
        }
      });
    });
  }
  const observer = new MutationObserver(mount);
  observer.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'src']});
  mount();
})();
