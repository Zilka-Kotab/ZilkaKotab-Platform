import { Router, type IRouter } from "express";
import healthRouter from "./health";
import contactRouter from "./contact";
import internalAccessRouter from "./internal-access";

const router: IRouter = Router();

router.use(healthRouter);
router.use(contactRouter);
router.use(internalAccessRouter);

export default router;
