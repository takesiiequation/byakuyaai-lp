const THEME_INIT_SCRIPT = `(function(){
  try {
    var s = localStorage.getItem('byakuya-theme');
    var t = (s === 'light' || s === 'dark') ? s
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`;

export default function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
