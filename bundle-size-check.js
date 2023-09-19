#!/usr/bin/env node

const fs = require('fs');

const path = 'build/statsig-prod-web-sdk.js';
const stats = fs.statSync(path);

if (stats.size > 66820) {
  throw 'Error: Build has grown bigger than 65kb';
}

console.log(`Build size (${stats.size} bytes)`);
