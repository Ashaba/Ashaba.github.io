(function () {
  // Respect Do Not Track preference
  if (
    window.doNotTrack === "1" ||
    navigator.doNotTrack === "1" ||
    navigator.doNotTrack === "yes" ||
    navigator.msDoNotTrack === "1"
  ) {
    return;
  }

  var meta = document.querySelector('meta[name="ga-measurement-id"]');
  if (!meta || !meta.content) return;

  var gaId = meta.content;

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("js", new Date());
  gtag("config", gaId);

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + gaId;
  document.head.appendChild(script);
})();
