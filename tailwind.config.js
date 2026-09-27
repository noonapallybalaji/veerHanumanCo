/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Charcoal — primary dark surfaces and text
        charcoal: {
          DEFAULT: '#1B1917',
          900: '#141211',
          800: '#26221F',
          700: '#332E29',
          600: '#4A443D',
        },
        // Warm off-white — page background
        cream: {
          DEFAULT: '#FAF6F0',
          100: '#FDFBF8',
          200: '#F3EDE3',
          300: '#EAE2D6',
        },
        // Concrete grey — borders, muted text, neutral panels
        concrete: {
          DEFAULT: '#8C857D',
          700: '#6E6862',
          400: '#B4ACA2',
          300: '#CFC7BC',
          200: '#E3DCD2',
        },
        // Terracotta — brand accent (logo, eyebrows, links)
        terracotta: {
          DEFAULT: '#C0472B',
          700: '#98351E',
          600: '#A83C23',
          400: '#D46A4E',
          100: '#F6E5DF',
        },
        // Muted green — landscaping / natural contexts
        moss: {
          DEFAULT: '#3F6B4A',
          700: '#2C4E36',
          600: '#345B3E',
          400: '#628E6D',
          100: '#E4EDE5',
        },
        // Reserved exclusively for WhatsApp actions
        whatsapp: {
          DEFAULT: '#25D366',
          dark: '#1EA855',
        },
      },
      fontFamily: {
        display: ['Archivo', 'Segoe UI', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
      },
      maxWidth: {
        shell: '1240px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(27, 25, 23, 0.04), 0 8px 24px -16px rgba(27, 25, 23, 0.18)',
        lift: '0 2px 4px rgba(27, 25, 23, 0.06), 0 18px 40px -24px rgba(27, 25, 23, 0.28)',
      },
      transitionTimingFunction: {
        subtle: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}
