const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const serverDist = join(process.cwd(), 'dist', 'server');

mkdirSync(serverDist, { recursive: true });
writeFileSync(join(serverDist, 'package.json'), `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
