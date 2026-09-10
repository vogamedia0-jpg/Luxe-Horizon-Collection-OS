import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminEnhancementsRouter from "./admin-enhancements";
import luxeHorizonRouter from "./luxe-horizon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(adminEnhancementsRouter);
router.use(luxeHorizonRouter);

export default router;
