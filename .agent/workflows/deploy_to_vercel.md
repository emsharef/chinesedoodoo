---
description: How to deploy the application to Vercel
---

# Deploying to Vercel

Follow these steps to deploy your ChineseDuDu application to Vercel.

## 1. Push to Git
Ensure your latest changes are committed and pushed to your remote repository (GitHub, GitLab, or Bitbucket).

## 2. Import Project in Vercel
1.  Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2.  Click **"Add New..."** -> **"Project"**.
3.  Import your `chinesedoodoo` repository.

## 3. Configure Environment Variables
In the "Configure Project" screen, expand the **"Environment Variables"** section. Add the following variables (copy values from your local `.env.local` file):

| Name | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Anonymous Key |
| `OPENAI_API_KEY` | Your OpenAI API Key |

> **Note:** You do not need `SUPABASE_DB_URL` for the application to run, as it is only used for running migration scripts locally.

## 4. Deploy
1.  Leave the **Build and Output Settings** as default (Framework Preset: Next.js).
2.  Click **"Deploy"**.

## 5. Verify
Once deployment is complete:
1.  Visit the provided URL.
2.  Log in with your account.
3.  Try generating a story to verify OpenAI integration.
4.  Check "Settings" -> "Developer Settings" to ensure everything looks correct.

## Troubleshooting
-   **Build Failed?** Check the build logs. Common issues include missing dependencies or type errors (which we should have fixed!).
-   **Login Failed?** Ensure your Supabase URL and Anon Key are correct.
-   **Story Generation Failed?** Check your OpenAI API Key.
