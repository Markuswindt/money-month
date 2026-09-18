export default {
  plugins: {
    // Macht @custom-media aus custom-media.css in jeder Datei bekannt, die
    // dieser Prozess einzeln durchlaeuft - noetig, weil Vite CSS-Module
    // getrennt verarbeitet und @media (--desktop) sonst nur in der Datei
    // aufgeloest wuerde, die die Definition selbst per @import einbindet.
    '@csstools/postcss-global-data': {
      files: ['src/styles/custom-media.css'],
    },
    'postcss-custom-media': {},
  },
};
