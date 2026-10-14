window.PRA_CONFIG = {
  url: 'https://vqcjtkruncqslrxeekmz.supabase.co',
  publishableKey: 'sb_publishable_lMQD_C8Ti6rFzc2H5CK44A_hpYt1fuN',
  apiUrl: 'https://pra-bel-bot.onrender.com'
};
(() => {
  if (!window.supabase || window.PRA_DB_FACTORY_READY) return;
  const original = window.supabase.createClient.bind(window.supabase);
  window.supabase.createClient = function(url, key, options) {
    const config = window.PRA_CONFIG;
    if (url !== config.url || key !== config.publishableKey) return original(url, key, options);
    if (!window.PRA_DB) {
      window.PRA_DB = original(url, key, {
        ...options,
        auth: {...options?.auth, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
      });
    }
    return window.PRA_DB;
  };
  window.PRA_DB_FACTORY_READY = true;
})();
