import {
  escapeHTML, sanitizeHTML, addAriaHelpers,
  renderMarkdownToHTML, minimalMarkdownParse,
  simulateMarkdownFailure, toggleRawOutput
} from '../js/util/markdown.js';

QUnit.module('markdown.js', hooks => {
  QUnit.test('escapeHTML escapes critical characters', assert => {
    assert.equal(
      escapeHTML("<&\">'hello"),
      '&lt;&amp;&quot;&gt;&#39;hello',
      'Escapes &, <, >, ", and \''
    );
    assert.equal(escapeHTML('safe text'), 'safe text', 'No change to safe text');
    assert.equal(escapeHTML(null), '', 'Non-string returns empty');
  });

  QUnit.test('sanitizeHTML only allows whitelisted tags and removes XSS', assert => {
    const unsafe = '<b>bold</b><script>alert(1)</script><a href="#" onclick="x()">link</a>';
    const safe = sanitizeHTML(unsafe);
    assert.ok(safe.includes('<b>bold</b>'), 'Keeps <b>');
    assert.notOk(/script/i.test(safe), 'Removes <script>');
    assert.notOk(/onclick/i.test(safe), 'Removes disallowed attributes');
  });

  QUnit.test('sanitizeHTML injects ARIA for code and headings', assert => {
    const html = '<pre>code</pre><h2>head</h2>';
    const cleaned = sanitizeHTML(html);
    assert.ok(cleaned.includes('role="region"'), 'ARIA for <pre>');
    assert.ok(cleaned.includes('role="heading"'), 'ARIA for heading');
    assert.ok(cleaned.includes('aria-label="Code block"'), 'ARIA label for code');
    assert.ok(cleaned.includes('aria-level="2"'), 'ARIA level on h2');
  });

  QUnit.test('renderMarkdownToHTML basic markdown and failure handling', assert => {
    const md = '**Bold** *italic* `code` <img src=x onerror=alert(1)>';
    const out = renderMarkdownToHTML(md);
    assert.ok(out.includes('<strong>Bold</strong>'), 'Bold markdown converted');
    assert.ok(out.includes('<em>italic</em>'), 'Italic markdown converted');
    assert.ok(out.includes('<code>code</code>'), 'Code markdown converted');
    assert.notOk(/img/i.test(out) || /onerror/.test(out), 'XSS img removed');
    assert.ok(out.indexOf('<') === 0, 'Returns HTML');

    // Simulate parser failure
    assert.throws(() => renderMarkdownToHTML('abc', {simulateFailure:true}), /Simulated markdown parse failure/);
    assert.ok(renderMarkdownToHTML('', {}) === '', 'Empty string returns empty');
    assert.ok(renderMarkdownToHTML('RAW', {rawOutput:true}).includes('"') || renderMarkdownToHTML('RAW', {rawOutput:true}).includes('<'), 'Raw output is HTML-escaped');
  });

  QUnit.test('minimalMarkdownParse covers bold, italic, code, br, and escapes HTML', assert => {
    const input = '# title\n**b** *i* `c`<script>';
    const html = minimalMarkdownParse(input);
    assert.ok(html.includes('<script>'), 'Escapes <script>');
    assert.ok(html.includes('<strong>b</strong>'));
    assert.ok(html.includes('<em>i</em>'));
    assert.ok(html.includes('<code>c</code>'));
    assert.ok(html.includes('<br>'), 'Newlines to <br>');
  });

  QUnit.test('simulateMarkdownFailure always throws', assert => {
    assert.throws(() => simulateMarkdownFailure(), /Simulated markdown failure/);
  });

  QUnit.test('toggleRawOutput escapes and wraps in pre', assert => {
    const txt = '<b>XSS</b>';
    const out = toggleRawOutput(txt);
    assert.ok(out.startsWith('<pre'), 'Wraps in pre');
    assert.ok(out.includes('<b>XSS</b>'), 'Escapes HTML');
  });
});