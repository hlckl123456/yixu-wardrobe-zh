import path from 'node:path';
import {createDemo} from './synthetic-data.mjs';
const directory=process.argv[2];if(!directory||!path.isAbsolute(directory))throw Error('Usage: node scripts/demo.mjs /absolute/new/demo-directory');
console.log(createDemo(directory));
