import fs from 'node:fs';
import {stageMedia} from './media-files.mjs';
import {commit} from './api-client.mjs';
const [source,url]=process.argv.slice(2);if(!source||!url)throw Error('Usage: node scripts/register-media.mjs /absolute/image.png assets/outfits/stable-version.png');
const asset=await stageMedia(url,fs.readFileSync(source));await commit({type:'register-assets',assets:[asset]});console.log(JSON.stringify(asset));
