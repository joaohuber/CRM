/*!
 * CRM WhatsApp - tracker
 * <script src="https://SEU-CRM/tracker.js" data-message="Olá! Vim pelo site." defer></script>
 *
 * 1. Guarda UTMs, GCLID, GBRAID, WBRAID e FBCLID da visita (90 dias).
 * 2. Preenche campos com esses nomes nos formulários (e cria ocultos em <form data-crm>).
 * 3. Nos links wa.me / api.whatsapp.com adiciona um código [#XXXXXX] à mensagem
 *    e registra o clique no CRM, para ligar a conversa ao anúncio.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var origin = script && script.src ? new URL(script.src).origin : "";
  var endpoint = (script && script.getAttribute("data-endpoint")) || origin + "/api/track";
  var defaultMessage = (script && script.getAttribute("data-message")) || "Olá! Vim pelo site.";

  var STORAGE_KEY = "crm_attr";
  var TTL = 90 * 24 * 60 * 60 * 1000;
  var URL_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid", "fbclid"];
  var ALL_FIELDS = URL_FIELDS.concat(["landing_page", "referrer"]);

  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && saved.exp > Date.now()) return saved.data;
    } catch (e) {}
    return null;
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ exp: Date.now() + TTL, data: data }));
    } catch (e) {}
  }

  // Visita nova com parâmetros de campanha substitui a anterior (último clique pago).
  // Visita sem parâmetros não apaga a origem já guardada.
  var params = new URLSearchParams(location.search);
  var fromUrl = {};
  var hasCampaign = false;
  URL_FIELDS.forEach(function (field) {
    var value = params.get(field);
    if (value) {
      fromUrl[field] = value;
      hasCampaign = true;
    }
  });

  var attribution = load();
  if (hasCampaign || !attribution) {
    attribution = fromUrl;
    attribution.landing_page = location.href.slice(0, 1000);
    if (document.referrer) attribution.referrer = document.referrer.slice(0, 1000);
    save(attribution);
  }

  function fillForms() {
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      var form = forms[i];
      var auto = form.hasAttribute("data-crm");
      ALL_FIELDS.forEach(function (field) {
        var value = attribution[field];
        if (!value) return;
        var input =
          form.querySelector('[name="' + field + '"]') ||
          form.querySelector('[name="form_fields[' + field + ']"]');
        if (!input && auto) {
          input = document.createElement("input");
          input.type = "hidden";
          input.name = field;
          form.appendChild(input);
        }
        if (input && !input.value) input.value = value;
      });
    }
  }

  function getRef() {
    try {
      var existing = sessionStorage.getItem("crm_ref");
      if (existing) return existing;
    } catch (e) {}
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var bytes = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var ref = "";
    for (var i = 0; i < 6; i++) ref += chars[bytes[i] % chars.length];
    try {
      sessionStorage.setItem("crm_ref", ref);
    } catch (e) {}
    return ref;
  }

  function sendClick(ref) {
    var payload = { ref: ref };
    ALL_FIELDS.forEach(function (field) {
      if (attribution[field]) payload[field] = attribution[field];
    });
    var body = JSON.stringify(payload);
    // text/plain evita preflight de CORS e o beacon sobrevive à troca de página
    var sent = false;
    try {
      sent = navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }));
    } catch (e) {}
    if (!sent) {
      try {
        fetch(endpoint, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
      } catch (e) {}
    }
  }

  function isWhatsapp(url) {
    return (
      url.protocol === "whatsapp:" ||
      /(^|\.)wa\.me$/.test(url.hostname) ||
      /(^|\.)whatsapp\.com$/.test(url.hostname)
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      var link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) return;
      var url;
      try {
        url = new URL(link.href, location.href);
      } catch (e) {
        return;
      }
      if (!isWhatsapp(url)) return;

      var ref = getRef();
      var text = url.searchParams.get("text") || defaultMessage;
      if (text.indexOf("[#") === -1) text += " [#" + ref + "]";
      url.searchParams.set("text", text);
      link.href = url.toString();
      sendClick(ref);
    },
    true
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillForms);
  } else {
    fillForms();
  }
  // Formulários carregados depois (popups, builders)
  setTimeout(fillForms, 2000);

  window.CRMTracker = { attribution: attribution, ref: getRef, fillForms: fillForms };
})();
