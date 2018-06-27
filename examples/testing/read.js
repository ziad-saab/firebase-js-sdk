const firebase = require('firebase');
const _ = require('firebase/firestore');
firebase.firestore.setLogLevel('debug');

var app = firebase.initializeApp({
  projectId: 'test'
});

var db = firebase.firestore();
db.settings({
  host: 'localhost:8080',
  ssl: false
});

db
  .collection('users')
  .doc('alovelace')
  .get()
  .then(snapshot => {
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  })
  .catch(err => {
    console.log('Error getting documents', err);
  });
