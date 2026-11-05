(function (root) {
  const SEP = ' - ';

  function parse(text) {
    const clean = String(text || '').trim();
    if (!clean) return null;
    const at = clean.indexOf(SEP);
    if (at <= 0) return { clientName: null, title: clean };
    const clientName = clean.slice(0, at).trim();
    const title = clean.slice(at + SEP.length).trim();
    if (!clientName || !title) return { clientName: null, title: clean };
    return { clientName, title };
  }

  const api = { parse };
  root.App = root.App || {};
  root.App.quickadd = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
