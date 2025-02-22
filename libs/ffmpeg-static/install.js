'use strict';

import fs from 'fs';
import os from 'os';
import { encode as encodeQuery } from 'querystring';
import { strictEqual } from 'assert';
import envPaths from 'env-paths';
import { default as FileCache } from '@derhuerst/http-basic/lib/FileCache';
import ProgressBar from 'progress';
import request from '@derhuerst/http-basic';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';
import { extname } from 'path';
import pathToBinary from './index.js';
import pkg from './package.json';

const {
  'executable-base-name': executableBaseName,
  'binary-release-tag-env-var': RELEASE_ENV_VAR,
  'binaries-url-env-var': BINARIES_URL_ENV_VAR,
} = pkg[pkg.name];

if (typeof executableBaseName !== 'string') {
  throw new Error(`package.json: invalid/missing ${pkg.name}.executable-base-name entry`);
}

const exitOnError = (err) => {
  console.error(err);
  process.exit(1);
};

const exitOnErrorOrWarnWith = (msg) => (err) => {
  if (err.statusCode === 404) console.warn(msg);
  else exitOnError(err);
};

if (!pathToBinary) {
  exitOnError(`${pkg.name} install failed: No binary found for architecture`);
}

try {
  if (fs.statSync(pathToBinary).isFile()) {
    console.info(`${executableBaseName} is installed already.`);
    process.exit(0);
  }
} catch (err) {
  if (err && err.code !== 'ENOENT') exitOnError(err);
}

let agent = false;
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  const { default: HttpsProxyAgent } = await import('https-proxy-agent');
  const { hostname, port, protocol } = new URL(proxyUrl);
  agent = new HttpsProxyAgent({ hostname, port, protocol });
}

const normalizeS3Url = (url) => {
  url = new URL(url);
  if (!url.hostname.endsWith('.s3.amazonaws.com')) return url.href;
  const query = Array.from(url.searchParams.entries())
      .filter(([key]) => !key.toLowerCase().startsWith('x-amz-'))
      .reduce((query, [key, val]) => ({ ...query, [key]: val }), {});
  url.search = encodeQuery(query);
  return url.href;
};

const cache = new FileCache(envPaths(pkg.name).cache);
cache.getCacheKey = (url) => FileCache.prototype.getCacheKey(normalizeS3Url(url));

const isGzUrl = (url) => extname(new URL(url).pathname) === '.gz';

const noop = () => {};
function downloadFile(url, destinationPath, progressCallback = noop) {
  return new Promise((fulfill, reject) => {
    request('GET', url, {
      agent,
      followRedirects: true,
      maxRedirects: 3,
      gzip: true,
      cache,
      timeout: 30 * 1000,
      retry: true,
    }, (err, response) => {
      if (err || response.statusCode !== 200) {
        reject(err || new Error(`Failed to download ${executableBaseName}.`));
        return;
      }

      const file = fs.createWriteStream(destinationPath);
      const streams = isGzUrl(url) ? [response.body, createGunzip(), file] : [response.body, file];
      pipeline(...streams, (err) => (err ? reject(err) : fulfill()));

      const totalBytes = parseInt(response.headers['content-length'], 10) || null;
      response.body.on('data', (chunk) => progressCallback(chunk.length, totalBytes));
    });
  });
}

let progressBar = null;
function onProgress(deltaBytes, totalBytes) {
  if (process.env.CI || totalBytes === null) return;
  if (!progressBar) {
    progressBar = new ProgressBar(`Downloading ${executableBaseName} [:bar] :percent :etas`, {
      complete: '|',
      incomplete: ' ',
      width: 20,
      total: totalBytes,
    });
  }
  progressBar.tick(deltaBytes);
}

const release = process.env[RELEASE_ENV_VAR] || pkg[pkg.name]['binary-release-tag'];
const arch = process.env.npm_config_arch || os.arch();
const platform = process.env.npm_config_platform || os.platform();
const downloadsUrl = process.env[BINARIES_URL_ENV_VAR] || 'https://github.com/eugeneware/ffmpeg-static/releases/download';
const baseUrl = `${downloadsUrl}/${release}`;

const downloadUrl = `${baseUrl}/${executableBaseName}-${platform}-${arch}.gz`;
const readmeUrl = `${baseUrl}/${platform}-${arch}.README`;
const licenseUrl = `${baseUrl}/${platform}-${arch}.LICENSE`;

downloadFile(downloadUrl, pathToBinary, onProgress)
    .then(() => fs.chmodSync(pathToBinary, 0o755))
    .catch(exitOnError)
    .then(() => downloadFile(readmeUrl, `${pathToBinary}.README`))
    .catch(exitOnErrorOrWarnWith(`Failed to download the ${executableBaseName} README.`))
    .then(() => downloadFile(licenseUrl, `${pathToBinary}.LICENSE`))
    .catch(exitOnErrorOrWarnWith(`Failed to download the ${executableBaseName} LICENSE.`));
