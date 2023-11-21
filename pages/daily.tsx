
import type { NextPage } from 'next';
import Head from 'next/head';
import React, {
  useState,
  useEffect,
  useRef,
} from 'react';
import axios from 'axios';
import IndexedDB from "../components/indexdb";
import styles from "../styles/daily.module.css";

interface Item {
  datetime: string,
  imageurl: string,
  base64: string,

}

const useDataBase = () => {
  const dbRef = useRef<IndexedDB>();
  const [list, setList] = useState<Item[]>([]);
  useEffect(() => {
    const db = new IndexedDB({
      name: 'vercel' as any,
      version: 1 as any,
      table: "daily" as any,
      key: "datetime" as any,
      callback: () => {
        db.getAll().then((data) => {
          setList(data);
        })
      },
    });
    dbRef.current = db;
  }, []);
  const addItem = (item: Item) => {
    dbRef.current?.addItem(item);
  };
  return {
    list,
    addItem,
  }
}

const DailyPage: NextPage = () => {
  const [src, setSrc] = useState<string>('');
  const { list, addItem } = useDataBase();
  const getImgUrl = () => {
    axios.get('/api/daily').then(res => {
      // console.log(res);
      const { data } = res;
      setSrc('data:image/png;base64,' + data.base64);
      if (!list.map(item => item.datetime).includes(data.datetime)) {
        addItem(data);
      }
    })
  }
  useEffect(() => {
    getImgUrl();
  }, [])
  return (
    <div>
      <Head>
        <title>每天60秒读懂世界</title>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      </Head>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt='每天60秒读懂世界' className={styles.img} onClick={getImgUrl} />
    </div>
  )
}
export default DailyPage;
