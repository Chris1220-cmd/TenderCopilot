import { router } from '@/server/trpc';
import { authRouter } from '@/server/routers/auth';
import { tenantRouter } from '@/server/routers/tenant';
import { userRouter } from '@/server/routers/user';
import { companyRouter } from '@/server/routers/company';
import { tenderRouter } from '@/server/routers/tender';
import { requirementRouter } from '@/server/routers/requirement';
import { taskRouter } from '@/server/routers/task';
import { documentRouter } from '@/server/routers/document';
import { analyticsRouter } from '@/server/routers/analytics';
import { discoveryRouter } from '@/server/routers/discovery';
import { aiRolesRouter } from '@/server/routers/ai-roles';
import { privateSourcesRouter } from '@/server/routers/private-sources';
import { chatRouter } from './routers/chat';
import { learningRouter } from './routers/learning';
import { fakelosRouter } from '@/server/routers/fakelos';
import { subcontractorNeedRouter } from '@/server/routers/subcontractor-need';
import { deadlinePlanRouter } from '@/server/routers/deadline-plan';
import { espdRouter } from '@/server/routers/espd';
import { packageRouter } from '@/server/routers/package';
import { teamMemberRouter } from '@/server/routers/team-member';
import { resourcesRouter } from '@/server/routers/resources';
import { subscriptionRouter } from '@/server/routers/subscription';
import { adminRouter } from '@/server/routers/admin';

export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  user: userRouter,
  company: companyRouter,
  tender: tenderRouter,
  requirement: requirementRouter,
  task: taskRouter,
  document: documentRouter,
  analytics: analyticsRouter,
  discovery: discoveryRouter,
  aiRoles: aiRolesRouter,
  privateSources: privateSourcesRouter,
  chat: chatRouter,
  learning: learningRouter,
  fakelos: fakelosRouter,
  subcontractorNeed: subcontractorNeedRouter,
  deadlinePlan: deadlinePlanRouter,
  espd: espdRouter,
  package: packageRouter,
  teamMember: teamMemberRouter,
  resources: resourcesRouter,
  subscription: subscriptionRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
