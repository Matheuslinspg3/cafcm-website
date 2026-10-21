import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../404.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const cloudflare = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');

function fallbackFor(pathname) {
  let redirect = null;
  runInNewContext(script, {
    window: { location: { pathname, replace: (url) => { redirect = url; } } },
  });
  return redirect;
}

test('404 leva caminhos inexistentes à página inicial', () => {
  assert.ok(script, 'a página 404 deve ter uma rotina de redirecionamento');
  for (const pathname of ['/nao-existe', '/qualquer/coisa', '/abc123', '/404.html']) {
    assert.equal(fallbackFor(pathname), '/');
  }
});

test('atalho /contato leva à seção de contato', () => {
  for (const pathname of ['/contato', '/contato/', '/CONTATO/']) {
    assert.equal(fallbackFor(pathname), '/#contato');
  }
});

test('fallback funciona sem JavaScript e sem criar loop', () => {
  assert.match(html, /<noscript><meta http-equiv="refresh" content="0; url=\/">/);
  assert.equal(fallbackFor('/'), '/');
});

test('Vercel preserva as funções e redireciona só /contato', () => {
  assert.deepEqual(config.functions['api/**/*.js'], { memory: 1024, maxDuration: 10 });
  assert.deepEqual(config.redirects.map(({ source, destination }) => [source, destination]), [
    ['/contato', '/#contato'], ['/contato/', '/#contato'],
  ]);
  assert.equal(config.redirects.some(({ source }) => source.includes('*')), false);
});

test('Cloudflare não inclui redirecionamento genérico que afete imagens e APIs', () => {
  const rules = cloudflare.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  assert.deepEqual(rules, ['/contato /#contato 302', '/contato/ /#contato 302']);
});
