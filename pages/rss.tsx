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
import ReactDOM, { flushSync } from 'react-dom';
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
const pageRef = createRef<HTMLDivElement>();
const iframeRef = createRef<HTMLIFrameElement>();
const rssListRef = createRef<HTMLElement>();
const rssRef = createRef<HTMLElement>();
const contentRef = createRef<HTMLDivElement>();
const searchRef = createRef<HTMLDivElement>();
const fileHandleRef = createRef<FileSystemFileHandle>();


function Image(props: any) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} />
}

declare global {
  interface Window {
    // cleanCache: () => void;
    // refreshDB: () => void;
    showSaveFilePicker: (option?: {}) => FileSystemFileHandle;
  }
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
  refreshDB: () => void;
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
  pageWidth: number
}

interface PageIframeProps {
  iframeUrl: string | undefined,
  item: RssItem,
  rss: Rss,
  pageWidth: number,
}

const writeFile = async (list: Rss[]) => {
  if (!fileHandleRef.current) return;
  console.log(fileHandleRef);
  try {
    // @ts-ignore：类型“FileSystemFileHandle”上不存在属性“createWritable”。
    const writableStream = await fileHandleRef.current.createWritable();
    const blob = new Blob([JSON.stringify(list)], {
      type: 'application/json'
    });
    await writableStream.write(blob);
    await writableStream.close();
  } catch (error) {
    console.error('写入失败', error);
  }
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

  const refreshDB = useCallback(() => {
    const noBatch = (i: number) => {
      flushSync(() => {
        setRssIndex(i);
      });
      /* setTimeout(() => {
        console.log('set', i)
        setRssIndex(i);
      }, 100); */
    }
    for (let i = 0; i < rssList.length; i++) {
      noBatch(i);
    }
  }, [rssList])

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
    writeFile(rssList);
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
    refreshDB,
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
  }, [rss]);

  return (
    <div className="rss-search" ref={searchRef}>
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
      <Button onClick={async () => {
        // @ts-ignore：无法分配到 "current" ，因为它是只读属性。
        fileHandleRef.current = await window.showSaveFilePicker({
          suggestedName: 'export-file.json',
          types: [{
            description: 'json',
            accept: { 'application/json': ['.json'] },
          }],
        });
      }}>文件</Button>
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
  }, [rssList])
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
    item,
    pageWidth,
  } = props;
  const isShow = pageWidth > 800;
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
        e.preventDefault();
        if (isShow) return;
        const a = e.currentTarget;
        const url = `/api/proxy?url=${a.href}&t=iframehtml`;
        if (iframeRef.current!.src !== location.origin + url) {
          iframeRef.current!.src = url;
        }
        pageRef.current!.style.visibility = 'visible';
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
  if (rss && rss.query && iframeRef.current!.src === `${location.origin}/api/proxy?url=${item.link}&t=iframehtml`) {
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
    rss,
    pageWidth,
  } = props;
  const isShow = pageWidth > 800;
  const children = (
    <div
      id='page'
      ref={pageRef}
      className={isShow ? 'page-show' : 'page-hide'}
      style={isShow ? { width: pageWidth } : undefined}
    >
      {!isShow && <RollbackOutlined onClick={() => {
        pageRef.current!.style.visibility = 'hidden';
      }} />}
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
    // refreshDB,
  } = useRssList();

  const flag = rss && !rss.loading && item && item.link;
  const iframeUrl = flag && `/api/proxy?url=${item.link}&t=iframehtml` || undefined;
  const [pageWidth, setPageWidth] = useState(0);

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
    pageWidth,
  };
  const pageIframeProps = {
    iframeUrl,
    rss,
    item,
    pageWidth,
  };

  useEffect(() => {
    const load = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.log(registration);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!searchRef.current) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const { clientWidth } = entry.target;
        setPageWidth(clientWidth - searchRef.current!.clientWidth);
        console.log('body width:', clientWidth)
      });
    });
    resizeObserver.observe(document.body);
    return () => {
      resizeObserver.disconnect();
    };
  }, [searchRef.current]);

  return (
    <div id="rss-reader">
      <Head>
        <title>rss reader</title>
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
    </div>
  );
}

export default RssReader
