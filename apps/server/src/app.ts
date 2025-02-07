import Koa from 'koa';
import path from 'path';
import Router from '@koa/router';
import cors from '@koa/cors';
import serve from 'koa-static';
import { bodyParser } from '@koa/bodyparser';
import { whiteListMiddleware, opensearchMiddleware } from './middleware';
import { getConfig } from './config';
import { logger } from './logger';
import history from 'koa2-connect-history-api-fallback';
import {
  chatStreamController,
  modelsController,
  searchController,
  sogouSearchController
} from './controller';

const app = new Koa();
const router = new Router();

const port = Number(getConfig('PORT', '3000'));

app.use(history({
  index: '/index.html',
  whiteList: ['/api']
}));

// Add opensearch middleware before static files
app.use(opensearchMiddleware);

// static path
const staticPath = path.join(__dirname, '../web/dist');
app.use(serve(staticPath, {
  gzip: true,
  index: 'index.html'
}));

app.use(cors({
  origin: '*'
}));

app.use(bodyParser());

// Error handler
app.use(async (ctx, next) => {
  try {
    await next();
  } catch(err) {
    console.error('[server error]', err);
    ctx.res.statusCode = 422;
    ctx.body = err;
  }
});

// router
app.use(router.routes()).use(router.allowedMethods());

// controller
router.post('/api/search', whiteListMiddleware(), searchController);
router.post('/api/sogou/search', sogouSearchController);
router.post('/api/chat', chatStreamController);
router.get('/api/models', modelsController);

app.listen(port, () => {
  logger.info(`[Server is running on port]: ${port}`);
});
