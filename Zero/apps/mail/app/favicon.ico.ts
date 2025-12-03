import type { Route } from './+types/favicon.ico';

export async function clientLoader() {
  return Response.redirect('/solmail-logo.png', 301);
}

