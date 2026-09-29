export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const githubApiUrl = `https://api.github.com/repos/${env.GH_OWNER}/${env.GH_REPO}/contents/data.json`;
    const githubToken = env.GH_TOKEN;

    try {
      // ========== GET: خوندن داده‌ها ==========
      if (request.method === 'GET') {
        const response = await fetch(githubApiUrl, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'darsyar-worker',
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (response.status === 404) {
          return new Response(JSON.stringify({
            notes: {}, comments: {}, subjects: {}
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (!response.ok) {
          throw new Error('GitHub API error: ' + response.status);
        }

        const data = await response.json();
        const content = JSON.parse(atob(data.content));

        return new Response(JSON.stringify(content), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ========== POST: ذخیره داده‌ها ==========
      if (request.method === 'POST') {
        const newData = await request.json();

        let currentSha = null;
        const getResponse = await fetch(githubApiUrl, {
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'darsyar-worker',
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (getResponse.ok) {
          const currentFile = await getResponse.json();
          currentSha = currentFile.sha;
        }

        const jsonString = JSON.stringify(newData);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        const putBody = {
          message: 'به‌روزرسانی داده‌های درسیار - ' + new Date().toISOString(),
          content: encodedContent,
        };

        if (currentSha) {
          putBody.sha = currentSha;
        }

        const putResponse = await fetch(githubApiUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `token ${githubToken}`,
            'User-Agent': 'darsyar-worker',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(putBody)
        });

        if (!putResponse.ok) {
          const errorText = await putResponse.text();
          throw new Error('GitHub PUT error: ' + putResponse.status + ' - ' + errorText);
        }

        const result = await putResponse.json();

        return new Response(JSON.stringify({
          success: true,
          message: 'داده‌ها با موفقیت ذخیره شد',
          commit: result.commit?.sha || 'unknown'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
