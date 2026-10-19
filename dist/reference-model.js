import catalog from './data/reference-catalog.js';
import {validateReferenceCatalog} from './reference-schema.js';
export {validateReferenceCatalog,selectReference} from './reference-schema.js';
export const library=validateReferenceCatalog(catalog);
