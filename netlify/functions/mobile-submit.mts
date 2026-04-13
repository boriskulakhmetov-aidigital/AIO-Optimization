import { createDispatchHandler } from '@AiDigital-com/design-system/server';
export default createDispatchHandler({
  app: 'aio-optimization',
  sessionTable: 'scans',
  skipAuth: true,
  anonymousUserId: 'mobile:anonymous',
});
