import { networkInterfaces } from 'node:os';
import { spawnSync } from 'node:child_process';

const interfaces = networkInterfaces();
const preferredNames = ['en0', 'en1'];
const names = [
  ...preferredNames.filter((name) => interfaces[name]),
  ...Object.keys(interfaces).filter((name) => !preferredNames.includes(name)),
];

const address = names
  .flatMap((name) => interfaces[name] ?? [])
  .find(
    (candidate) =>
      candidate.family === 'IPv4' &&
      !candidate.internal &&
      !candidate.address.startsWith('169.254.'),
  )?.address;

if (!address) {
  console.error(
    'Could not find the Mac LAN address. Connect the Mac to Wi-Fi or Ethernet and retry.',
  );
  process.exit(1);
}

const startOnly = process.argv.includes('--start');
const command = startOnly
  ? ['expo', 'start', '--dev-client', '--lan']
  : ['expo', 'run:ios', '--device'];

console.log(`Using Mac development host ${address}`);

if (process.argv.includes('--print-host')) {
  process.exit(0);
}

const result = spawnSync('npx', command, {
  env: {
    ...process.env,
    EXPO_PUBLIC_DEV_HOST: address,
  },
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
