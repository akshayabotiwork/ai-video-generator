export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Forward API and storage calls to Render backend
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/storage/')) {
      const backendUrl = 'https://ai-video-generator-po6d.onrender.com' + url.pathname + url.search;
      return fetch(new Request(backendUrl, request));
    }

    // Serve static assets from apps/web/dist with required WebCodecs/WASM headers
    const response = await env.ASSETS.fetch(request);
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
