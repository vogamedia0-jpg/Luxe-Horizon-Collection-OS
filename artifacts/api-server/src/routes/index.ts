import { Router, type IRouter } from "express";
import healthRouter from "./health";
import luxeHorizonRouter from "./luxe-horizon";

const router: IRouter = Router();

router.use(healthRouter);
router.use(luxeHorizonRouter);

export default router;
