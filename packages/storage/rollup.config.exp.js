/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import tmp from 'tmp';
import json from 'rollup-plugin-json';
import typescriptPlugin from 'rollup-plugin-typescript2';
import sourcemaps from 'rollup-plugin-sourcemaps';
import typescript from 'typescript';
import pkgExp from './exp/package.json';
import pkg from './package.json';
import path from 'path';

const deps = Object.keys(
  Object.assign({}, pkg.peerDependencies, pkg.dependencies)
).concat('@firebase/app-exp');

const nodePlugins = [
  typescriptPlugin({
    typescript,
    tsconfigOverride: {
      compilerOptions: {
        target: 'es2017'
      }
    },
    cacheDir: tmp.dirSync(),
    abortOnError: false
  }),
  json({ preferConst: true })
];

const browserPlugins = [
  typescriptPlugin({
    typescript,
    tsconfigOverride: {
      compilerOptions: {
        target: 'es2017'
      }
    },
    cacheDir: tmp.dirSync(),
    abortOnError: false
  }),
  json({ preferConst: true })
];

const es2017ToEs5Plugins = [
  typescriptPlugin({
    typescript,
    compilerOptions: {
      allowJs: true
    },
    include: ['dist/*.js', 'dist/exp/*.js']
  }),
  sourcemaps()
];

const nodeBuilds = [
  // Node ESM build
  {
    input: './exp/index.ts',
    output: {
      file: path.resolve('./exp', pkgExp['main-esm']),
      format: 'es',
      sourcemap: true
    },
    plugins: nodePlugins,
    external: id => deps.some(dep => id === dep || id.startsWith(`${dep}/`)),
    treeshake: {
      moduleSideEffects: false
    }
  },
  // Node UMD build
  {
    input: path.resolve('./exp', pkgExp['main-esm']),
    output: {
      file: path.resolve('./exp', pkgExp.main),
      format: 'umd',
      name: 'firebase.storage',
      sourcemap: true,
      globals: {
        'tslib': 'tslib',
        '@firebase/app-exp': 'appExp',
        '@firebase/app': 'firebase',
        '@firebase/component': 'component'
      }
    },
    plugins: es2017ToEs5Plugins,
    external: id => deps.some(dep => id === dep || id.startsWith(`${dep}/`)),
    treeshake: {
      moduleSideEffects: false
    }
  }
];

const browserBuilds = [
  {
    input: './exp/index.ts',
    output: {
      file: path.resolve('./exp', pkgExp.browser),
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins,
    external: id => deps.some(dep => id === dep || id.startsWith(`${dep}/`)),
    treeshake: {
      moduleSideEffects: false
    }
  }
];

// eslint-disable-next-line import/no-default-export
export default [...nodeBuilds, ...browserBuilds];
