/* Kopiere diese Datei nach config.js und trage die Werte deines Supabase-Projekts ein.
   Supabase-Dashboard → Project Settings → Data API: "Project URL";
   Project Settings → API Keys: "Publishable key" (sb_publishable_…, alter anon-Key eyJ… geht auch).
   Nie den Secret key (sb_secret_…) oder service_role-Key eintragen! Der Publishable key ist öffentlich gedacht; geschützt wird alles über die Regeln im Schema. */
window.SPRINT_CONFIG = {
  supabaseUrl: 'https://DEIN-PROJEKT.supabase.co',
  supabaseAnonKey: 'sb_publishable_…',
  // Optional: feste Adresse der Schüler-App für die QR-Codes auf den Zugangskarten
  schuelerUrl: ''
};
