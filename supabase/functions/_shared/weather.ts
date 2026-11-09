export function wmo(code: number, language = 'en'): string {
  const key = code === 0 ? 0 : code <= 3 ? 1 : code <= 48 ? 2 : code <= 67 ? 3 : code <= 77 ? 4 : code <= 86 ? 5 : 6;
  const phrases = {
    en: ['Clear', 'Partly cloudy', 'Fog', 'Rain', 'Snow', 'Showers', 'Thunderstorms'],
    ko: ['맑음', '구름 조금', '안개', '비', '눈', '소나기', '뇌우'],
    bn: ['পরিষ্কার', 'আংশিক মেঘলা', 'কুয়াশা', 'বৃষ্টি', 'তুষারপাত', 'বৃষ্টি', 'বজ্রঝড়'],
  };
  return (phrases[language as keyof typeof phrases] ?? phrases.en)[key];
}
export function advice(min: number, max: number, rain: number, wind: number, uv: number, code: number, prefs: Record<string, boolean>, language = 'en'): string {
  const bn = language === 'bn'; const ko = language === 'ko';
  const tips: string[] = [];
  if (prefs.rain && (rain >= 50 || code >= 51 && code <= 82)) tips.push(bn ? 'ছাতা সঙ্গে নিন।' : ko ? '외출할 때 우산을 챙기세요.' : 'Take an umbrella.');
  if (prefs.cold && min <= 2) tips.push(bn ? 'ঠান্ডা থাকবে, গরম পোশাক পরুন।' : ko ? '추운 날씨이니 따뜻한 옷을 입으세요.' : 'Wear a warm jacket because it will be cold.');
  if (prefs.heat && max >= 30) tips.push(bn ? 'পর্যাপ্ত পানি পান করুন এবং ছায়ায় বিশ্রাম নিন।' : ko ? '물을 자주 마시고 그늘에서 쉬세요.' : 'Stay hydrated and take breaks in the shade.');
  if (prefs.severe && (wind >= 45 || code >= 95)) tips.push(bn ? 'বাইরে সতর্ক থাকুন এবং স্থানীয় সতর্কতা দেখুন।' : ko ? '야외 활동에 주의하고 지역 특보를 확인하세요.' : 'Take care outdoors and check local advisories.');
  if (uv >= 6) tips.push(bn ? 'দুপুরে সূর্যরশ্মি থেকে সুরক্ষা নিন।' : ko ? '한낮에는 자외선 차단에 신경 쓰세요.' : 'Use sun protection around midday.');
  if (code >= 71 && code <= 86) tips.push(bn ? 'তুষার বা বরফে চলাচলে অতিরিক্ত সময় রাখুন।' : ko ? '눈이나 빙판길 이동 시 여유를 두세요.' : 'Allow extra time for snowy or icy travel.');
  return tips.length ? tips.join(' ') : bn ? 'দিনটি সুন্দর কাটুক। বাইরে যাওয়ার আগে পূর্বাভাস দেখে নিন।' : ko ? '좋은 하루 보내세요. 외출 전에 예보를 확인하세요.' : 'Have a lovely day, and check the forecast before heading out.';
}
