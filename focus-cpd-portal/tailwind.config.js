/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colours extracted from the live focusvision.com.au styles
        navy: {
          DEFAULT: '#1c2f49', // heading navy
          light: '#3b506c',   // slate-navy
          dark: '#14243a',
        },
        teal: {
          DEFAULT: '#04838c', // deep teal accent
          light: '#c2dbe3',   // light sky (light text on navy)
          dark: '#245168',    // dark teal (CTA gradient mid)
          pale: '#e9f1f4',    // pale tint of the sky blue
        },
        steel: '#3b6275',     // steel teal (icon circles on the site)
        cream: '#f4f1ed',     // warm section background
      },
      fontFamily: {
        sans: ['Poppins', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      backgroundImage: {
        // Focus Vision CTA pill gradient (sampled from the site)
        'brand-cta': 'linear-gradient(28deg, #437b8c 18%, #245168 55%, #1d3650)',
      },
    },
  },
  plugins: [],
}
