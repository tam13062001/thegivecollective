import express from 'express';
import { getGA4Stats, refreshGA4Stats, updateGA4Website } from '../controllers/ga4Controller.js';

const router = express.Router();

router.get('/ga4', getGA4Stats);
router.get('/ga4/refresh', refreshGA4Stats);
router.put('/ga4/website', updateGA4Website);

export default router;