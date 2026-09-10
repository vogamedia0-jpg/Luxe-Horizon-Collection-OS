import { onRequest } from '../functions/api/[[path]].js';

export default {
  async fetch(request, env) {
    return onRequest({ request, env });
  },
};
