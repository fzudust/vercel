/* eslint-disable react-hooks/exhaustive-deps,jsx-a11y/alt-text */
import type { NextPage } from 'next'
import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  createRef,
  SyntheticEvent,
} from 'react';
import ReactDOM from 'react-dom';
import moment from 'dayjs';
import Head from 'next/head'
// import NextImage from 'next/image'
import {
  Input,
  Button,
  Modal,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  UploadOutlined,
  RollbackOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  getRss,
  mergeRss,
  charFilter,
  onImgError,
  getIcon,
} from '../components/rss-helper';
import IndexedDB from "../components/indexdb"

const timeFormat = 'YYYY-MM-DD HH:mm:ss';
const pageRef = React.createRef<HTMLDivElement>();
const iframeRef = React.createRef<HTMLIFrameElement>();
const rssListRef = React.createRef<HTMLElement>();
const rssRef = React.createRef<HTMLElement>();
const contentRef = React.createRef<HTMLDivElement>();


function Image(props: any) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} />
}

interface RssItem {
  title: string,
  link: string,
  description: string,
  id: string,
  updateTime: string,

}

interface Rss {
  updateTime: number,
  url: string,
  title: string,
  items: RssItem[],
  loading?: boolean,
  icon?: string,
  query?: string,
}

interface UseRssRes {
  rssList: Rss[];
  rss: Rss;
  item: RssItem;
  addRss: (url: string) => Promise<void>;
  updateRss: (query?: string) => Promise<void>;
  changeRss: (i: number) => void;
  deleteRss: (i: number) => void;
  changeItem: (i: number) => void;
  initRssList: (data: Rss[], isWriteDb?: boolean) => void;
}

interface SearchBarProps {
  rss: Rss,
  rssList: Rss[],
  addRss: (url: string) => Promise<void>;
  updateRss: (query?: string) => Promise<void>;
  initRssList: (data: Rss[], isWriteDb?: boolean) => void;
}

interface RssListProps {
  rss: Rss,
  rssList: Rss[],
  changeRss: (i: number) => void,
  deleteRss: (i: number) => void,

}

interface ItemListProps {
  rss: Rss,
  item: RssItem,
  changeItem: (i: number) => void;
}

interface ContentProps {
  item: RssItem
}

interface PageIframeProps {
  iframeUrl: string | undefined,
  item: RssItem,
  rss: Rss,
}

function useRssList(): UseRssRes {
  const [rssList, setRssList] = useState<Rss[]>([]);
  const [rssIndex, setRssIndex] = useState<number>(0);
  const [itemIndex, setItemIndex] = useState<number>(0);
  const dbRef = useRef<IndexedDB>();

  const changeRss = useCallback((i: number) => {
    rssRef.current?.scrollTo(0, 0);
    setRssIndex(i);
    if (i === rssIndex) {
      updateRss()
    }
  }, [rssIndex]);
  const changeItem = useCallback((i: number) => {
    contentRef.current?.scrollTo(0, 0);
    setItemIndex(i);
  }, []);
  const deleteRss = useCallback((i: number) => {
    const currentRss = rssList.splice(i, 1)[0];
    Modal.confirm({
      centered: true,
      title: '是否删除订阅源:' + currentRss.title,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        setRssList([...rssList]);
        changeRss(0);
        dbRef.current?.deleteItem(currentRss.url);
      }
    });
  }, [rssList]);
  const addRss = useCallback(async (url: string) => {
    const rss = await getRss(url);
    if (rss) {
      rss.icon = getIcon(url);
      rssList.splice(0, 0, rss);
      setRssList([...rssList]);
      setRssIndex(0);
      changeItem(0);
      rssListRef.current?.scrollTo(0, 0);
      requestIdleCallback(() => {
        dbRef.current?.addItem(rss);
      });
    }
  }, [rssList]);
  const updateRss = async (query?: string) => {
    const currentRss = rssList[rssIndex];
    if (!currentRss) return
    if (query) {
      currentRss.query = query;
      setRssList([...rssList]);
      requestIdleCallback(() => {
        dbRef.current?.putItem(currentRss);
      });
    } else {
      currentRss.loading = true;
      setRssList([...rssList]);
      const rssNew = await getRss(currentRss.url);
      if (rssNew) {
        if (currentRss.query) {
          rssNew.query = currentRss.query;
        }
        rssNew.icon = currentRss.icon as string;
        mergeRss(rssNew, currentRss);
        changeItem(0);
        requestIdleCallback(() => {
          dbRef.current?.putItem(rssNew);
        });
      }
      setRssList((rssList) => {
        if (rssNew) {
          rssList[rssIndex] = rssNew;

        } else {
          rssList[rssIndex].loading = false;
        }
        return [...rssList]
      });
    }

  };
  const initRssList = useCallback((data: Rss[], isWriteDb?: boolean) => {
    const list = data.sort((a, b) => b.items.length - a.items.length);
    setRssList(list);
    setRssIndex(0);
    setItemIndex(0);
    if (isWriteDb) {
      list.forEach(data => {
        dbRef.current?.addItem(data)
      });
    }
  }, []);

  useEffect(() => {
    const db = new IndexedDB({
      name: 'nest-next' as any,
      version: 1 as any,
      table: "rss" as any,
      key: "url" as any,
      callback: () => {
        db.getAll().then((data) => {
          initRssList(data);
        })
      },
    });
    dbRef.current = db;
  }, []);
  useEffect(() => {
    updateRss()
  }, [rssIndex]);
  return {
    rssList,
    rss: rssList[rssIndex] || {
      url: '',
      loading: false,
      items: [],
    },
    item: rssList[rssIndex]?.items[itemIndex] || {
      link: '',
      description: '',
    },
    addRss,
    updateRss,
    changeRss,
    deleteRss,
    changeItem,
    initRssList,
  }

}

