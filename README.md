This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Prisma

yarn prisma db pull
yarn prisma generate
yarn prisma studio

## update

yarn outdated|grep https|awk '{print $1}'|xargs yarn upgrade -L


docker run cloudflare/cloudflared:latest tunnel --no-autoupdate run --token eyJhIjoiZjk1M2QwYzA4YmY5NmY2YWFkMjYzNTcwNDViOWUzMDYiLCJ0IjoiNWZlOWYyNjEtNjE1Zi00ZDE0LTkwYTQtNzY4MzNiNmJiNjM5IiwicyI6Ik9XWTFNbVl4Wm1JdE16TTFaaTAwTnpOaExXRmpNMkl0TXpVMU1qSmhZMlV4TUdJMyJ9


# Add cloudflare gpg key
mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg | tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null

# Add this repo to your apt repositories
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list

# install cloudflared
apt-get update && apt-get install cloudflared


cloudflared service install eyJhIjoiZjk1M2QwYzA4YmY5NmY2YWFkMjYzNTcwNDViOWUzMDYiLCJ0IjoiNWZlOWYyNjEtNjE1Zi00ZDE0LTkwYTQtNzY4MzNiNmJiNjM5IiwicyI6Ik9XWTFNbVl4Wm1JdE16TTFaaTAwTnpOaExXRmpNMkl0TXpVMU1qSmhZMlV4TUdJMyJ9
