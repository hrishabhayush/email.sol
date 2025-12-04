import { type RouteConfig, index, layout, prefix, route } from '@react-router/dev/routes';

export default [
  index('page.tsx'),
  route('/home', 'home/page.tsx'),

  route('/favicon.ico', 'favicon.ico.ts'),
  route('/api/mailto-handler', 'mailto-handler.ts'),

  layout('(full-width)/layout.tsx', [
    route('/about', '(full-width)/about.tsx'),
    route('/pricing', '(full-width)/pricing.tsx'),
    route('/contributors', '(full-width)/contributors.tsx'),
    route('/hr', '(full-width)/hr.tsx'),
  ]),

  route('/login', '(auth)/login/page.tsx'),

  // Enable this when we have a zero signup page
  // route('/zero/signup', '(auth)/zero/signup/page.tsx'),
  // route('/zero/login', '(auth)/zero/login/page.tsx'),

  layout('(routes)/layout.tsx', [
    route('/developer', '(routes)/developer/page.tsx'),
    layout(
      '(routes)/mail/layout.tsx',
      prefix('/mail', [
        index('(routes)/mail/page.tsx'),
        route('/create', '(routes)/mail/create/page.tsx'),
        route('/compose', '(routes)/mail/compose/page.tsx'),
        route('/under-construction/:path', '(routes)/mail/under-construction/[path]/page.tsx'),
        route('/:folder', '(routes)/mail/[folder]/page.tsx'),
      ]),
    ),
    route('/*', 'meta-files/not-found.ts'),
  ]),
] satisfies RouteConfig;
