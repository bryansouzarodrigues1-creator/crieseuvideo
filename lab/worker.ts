import { createLabWorker } from './createWorker';
import assets from './generated/assets.json';

// Owner-private deployment. No production database, Lovable key or TTS route.
export default createLabWorker(assets);
