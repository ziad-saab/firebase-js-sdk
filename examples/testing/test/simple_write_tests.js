const firebase = require('firebase');
const _ = require("firebase/firestore");

function invert(pr) {
  return new Promise((resolve, reject) => {
    pr.then(yay => reject(new Error("expected failure, got success")), nay => resolve(nay))
  });
}

// firebase.firestore.setLogLevel("debug");
afterEach(function() {
  firebase.apps.forEach(app => app.delete());
});

describe("my rules", function() {
  after
  it("should not let anyone write anything", async function() {
    var app = firebase.initializeApp({ projectId: 'test' });
    var db = firebase.firestore();
    db.settings({
      host: 'localhost:8080',
      ssl: false,
      timestampsInSnapshots: true
    });

    var docRef = db.collection('users').doc('alovelace');
    await invert(docRef.set({
      first: 'Ada',
      last: 'Lovelace',
      born: 1815
    }));
  });
});
