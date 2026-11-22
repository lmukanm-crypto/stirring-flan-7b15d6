import { getStore } from '@netlify/blobs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store'}
});
const error = (message, status = 400) => json({error: message}, status);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const KEY = ['violation','violation','violation','legal','legal','legal'];

// Netlify Functions API v2: a default-exported handler enables automatic Blobs context.
export default async function handler(request, context) {
  try {
    const store = getStore({name: 'quqyqtyq-results', consistency: 'strong'});
    const pathname = new URL(request.url).pathname;
    const route = pathname.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '') || '/state';
    const settings = await store.get('settings', {type: 'json'}) || {session: 1};
    if (route === '/state' && request.method === 'GET') {
      const results = await store.list({prefix: `student-${settings.session}-`});
      const students = await Promise.all(results.blobs.map(item => store.get(item.key, {type: 'json'})));
      return json({session: settings.session, students: students.filter(Boolean).sort((a,b) => a.joined - b.joined).map(({joined, ...other}) => other)});
    }
    if (request.method !== 'POST') return error('Сұраныс табылмады', 404);
    const data = await request.json();
    if (route === '/join') {
      const name = clean(data.name, 60).replace(/\s+/g, ' ');
      if (name.length < 2) return error('Атыңызды енгізіңіз');
      const id = crypto.randomUUID();
      await store.setJSON(`student-${settings.session}-${id}`, {id, name, joined: Date.now(), finished: false});
      return json({id, session: settings.session});
    }
    if (route === '/submit') {
      const {id, session, answers} = data;
      const conclusion = clean(data.conclusion, 240);
      const reflectionChoice = clean(data.reflectionChoice, 100);
      const reflectionText = clean(data.reflectionText, 240);
      if (session !== settings.session) return error('Мұғалім ойынды қайта бастады. Бетті жаңартыңыз.', 409);
      if (!Array.isArray(answers) || answers.length !== 6 || answers.some(x => !['violation','legal'].includes(x)) || conclusion.length < 5 || !reflectionChoice || reflectionText.length < 5) return error('Барлық тапсырманы орындаңыз');
      const key = `student-${session}-${clean(id, 80)}`;
      const student = await store.get(key, {type: 'json'});
      if (!student) return error('Оқушы табылмады', 404);
      const score = answers.reduce((sum, choice, i) => sum + Number(choice === KEY[i]), 0);
      await store.setJSON(key, {...student, finished: true, score, conclusion, reflectionChoice, reflectionText});
      return json({ok: true, score});
    }
    if (route === '/reset') {
      const pin = process.env.ADMIN_PIN;
      if (!pin) return error('Мұғалімнің PIN коды Netlify жүйесінде орнатылмаған.', 503);
      if (data.pin !== pin) return error('PIN қате', 403);
      await store.setJSON('settings', {session: settings.session + 1});
      return json({ok: true});
    }
    return error('Сұраныс табылмады', 404);
  } catch (err) {
    console.error(err);
    return error('Сервер қатесі: ' + String(err.message || err), 500);
  }
}
