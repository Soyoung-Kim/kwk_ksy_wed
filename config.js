export const APP_CONFIG = {
  siteKey: 'ksy_kwk_wed',
  supabaseUrl: 'https://kagzenniuseexohgoggv.supabase.co',
  supabasePublishableKey: 'sb_publishable_dTkmvxrDFeRSPp5keks-ag_bU15zkY3',

  weddingIso: '2026-11-08T11:30:00+09:00',
  coupleLabel: '우경 ❤ 소영',

  share: {
    kakaoJavaScriptKey: '8b93eba907a57c775af83d0da7a5bbaa',
    title: '우경 ❤ 소영 결혼합니다',
    description: '2026.11.08 SUN AM 11:30',
    imagePath: './assets/photos/main_logo.png',
    copyLink: 'https://bit.ly/wksy_wed'
  },

  guestbook: {
    table: 'guestbook_entries',
    groomName: '우경',
    brideName: '소영',
    functions: {
      create: 'guestbook-create',
      update: 'guestbook-update',
      delete: 'guestbook-delete',
      aiSuggest: 'guestbook-ai'
    }
  }
};