function SearchBar(props: SearchBarProps) {
  const {
    rss,
    rssList,
    addRss,
    updateRss,
    initRssList,
  } = props;
  const [url, setUrl] = useState('');
  const [query, setQuery] = useState('');
  const fileRef = createRef<HTMLInputElement>();
  const aRef = createRef<HTMLAnchorElement>();

  const addQuery = useCallback(() => {
    updateRss(query);
  }, [query]);
  const add = useCallback(() => {
    if (url === rss.url) {
      updateRss();
    } else {
      addRss(url);
    }
  }, [url]);
  useEffect(() => {
    setUrl(rss.url)
    setQuery(rss.query as string)
  }, [rss])

  return (
    <div className="rss-search">
      <Input
        style={{ width: '40%' }}
        addonBefore="地址:"
        value={url}
        onChange={e => setUrl(e.target.value)}
        suffix={
          <SearchOutlined onClick={add} />
        }
      />
      <Input
        style={{ width: '30%' }}
        addonBefore="内容:"
        value={query}
        onChange={e => setQuery(e.target.value)}
        suffix={
          <SearchOutlined onClick={addQuery} />
        }
      />
      <Button type="primary" icon={<UploadOutlined />} onClick={(e) => {
        e.stopPropagation();
        fileRef.current?.click();
      }}>导入</Button>
      <Button icon={<DownloadOutlined />} onClick={() => {
        const json = rssList;
        const blob = new Blob([JSON.stringify(json, null, 2)], {
          type: 'application/json'
        });
        aRef.current!.href = URL.createObjectURL(blob);
        aRef.current?.click();
      }}>导出</Button>
      {/* <Button icon={<RetweetOutlined />} onClick={filterRssList}>过滤</Button> */}
      <a ref={aRef} download='export.json' />
      <input
        type='file'
        style={{ display: 'none' }}
        ref={fileRef}
        accept="application/json"
        onChange={(e) => {
          const file = (e.target.files || [])[0];
          const reader = new FileReader();
          reader.readAsText(file);
          reader.onload = () => {
            const list = JSON.parse(reader.result as string);
            initRssList(list, true);
          };
        }}
      />
    </div>
  );
}

function RssList(props: RssListProps) {
  const {
    rssList,
    rss,
    changeRss,
    deleteRss,
  } = props
  const deleteFn = useCallback((e: SyntheticEvent, i: number) => {
    e.stopPropagation();
    deleteRss(i)
  }, [])
  return (
    <nav ref={rssListRef}>
      {rssList.map((obj, i) =>
        <h4
          key={obj.url}
          onClick={() => changeRss(i)}
          className={obj.url === rss.url ? 'selected' : undefined}
        >
          <Image src={obj.icon as string} className='icon' onError={(e: Event) => onImgError(e, obj)} />
          <a href={obj.url} onClick={(e) => {
            e.preventDefault();
            return false;
          }} >
            {obj.title}
          </a>
          <Image
            src='/loading.svg'
            className={obj.loading ? 'icon' : 'icon none'}
          />
          <CloseCircleOutlined
            onClick={e => deleteFn(e, i)}
            className='icon float-right'
          />
          <br />
          {obj.updateTime && moment(obj.updateTime).format(timeFormat)}
        </h4>)}
    </nav>
  );
}

function ItemList(props: ItemListProps) {
  const {
    rss,
    item,
    changeItem,
  } = props;
  return (
    <aside ref={rssRef}>
      {rss && rss.items.slice(0, 200).map((obj, i) =>
        <p
          key={obj.id}
          className={obj.link === item.link ? 'selected' : undefined}
          onClick={() => changeItem(i)}
        >
          {obj.title}
          <br />
          {obj.updateTime && moment(obj.updateTime).format(timeFormat)}
        </p>)}
    </aside>
  );
}

