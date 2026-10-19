// Garment/outfit codes are allocated inside the SQLite write transaction.
import {readResource,commit} from './api-client.mjs';
import {assignCodes} from '../dist/communication-codes.js';
const library=await readResource('references'),next=structuredClone(library);
const result=assignCodes(next.formulas.flatMap(f=>f.styles),next.codeRegistry||{},()=> 'CK');
next.codeRegistry=result.registry;const byId=new Map(result.records.map(r=>[r.id,r]));
for(const formula of next.formulas)formula.styles=formula.styles.map(s=>byId.get(s.id));
if(JSON.stringify(next)!==JSON.stringify(library))await commit({type:'set-document',key:'reference-catalog',expected:library,data:next});
console.log('Garment/outfit codes: SQLite transaction. Reference reservations verified.');
