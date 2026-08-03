import 'antd/dist/reset.css';
import '../styles/rss.scss';
import '../styles/globals.css';
import { App as AntdApp } from 'antd';
import type { AppProps } from 'next/app'

function App({ Component, pageProps }: AppProps) {
  return (
    <AntdApp>
      <Component {...pageProps} />
    </AntdApp>
  )
}
export default App
