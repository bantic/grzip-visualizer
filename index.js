const RAVEN_URL = require('./data/raven.json.dat');

import App from './app';

document.addEventListener('DOMContentLoaded', () => {
  let el = document.getElementById('characters');
  new App(RAVEN_URL, el).run();
});
