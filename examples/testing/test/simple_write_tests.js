/**
 * Copyright 2018 Google Inc.
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

const firebase = require('firebase');
const _ = require('firebase/firestore');

function invert(pr) {
  return new Promise((resolve, reject) => {
    pr.then(
      yay => reject(new Error('expected failure, got success')),
      nay => resolve(nay)
    );
  });
}

// firebase.firestore.setLogLevel("debug");
afterEach(function() {
  firebase.apps.forEach(app => app.delete());
});

describe('my rules', function() {
  after;
  it('should not let anyone write anything', async function() {
    var app = firebase.initializeApp({ projectId: 'test' });
    var db = firebase.firestore();
    db.settings({
      host: 'localhost:8080',
      ssl: false,
      timestampsInSnapshots: true
    });

    var docRef = db.collection('users').doc('alovelace');
    await invert(
      docRef.set({
        first: 'Ada',
        last: 'Lovelace',
        born: 1815
      })
    );
  });
});
