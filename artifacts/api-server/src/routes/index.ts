import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import authRouter from "./auth";
import portalRouter from "./portal";
import patentMonitorRouter from "./patent-monitor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(authRouter);
router.use(portalRouter);
router.use(patentMonitorRouter);

export default router;
