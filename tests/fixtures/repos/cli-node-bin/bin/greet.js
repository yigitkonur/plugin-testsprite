#!/usr/bin/env node
const { program } = require('commander');

program
  .name('greet')
  .argument('<name>')
  .action((name) => console.log(`Hello, ${name}!`));

program.parse();
