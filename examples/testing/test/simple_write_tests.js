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
const util = require('@firebase/util');
const _ = require('firebase/firestore');


process.on('unhandledRejection', error => {
  console.log('unhandledRejection', error);
});


function invert(pr) {
  return new Promise((resolve, reject) => {
    pr.then(
      yay => reject(new Error('expected failure, got success')),
      nay => resolve(nay)
    );
  });
}

function fakeToken(auth) {
  var header = { alg: 'RS256', kid: 'fakekid' };
  var claims = { sub: 'alice', email: 'alice@fblocal.com' };
  return [
    util.base64.encodeString(JSON.stringify(header)),
    util.base64.encodeString(JSON.stringify(claims)),
    'fakesignature'
  ].join('.');
}

// firebase.firestore.setLogLevel("debug");
afterEach(function() {
  firebase.apps.forEach(app => app.delete());
});

describe('my rules', function() {
  it('should not let anyone write anything', async function() {
    var app = firebase.initializeApp({ projectId: 'test' });
    var FAKE_AUTH_TOKEN = fakeToken({ sub: 'alice' });
    app.INTERNAL.getToken = function() {
      return Promise.resolve({ accessToken: FAKE_AUTH_TOKEN });
    };
    var db = app.firestore();
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
