// HearS site search (no dependencies): live results in the header + full
// results on the search page. Data comes from assets/search-index.json,
// generated from every real page on the site (redirects and 404 excluded).
// Matching is diacritic-insensitive, so "can thuy tinh" finds "cân thủy tĩnh",
// and substring matching keeps Chinese / Japanese queries working too.
(function () {
  'use strict';

  var form = document.querySelector('.site-search');
  if (!form) return;
  var input = form.querySelector('.site-search__input');
  var resultsBox = form.querySelector('.site-search__results');
  var indexUrl = form.getAttribute('data-index');
  // Site root, relative to this page (e.g. '' on the home page,
  // '../../../' on a deep page). Index URLs are site-root-relative, so
  // result links work both at hears.vn/ and under vinhhsk.io.vn/hears/.
  var siteBase = indexUrl.replace(/assets\/search-index\.json$/, '');
  function pageHref(p) { return siteBase + (p.url || ''); }
  var lang = (form.getAttribute('data-lang') || document.documentElement.lang || 'en').toLowerCase();
  var pageLang = lang.indexOf('zh') === 0 ? 'zh-CN' : lang.slice(0, 2);
  var isSearchPage = document.body.classList.contains('search-page');
  var indexPromise = null;

  var UI = {
    en: { placeholder: 'Search…', resultsFor: 'results for', noResults: 'No results found. Try a different word, for example “tank scale” or “heat shrink”.', allResults: 'See all results', otherLang: 'Other languages' },
    vi: { placeholder: 'Tìm kiếm…', resultsFor: 'kết quả cho', noResults: 'Không tìm thấy kết quả. Thử từ khác, ví dụ “cân bồn” hoặc “ống co nhiệt”.', allResults: 'Xem tất cả kết quả', otherLang: 'Ngôn ngữ khác' },
    ja: { placeholder: '検索…', resultsFor: 'の検索結果', noResults: '結果が見つかりませんでした。別の言葉でお試しください。', allResults: 'すべての結果を見る', otherLang: '他の言語' },
    zh: { placeholder: '搜索…', resultsFor: '的搜索结果', noResults: '未找到结果。请尝试其他词语，例如“罐秤”或“热缩管”。', allResults: '查看全部结果', otherLang: '其他语言' }
  };
  var ui = UI[pageLang] || UI.en;
  if (input && !input.getAttribute('placeholder')) input.setAttribute('placeholder', ui.placeholder);

  function fold(s) {
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }
  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(indexUrl).then(function (r) {
        if (!r.ok) throw new Error('search index not found');
        return r.json();
      }).then(function (data) {
        return data.map(function (p) {
          p._title = fold(p.title + ' ' + (p.h1 || ''));
          p._text = fold((p.title || '') + ' ' + (p.h1 || '') + ' ' + (p.headings || []).join(' ') + ' ' + (p.description || '') + ' ' + (p.text || ''));
          p._desc = fold(p.description || '');
          return p;
        });
      }).catch(function () { return []; });
    }
    return indexPromise;
  }

  function search(query, entries) {
    var q = fold(query.trim());
    if (!q) return [];
    var tokens = q.split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    var scored = [];
    entries.forEach(function (p) {
      var score = 0;
      var matched = true;
      tokens.forEach(function (t) {
        if (p._title.indexOf(t) !== -1) score += 10;
        else if (p._desc.indexOf(t) !== -1) score += 4;
        else if (p._text.indexOf(t) !== -1) score += 1;
        else matched = false;
      });
      if (!matched) return;
      if (p.lang === pageLang || (pageLang === 'zh' && p.lang === 'zh-CN') || (pageLang === 'en' && p.lang === 'en')) score += 5;
      scored.push({ page: p, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.page; });
  }

  function highlight(text, query) {
    var safe = escapeHtml(text);
    var q = query.trim();
    if (!q) return safe;
    var parts = q.split(/\s+/).filter(Boolean);
    parts.forEach(function (part) {
      var re = new RegExp('(' + part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      safe = safe.replace(re, '<mark>$1</mark>');
    });
    return safe;
  }

  function langLabel(code) {
    return { en: 'EN', vi: 'VI', 'zh-CN': '中文', ja: '日本語' }[code] || code.toUpperCase();
  }

  function hideResults() { if (resultsBox) resultsBox.hidden = true; }

  function renderDropdown(query, matches) {
    if (!resultsBox) return;
    var same = matches.filter(function (p) { return p.lang === pageLang || (pageLang === 'zh' && p.lang === 'zh-CN'); });
    var shown = (same.length ? same : matches).slice(0, 8);
    var html = '';
    if (!matches.length) {
      html = '<li class="site-search__empty">' + escapeHtml(ui.noResults) + '</li>';
    } else {
      shown.forEach(function (p) {
        html += '<li class="site-search__result"><a href="' + escapeHtml(pageHref(p)) + '">' +
          '<span class="site-search__title">' + highlight(p.title, query) + '</span>' +
          (p.description ? '<span class="site-search__snippet">' + highlight(p.description.slice(0, 140), query) + '</span>' : '') +
          '<span class="site-search__lang">' + escapeHtml(langLabel(p.lang)) + '</span></a></li>';
      });
      if (matches.length > shown.length) {
        html += '<li class="site-search__result site-search__more"><a href="' + escapeHtml(form.getAttribute('action') + '?q=' + encodeURIComponent(query)) + '">' + escapeHtml(ui.allResults) + ' (' + matches.length + ')</a></li>';
      }
    }
    resultsBox.innerHTML = html;
    resultsBox.hidden = false;
  }

  var debounce = null;
  function onInput() {
    var q = input.value;
    clearTimeout(debounce);
    if (q.trim().length < 2) { hideResults(); return; }
    debounce = setTimeout(function () {
      loadIndex().then(function (entries) { renderDropdown(q, search(q, entries)); });
    }, 150);
  }

  if (input && resultsBox) {
    input.addEventListener('input', onInput);
    input.addEventListener('focus', function () { if (input.value.trim().length >= 2) onInput(); });
    document.addEventListener('click', function (e) { if (!form.contains(e.target)) hideResults(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hideResults(); input.blur(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        var links = resultsBox.querySelectorAll('a');
        if (!links.length) return;
        e.preventDefault();
        var i = Array.prototype.indexOf.call(links, document.activeElement);
        var next = e.key === 'ArrowDown' ? (i + 1) % links.length : (i <= 0 ? links.length - 1 : i - 1);
        links[next].focus();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
        e.preventDefault(); input.focus();
      }
    });
  }

  // Full results page: ?q=... renders every match, same-language first.
  var pageList = document.getElementById('search-results');
  if (isSearchPage && pageList) {
    var params = new URLSearchParams(window.location.search);
    var q = params.get('q') || '';
    var pageInput = document.getElementById('search-page-input');
    if (pageInput) pageInput.value = q;
    var countEl = document.getElementById('search-count');
    if (q.trim().length < 2) {
      if (countEl) countEl.textContent = '';
      return;
    }
    loadIndex().then(function (entries) {
      var matches = search(q, entries);
      var same = matches.filter(function (p) { return p.lang === pageLang || (pageLang === 'zh' && p.lang === 'zh-CN'); });
      var other = matches.filter(function (p) { return same.indexOf(p) === -1; });
      var ordered = same.concat(other);
      if (countEl) countEl.textContent = ordered.length ? (ordered.length + ' ' + ui.resultsFor + ' “' + q + '”') : ui.noResults;
      var html = '';
      ordered.slice(0, 50).forEach(function (p) {
        html += '<li class="search-page__result"><h2><a href="' + escapeHtml(pageHref(p)) + '">' + highlight(p.title, q) + '</a></h2>' +
          (p.description ? '<p>' + highlight(p.description.slice(0, 220), q) + '</p>' : '') +
          '<p class="search-page__url">' + escapeHtml('/' + p.url) + ' · ' + escapeHtml(langLabel(p.lang)) + '</p></li>';
      });
      pageList.innerHTML = html;
    });
  }
})();
