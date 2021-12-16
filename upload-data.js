// import data from '/Users/zhengjunzhe/share/export.json'
// import { PrismaClient } from '@prisma/client'
const data = require('/Users/zhengjunzhe/share/export.json');
const { PrismaClient } = require('@prisma/client');
const moment = require('moment');

const prisma = new PrismaClient()

async function main() {
  await prisma.$connect()
  console.log('begin')
  for (let i = 0; i < data.length; i++) {
    const rss = data[i];
    console.log(rss.title + ' begin')
    try {
      await prisma.rss.create({
        data: {
          updateTime: rss.updateTime,
          url: rss.url,
          title: rss.title,
          icon: rss.icon,
          query: rss.query,
          /* items: {
            create: rss.items.map(item => ({
              title: item.title,
              link: item.link,
              description: item.description,
              updateTime: item.updateTime,
            }))
          } */
        },
      });
      console.log(rss.title + ' end')
    } catch (error) {
      console.error(error);
    }

  }
  console.log('suceess')
}

async function second() {
  await prisma.$connect()
  console.log('begin')
  for (let i = 0; i < data.length; i++) {
    const rss = data[i];
    console.log(rss.title + ' begin')
    const dbRss = await prisma.rss.findUnique({
      where: {
        url: rss.url,
      },
    })
    for (let j = 0; j < rss.items.length; j++) {
      const item = rss.items[j];
      try {
        await prisma.rssItem.create({
          data: {
            rssId: dbRss.id,
            title: item.title,
            link: item.link,
            description: item.description,
            updateTime: moment(item.updateTime).unix(),
          },
        });
      } catch (error) {
        console.error(error);
        console.log(item);
      }
    }

  }

  console.log('suceess')
}

async function flush() {
  await prisma.$connect();
  await prisma.rssItem.deleteMany({});
  // await prisma.rss.deleteMany({});
  console.log('suceess')
}

// flush()
// main()
second()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
