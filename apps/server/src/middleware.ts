import { Context, Next } from 'koa';
import { getConfig } from './config';

export const whiteListMiddleware = () => {
  return async (ctx: Context, next: Next) => {
    const whiteList = getConfig('WHITE_LIST', '');
    if (!whiteList) {
      await next();
      return;
    }
    const origin = ctx.get('origin');
    if (!origin || whiteList.split(',').includes(origin)) {
      await next();
      return;
    }
    ctx.status = 403;
    ctx.body = 'Forbidden';
  };
};

// Add middleware to set correct content type for OpenSearch XML
export const opensearchMiddleware = async (ctx: Context, next: Next) => {
  await next();

  if (ctx.path === '/opensearch.xml') {
    ctx.set('Content-Type', 'application/opensearchdescription+xml');
  }
};
