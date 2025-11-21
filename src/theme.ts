// This file will hold all your consistent design styles.

// 1. Define your main colors
export const COLORS = {
  primary: '#2e7d32', // Your main green
  primaryDark: '#1b5e20',
  
  white: '#ffffff',
  black: '#000000',
  
  // Grays
  text: '#333333',     // For main titles
  textSecondary: '#555555', // For subtitles
  textLight: '#6d6d6d',   // For light descriptions
  gray: '#A9A9A9',      // For the save button
  lightGray: '#EFEFEF', // For input borders
  placeholder: '#999999',

  // Backgrounds
  background: '#f1fbf1',     // Main app background (from your screenshot)
  backgroundLight: '#f1fbf1', 
  backgroundSuccess: '#d1f7d6',

  // Other
  borderColor: '#cfe9d2',
  danger: '#d32f2f',
};

// 2. Define your spacing and sizes
export const SIZES = {
  // Global padding
  padding: 24,

  // Radii
  radius: 18,
  
  // Font sizes
  h1: 20,
  h2: 16,
  body: 15,
  caption: 13,
};

// 3. Define your font styles (optional, but very helpful)
export const FONTS = {
  h1: {
    fontSize: SIZES.h1,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  h2: {
    fontSize: SIZES.h2,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  body: {
    fontSize: SIZES.body,
    color: COLORS.textSecondary,
  },
  caption: {
    fontSize: SIZES.caption,
    color: COLORS.textLight,
  },
};

// You can also export a combined theme object
const theme = { COLORS, SIZES, FONTS };
export default theme;
