'use strict';

import pkg from './package.json';
import { fileURLToPath } from 'node:url';
import os from 'os';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  'binary-path-env-var': BINARY_PATH_ENV_VAR,
  'executable-base-name': executableBaseName,
} = pkg[pkg.name];

if (typeof BINARY_PATH_ENV_VAR !== 'string') {
  throw new Error(`package.json: invalid/missing ${pkg.name}.binary-path-env-var entry`);
}

if (typeof executableBaseName !== 'string') {
  throw new Error(`package.json: invalid/missing ${pkg.name}.executable-base-name entry`);
}

let binaryPath;

if (process.env[BINARY_PATH_ENV_VAR]) {
  binaryPath = process.env[BINARY_PATH_ENV_VAR];
} else {
  const binaries = {
    darwin: ['x64', 'arm64'],
    freebsd: ['x64'],
    linux: ['x64', 'ia32', 'arm64', 'arm'],
    win32: ['x64', 'ia32'],
  };

  const platform = process.env.npm_config_platform || os.platform();
  const arch = process.env.npm_config_arch || os.arch();


  if (binaries[platform]?.includes(arch)) {
    binaryPath = path.join(
        __dirname,
        executableBaseName + (platform === 'win32' ? '.exe' : ''),
    );
  } else {
    binaryPath = null;
  }
}

export default binaryPath;
