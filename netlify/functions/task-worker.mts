import { createTaskWorker } from '@AiDigital-com/design-system/server';

export default createTaskWorker({
  app: 'aio-optimization',
  taskFunctionMap: {
    run_audit: 'aio-anchor',
    run_evaluator: 'scan-engine-background',
    synthesize_engine: 'synthesize-engine-background',
    review: 'review-background',
  },
});
