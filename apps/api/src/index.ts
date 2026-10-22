import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[PaperFlow API] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
  console.log(`[PaperFlow API] Health endpoint available at http://localhost:${env.PORT}/api/v1/health`);
});
