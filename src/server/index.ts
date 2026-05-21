import { buildApp } from './app';
import { loadConfig } from './config';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = buildApp({ config });

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
