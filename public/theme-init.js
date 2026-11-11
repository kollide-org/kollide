// Apply the saved or system theme before first paint, so the page never flashes the wrong one.
// This is a separate file (not inline in index.html) so the Content-Security-Policy can forbid inline scripts.
;(function () {
  try {
    var saved = localStorage.getItem('kollide:theme')
    var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    if (dark) {
      document.documentElement.classList.add('dark')
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#1e1719')
    }
  } catch {
    // Storage is blocked: keep the default theme.
  }
})()
