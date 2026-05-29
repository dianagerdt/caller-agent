const { spawn } = require('node:child_process');

const commands = [
  {
    name: 'server',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev:server']
  },
  {
    name: 'client',
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'dev:client']
  }
];

const children = [];
const isWindows = process.platform === 'win32';
let shuttingDown = false;

function stopAll(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    killTree(child, signal);
  }
}

function killTree(child, signal) {
  if (!child.pid) {
    return;
  }

  if (isWindows) {
    spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore'
    });
    return;
  }

  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error && error.code !== 'ESRCH') {
      process.kill(child.pid, signal);
    }
  }
}

for (const { name, command, args } of commands) {
  const child = spawn(command, args, {
    detached: !isWindows,
    stdio: 'inherit',
    shell: false
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    if (code !== 0) {
      console.error(`[dev] ${name} exited with code ${code ?? signal}`);
    }

    stopAll(signal ?? 'SIGTERM');
    process.exit(code ?? 1);
  });
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
});
