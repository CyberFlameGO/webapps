/**
 Copyright 2022 Gravitational, Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 MIT License

 Copyright (c) 2015 - present Microsoft Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.
 */

// Based on https://github.com/microsoft/vscode/blob/1.66.0/src/vs/platform/shell/node/shellEnv.ts

import { Logger } from 'shared/libs/logger';
import { unique } from 'teleterm/ui/utils/uid';
import { spawn } from 'child_process';
import { memoize } from 'lodash';

const logger = new Logger('resolveShellEnv()');
const resolveShellMaxTime = 8000; // 8s

export const resolveShellEnvCached = memoize(resolveShellEnv);

async function resolveShellEnv(shell: string): Promise<typeof process.env> {
  if (process.platform === 'win32') {
    logger.trace('skipped Windows platform');
    return;
  }
  // TODO(grzegorz) skip if already running from CLI

  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort();
  }, resolveShellMaxTime);

  try {
    return await resolveUnixShellEnv(shell, timeoutController.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveUnixShellEnv(
  shell: string,
  abortSignal: AbortSignal
): Promise<typeof process.env> {
  const runAsNode = process.env['ELECTRON_RUN_AS_NODE'];
  const noAttach = process.env['ELECTRON_NO_ATTACH_CONSOLE'];

  const mark = unique().replace(/-/g, '').substring(0, 12);
  const regex = new RegExp(mark + '(.*)' + mark);

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ATTACH_CONSOLE: '1',
  };

  return new Promise<typeof process.env>((resolve, reject) => {
    const command = `'${process.execPath}' -p '"${mark}" + JSON.stringify(process.env) + "${mark}"'`;
    // When bash is run with -c, it is considered a non-interactive shell, and it does not read ~/.bashrc, unless is -i specified.
    // https://unix.stackexchange.com/questions/277312/is-the-shell-created-by-bash-i-c-command-interactive
    const shellArgs = shell === '/bin/tcsh' ? ['-ic'] : ['-ilc'];

    logger.trace(`Reading shell ${shell} ${shellArgs} ${command}`);

    const child = spawn(shell, [...shellArgs, command], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    abortSignal.onabort = () => {
      child.kill();
      logger.warn('Reading shell env timed out');
      reject(
        new Error(
          'Unable to resolve shell environment. Please review shell configuration.'
        )
      );
    };

    child.on('error', err => {
      reject(err);
    });

    const buffers: Buffer[] = [];
    child.stdout.on('data', b => buffers.push(b));

    const stderr: Buffer[] = [];
    child.stderr.on('data', b => stderr.push(b));

    child.on('close', (code, signal) => {
      const raw = Buffer.concat(buffers).toString('utf8');
      const stderrStr = Buffer.concat(stderr).toString('utf8');

      if (code || signal) {
        logger.warn(
          `Unexpected exit code from spawned shell (code ${code}, signal ${signal})`,
          stderrStr
        );
        return reject(new Error(stderrStr));
      }

      const match = regex.exec(raw);
      const rawStripped = match ? match[1] : '{}';

      try {
        const env = JSON.parse(rawStripped);

        if (runAsNode) {
          env['ELECTRON_RUN_AS_NODE'] = runAsNode;
        } else {
          delete env['ELECTRON_RUN_AS_NODE'];
        }

        if (noAttach) {
          env['ELECTRON_NO_ATTACH_CONSOLE'] = noAttach;
        } else {
          delete env['ELECTRON_NO_ATTACH_CONSOLE'];
        }

        resolve(env);
      } catch (error) {
        logger.warn('Failed to parse stdout', error);
        reject(error);
      }
    });
  });
}