function Content(props: ContentProps) {
  const {
    item
  } = props;
  const ifr = `<iframe
				title='展示内容'
				name='contentIframe'
				src="/iframe.html"
				seamless
				frameborder="0"
				marginwidth="0"
				marginheight="0"
				scrolling="no"
				sandbox="allow-same-origin"
			/>`;

  const __html = charFilter(item.description) + ifr;
  useEffect(() => {
    const content = contentRef.current;
    if (content) {
      const h2Height = (content.previousSibling!.firstChild as HTMLElement)!.clientHeight + "px";
      content!.style.height = `calc(100vh - 63px - ${h2Height})`;
    }
  }, [item]);
  return (
    <main>
      {item && <a href={item.link} onClick={e => {
        pageRef!.current!.style.visibility = 'visible';
        const a = e.currentTarget;
        const url = `/api/proxy?url=${a.href}`;
        if (iframeRef.current!.src !== location.origin + url) {
          iframeRef.current!.src = url;
        }
        e.preventDefault();
        return false;
      }}><h2>{item.title}</h2></a>}
      {item && item.link && <div id='content' dangerouslySetInnerHTML={{ __html }} ref={contentRef} />}
    </main>
  );
}
const iframeOnLoad = (e: SyntheticEvent<HTMLIFrameElement, Event>, rss: Rss, item: RssItem) => {
  if (!iframeRef.current!.src || (e.target as HTMLIFrameElement).src !== iframeRef.current!.src) return;
  const iframeDocument = iframeRef.current!.contentDocument;
  if (!iframeDocument) return;
  if (rss && rss.query && iframeRef.current!.src === `${location.origin}/api/proxy?url=${item.link}`) {
    const content = contentRef.current;
    const query = iframeDocument.querySelector(rss.query);
    if (query) {
      const node = query.cloneNode(true);
      const iframe = content!.querySelector('iframe') as HTMLIFrameElement;
      const styleList = iframeDocument.querySelectorAll('style,link');
      const base = document.createElement('base');
      const baseUrl = new URL(item.link);
      base.href = baseUrl.origin;
      iframe.contentDocument!.head.append(base);
      styleList.forEach(s => iframe!.contentDocument!.head.append(s.cloneNode(true)));
      iframe.contentDocument!.body.append(node);
      requestIdleCallback(() => {
        iframe.height = String(Number(query.scrollHeight) + 20);
      });
    }
  }
}

function PageIframe(props: PageIframeProps) {
  const {
    iframeUrl,
    item,
    rss
  } = props;
  const children = (
    <div
      id='page'
      ref={pageRef}
    >
      <RollbackOutlined onClick={() => {
        pageRef.current!.style.visibility = 'hidden';
      }} />
      <iframe
        title='展示网页'
        name="pageIframe"
        onError={e => console.error(e)}
        src={iframeUrl}
        seamless
        ref={iframeRef}
        onLoad={(e) => iframeOnLoad(e, rss, item)}
        sandbox="allow-same-origin"
        referrerPolicy="no-referrer"
      />
    </div>
  )
  return ReactDOM.createPortal(
    children,
    document.getElementById('__next') as Element
  );
}

const RssReader: NextPage = () => {
  const {
    rssList,
    rss,
    item,
    addRss,
    updateRss,
    deleteRss,
    changeRss,
    changeItem,
    initRssList,
  } = useRssList();

  const flag = rss && rss.query && !rss.loading && item && item.link;
  const iframeUrl = flag && `/api/proxy?url=${item.link}` || undefined;

  const searchBarProps = {
    rss,
    rssList,
    addRss,
    updateRss,
    initRssList,
  };
  const rssListProps = {
    rss,
    rssList,
    changeRss,
    deleteRss,
  };
  const itemListProps = {
    rss,
    item,
    changeItem,
  };
  const contentProps = {
    item,
  };
  const pageIframeProps = {
    iframeUrl,
    rss,
    item,
  };

  useEffect(() => {
    window.addEventListener('load', () => {
      // Is service worker available?
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').then(() => {
          console.log('Service worker registered!');
        }).catch((error) => {
          console.warn('Error registering service worker:');
          console.warn(error);
        });
      }
    });
  }, []);

  return (
    <>
      <Head>
        <title>rss</title>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      </Head>
      <SearchBar {...searchBarProps} />
      <div className='rss-content' >
        <RssList {...rssListProps} />
        <ItemList {...itemListProps} />
        <Content {...contentProps} />
      </div>
      {iframeUrl && <PageIframe {...pageIframeProps} />}
    </>
  );
}

export default RssReader
