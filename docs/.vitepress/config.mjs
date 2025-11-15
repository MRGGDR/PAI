import { defineConfig } from 'vitepress';
import { resolve } from 'path';
import include from 'markdown-it-include';

export default defineConfig({
  lang: 'es-CO',
  title: 'PAI — Documentación Modular',
  description: 'Guía técnica del Aplicativo Modular Web PAI 2025',
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    config: (md) => {
      md.use(include, {
        root: resolve(__dirname, '../../'),
        includeRe: /@\[include\]\s*(\(.+?\))/i
      });
    }
  },
  themeConfig: {
    nav: [
      { text: 'Inicio', link: '/' },
      { text: 'Frontend', link: '/frontend/pages' },
      { text: 'Backend', link: '/backend/apps-script' },
      { text: 'Referencias', link: '/reference/changelog' }
    ],
    sidebar: {
      '/frontend/': [
        {
          text: 'Frontend',
          items: [
            { text: 'Páginas HTML', link: '/frontend/pages' },
            { text: 'Scripts por página', link: '/frontend/page-scripts' },
            { text: 'Módulo Actividades', link: '/frontend/actividades' },
            { text: 'Actividades Manager', link: '/frontend/actividades-manager' },
            { text: 'Módulo Admin', link: '/frontend/admin' },
            { text: 'Admin Manager', link: '/frontend/admin-manager' },
            { text: 'Módulo Avances', link: '/frontend/avances' },
            { text: 'Biblioteca Lib', link: '/frontend/lib' },
            { text: 'Activos públicos', link: '/frontend/public-assets' },
            { text: 'Estilos', link: '/frontend/styles' }
          ]
        }
      ],
      '/backend/': [
        {
          text: 'Backend',
          items: [
            { text: 'Proxy API', link: '/backend/api' },
            { text: 'Apps Script', link: '/backend/apps-script' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Referencias',
          items: [
            { text: 'CHANGELOG', link: '/reference/changelog' }
          ]
        }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/Analitica-UNGRD/PAI' }
    ],
    footer: {
      message: 'Documentación interna del Aplicativo Modular Web PAI 2025',
      copyright: `© ${new Date().getFullYear()} Manolo Rey Garcia`
    }
  }
});
