import { Router } from "express";
import { requireAdmin } from "../middlewares/portalAccess";
import { firmRefreshStatus, startFirmRefresh } from "../lib/firm-benchmark-store";
const router = Router();
router.get("/portal/admin/firm-benchmark", requireAdmin, async (_req, res, next) => {
  try { res.json(await firmRefreshStatus()); } catch (err) { next(err); }
});
router.post("/portal/admin/firm-benchmark/refresh", requireAdmin, async (_req, res, next) => {
  try { await startFirmRefresh(); res.status(202).json(await firmRefreshStatus()); } catch (err) { next(err); }
});
export default router;
