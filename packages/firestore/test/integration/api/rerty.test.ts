/**
 * @license
 * Copyright 2017 Google LLC
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

import * as chaiAsPromised from 'chai-as-promised';

import * as firestore from '@firebase/firestore-types';
import { expect, use } from 'chai';

import { Deferred } from '../../util/promise';
import { EventsAccumulator } from '../util/events_accumulator';
import firebase from '../util/firebase_export';
import {
  apiDescribe,
  DEFAULT_SETTINGS,
  withTestCollection,
  withTestDb,
  withTestDbs,
  withTestDoc,
  withTestDocAndInitialData
} from '../util/helpers';

import { it } from './crash_helper';
import { setLogLevel } from '../../../src/util/log';
// tslint:disable:no-floating-promises

use(chaiAsPromised);

//setLogLevel('debug');

for (let i = 0; i < 10; ++i) {
  describe.only('Database ' + i, () => {
    it.only('can set a document', () => {
      return withTestDoc(true, async docRef => {
        await retry(() =>
          docRef.set({
            desc: 'Stuff related to Firestore project...',
            owner: {
              name: 'Jonny',
              title: 'scallywag'
            }
          })
        );
        await retry(() => docRef.firestore.waitForPendingWrites());
        await retry(() => docRef.firestore.disableNetwork());
        await retry(() => docRef.firestore.enableNetwork());
        const listener = await retry(() => {
          const def = new Deferred();
          const listener = docRef.onSnapshot(
            () => def.resolve(),
            e => def.reject(e)
          );
          return def.promise.then(() => listener);
        });
        await retry(() => docRef.get());
        await retry(() => docRef.get({ source: 'cache' }));
        const collRef = docRef.parent;
        const listener2 = await retry(() => {
          const def = new Deferred();
          const listener = collRef.onSnapshot(
            () => def.resolve(),
            e => def.reject(e)
          );
          return def.promise.then(() => listener);
        });
        await retry(() => collRef.get());
        await retry(() => collRef.get({ source: 'cache' }));
        listener();
        listener2();
      });
    });
  });
}

function retry<T>(op: () => Promise<T>): Promise<T> {
  return op().catch(e => {
    console.log('Retrying ' + e);
    return retry(op);
  });
}
