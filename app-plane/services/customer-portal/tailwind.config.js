/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'sm': '640px',      // Mobile landscape
        'md': '768px',      // Tablet portrait (iPad Mini)
        'lg': '1024px',     // Tablet landscape (iPad Pro 11")
        'xl': '1280px',     // Desktop / iPad Pro 12.9" landscape
        '2xl': '1536px',    // Large desktop
        // Custom tablet breakpoints
        'tablet': '768px',
        'tablet-lg': '1024px',
      },
      spacing: {
        // Touch-friendly spacing
        'touch-sm': '44px',  // Minimum iOS guideline
        'touch': '48px',     // Recommended minimum
        'touch-lg': '56px',  // Comfortable touch target
      },
      minHeight: {
        'touch-sm': '44px',
        'touch': '48px',
        'touch-lg': '56px',
      },
      minWidth: {
        'touch-sm': '44px',
        'touch': '48px',
        'touch-lg': '56px',
      },
    },
  },
  plugins: [],
}
