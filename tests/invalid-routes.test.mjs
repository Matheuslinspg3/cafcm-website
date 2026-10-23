import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8');
const config = JSON.parse(read('vercel.json'));
const rules = read('_redirects').split('\n').filter(l=>l && !l.startsWith('#'));
const expected = {"/contato":"/#contato","/contato/":"/#contato","/index.php":"/","/sobre-nos.php":"/#sobre","/cursos.php":"/#cursos","/contrate.php":"/#empresas","/inscricoes.php":"/#contato","/contato.php":"/#contato"};
test('URLs antigas têm destinos válidos e permanentes nos dois provedores',()=>{
 const ids = [...read('index.html').matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
 for(const [source,destination] of Object.entries(expected)){
  assert.deepEqual(config.redirects.find(r=>r.source===source),{source,destination,permanent:true});
  assert.ok(rules.includes(source+' '+destination+' 301'));
  if(destination.includes('#')) assert.ok(ids.includes(destination.split('#')[1]));
 }
});
test('rotas não interceptam APIs ou arquivos estáticos',()=>{
 assert.deepEqual(config.functions['api/**/*.js'],{memory:1024,maxDuration:10});
 assert.ok(config.redirects.every(r=>!r.source.includes('*') && !r.source.startsWith('/api')));
});
test('identidade pública contém URL e telefone confirmados',()=>{
 const html=read('index.html');
 assert.match(html, /rel="canonical" href="https:\/\/www.cafcm.org.br\/"/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(data.telephone,'+55-13-3395-0246');
 assert.equal(data.address.streetAddress,'Rua Fumio Miyazi, 453');
});
