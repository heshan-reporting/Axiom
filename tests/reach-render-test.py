#!/usr/bin/env python3
"""reach-agent.py render cases: the listing-link and article extractors mirror
the worker's, a source render job files rows and reports the probe, an article
render job writes the text back, and the failures are named."""
import os, importlib.util, io, json, sys, contextlib

spec = importlib.util.spec_from_file_location('reach_agent', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools', 'reach-agent.py'))
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

passed = failed = 0
def t(name, cond, detail=''):
    global passed, failed
    if cond: passed += 1; print('  ok   ' + name)
    else: failed += 1; print('  FAIL ' + name + (' - ' + str(detail)[:300] if detail else ''))

LISTING = '<html><body><nav><a href="/">Home</a><a href="/news">News</a></nav><main>' + ''.join(
    '<a href="https://www.guild.org.au/news/2026/09/guild-welcomes-pharmacist-prescribing-expansion-%d">Guild welcomes the expansion of pharmacist prescribing in every state number %d</a>' % (i, i) for i in range(6)) + \
    '<a href="https://www.guild.org.au/about">About us</a><a href="https://other.site/news/2026/09/a-very-long-headline-from-another-host-entirely">A very long headline from another host entirely here</a></main></body></html>'
LONG = 'Pharmacists will prescribe for more conditions from next year under changes agreed by every state and territory health minister. ' * 8
ARTICLE = '<html><head><title>Story one | Example</title><script type="application/ld+json">' + json.dumps({'@type': 'NewsArticle', 'headline': 'Story one', 'articleBody': LONG}) + '</script></head><body><p>teaser</p></body></html>'
PARAS = '<html><body><nav><a href="/">x</a></nav><article>' + ''.join('<p>Paragraph %d of an article without structured data, long enough to be counted as body text by the extractor.</p>' % i for i in range(8)) + '</article></body></html>'

print('reach-agent render cases')
links = mod.listing_links(LISTING, 'https://www.guild.org.au/news-events/news')
t('listing_links keeps the six article-shaped links on the same host', len(links) == 6 and all(l['link'].startswith('https://www.guild.org.au/news/2026/09/') for l in links), links)
t('nav, about and other-host links are dropped', not any('about' in l['link'] or 'other.site' in l['link'] for l in links))
title, text = mod.extract_article(ARTICLE)
t('extract_article reads JSON-LD articleBody and the headline', title == 'Story one' and len(text) > 600 and text.startswith('Pharmacists will prescribe'), (title, len(text)))
title2, text2 = mod.extract_article(PARAS)
t('without structured data it joins the article paragraphs', len(text2) > 600 and text2.count('\n\n') == 7, len(text2))
t('a page with nothing to read yields short text, not an exception', len(mod.extract_article('<html><body><p>hi</p></body></html>')[1]) < 10)

# the render job, with Chromium replaced by fixtures and the worker by a recorder
calls = []
def fake_http(url, key=None, body=None, timeout=60):
    calls.append((url.split('workers.dev')[-1], body))
    if url.endswith('/sources?q=guild_org'): return {'ok': True, 'sources': [{'id': 'guild_org', 'name': 'Pharmacy Guild of Australia', 'tier': 'sector', 'juris': 'au', 'urls': {'home': 'https://www.guild.org.au/news-events/news', 'site': 'guild.org.au'}}]}
    if url.endswith('/sources?q=nowhere'): return {'ok': True, 'sources': []}
    if url.endswith('/archive/add'): return {'ok': True, 'added': len(body['rows']), 'total': 100 + len(body['rows'])}
    if url.endswith('/sources/report'): return {'ok': True}
    if url.endswith('/fulltext/save'): return {'ok': True, 'id': body['id'], 'chars': len(body['text'])}
    return {'ok': True}
mod.rr.http_json = fake_http
mod.have_playwright = lambda: True
mod.render_html = lambda url, wait_ms=2500: (LISTING if 'guild' in url else ARTICLE, url)
mod.rr.ISSUES = [('pharmacy', __import__('re').compile(r'pharmac', __import__('re').I))]
log = []
r = mod.job_render('https://newsaus.heshan-998.workers.dev', 'k', {'source': 'guild_org'}, lambda k, x: log.append((k, x)))
t('a source render job files the links as news rows tagged with the source, the method and the issue', r['ok'] and r['items'] == 6 and r['added'] == 6 and r['method'] == 'render', r)
add = next(c for c in calls if c[0] == '/archive/add')
row = add[1]['rows'][0]
t('rows carry src, meta.reg, method render, via reach and the issue tag', add[1]['kind'] == 'news' and row['src'] == 'guild_org' and row['meta']['reg'] == 1 and row['meta']['method'] == 'render' and row['meta']['via'] == 'reach' and row['meta']['issues'] == ['pharmacy'], row)
rep = next(c for c in calls if c[0] == '/sources/report')
t('the probe is reported back so the registry shows render as the delivering route', rep[1]['id'] == 'guild_org' and rep[1]['ok'] and rep[1]['method'] == 'render' and rep[1]['n'] == 6 and rep[1]['added'] == 6, rep)
t('the console sees the command and the count', any(k == 'cmd' and 'chromium goto' in x for k, x in log) and any(k == 'out' and '6 article-shaped links' in x for k, x in log), log)

calls.clear(); log.clear()
r2 = mod.job_render('https://newsaus.heshan-998.workers.dev', 'k', {'url': 'https://www.example-news.com.au/story/one', 'id': 4242}, lambda k, x: log.append((k, x)))
t('an article render job reads the text and writes it back onto the row', r2['ok'] and r2['chars'] > 600 and r2['filed'] == 4242 and r2['title'] == 'Story one', r2)
sv = next(c for c in calls if c[0] == '/fulltext/save')
t('the save carries the method and the final url', sv[1]['method'] == 'render' and sv[1]['link'] == 'https://www.example-news.com.au/story/one' and len(sv[1]['text']) <= 6000, sv[1].keys())

try:
    mod.job_render('https://newsaus.heshan-998.workers.dev', 'k', {'source': 'nowhere'}, lambda k, x: None); t('an unknown source is an error', False)
except RuntimeError as e:
    t('an unknown source is an error that names it', 'nowhere' in str(e), e)
try:
    mod.job_render('https://newsaus.heshan-998.workers.dev', 'k', {}, lambda k, x: None); t('no url is an error', False)
except RuntimeError as e:
    t('no url and no source is an error', 'url or a source' in str(e), e)
mod.have_playwright = lambda: False
try:
    mod.job_render('https://newsaus.heshan-998.workers.dev', 'k', {'url': 'https://x.test/a'}, lambda k, x: None); t('missing Playwright is an error', False)
except RuntimeError as e:
    t('missing Playwright says how to install it', 'playwright install chromium' in str(e), e)
t('collectors() offers render only when Playwright imports', 'render' not in mod.collectors())
t('JOBS routes render jobs', mod.JOBS.get('render') is mod.job_render)

print('\n%d passed, %d failed' % (passed, failed))
sys.exit(1 if failed else 0)
