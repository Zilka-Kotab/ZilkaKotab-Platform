import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import authRouter from "./auth";
import portalRouter from "./portal";
import patentMonitorRouter from "./patent-monitor";
import internalWorkflowRouter from "./internal-workflow";
import publicPatentToolsRouter from "./public-patent-tools";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(authRouter);
router.use(publicPatentToolsRouter);
router.use(portalRouter);
router.use(patentMonitorRouter);
router.use(internalWorkflowRouter);

export default router;
