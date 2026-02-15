#!/usr/bin/env node

import('../dist/cli.js')
  .then(({ program }) => {
    program.parse(process.argv);
  })
  .catch((err) => {
    console.error('Error loading DailyAgent CLI:', err);
    process.exit(1);
  });
