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

var docRef = db.collection('users').doc('alovelace');

var setAda = docRef.set({
  first: 'Ada',
  last: 'Lovelace',
  born: 1815
});

var aTuringRef = db.collection('users').doc('aturing');

var setAlan = aTuringRef.set({
  first: 'Alan',
  middle: 'Mathison',
  last: 'Turing',
  born: 1912
});
