import { createQStoryProxy } from './_qstory-proxy-core.mjs';

const proxyQStoryRequest = createQStoryProxy();

export default {
  fetch(request) {
    return proxyQStoryRequest(request);
  },
};
