(() => {
  const script = document.currentScript;
  if (!script?.src) return;
  const versionUrl = new URL('version.json', script.src);
  fetch(versionUrl, { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((release) => {
      if (!release?.version) return;
      const page = new URL(location.href);
      if (page.searchParams.get('__release') === release.version) return;
      page.searchParams.set('__release', release.version);
      location.replace(page.href);
    })
    .catch(() => {});
})();
